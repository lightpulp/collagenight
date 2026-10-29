import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { ALLOWED_TYPES, MAX_FILE_BYTES, MAX_PHOTOS, STUDENT_ID_REGEX } from '@/lib/config';
import {
  REMAINING,
  activeFiles,
  cleanupStale,
  createUploadSession,
  detectImageType,
  findStudentFolder,
  getDrive,
  listFolderFiles,
  nextPhotoName,
  readHead,
  safeDelete,
} from '@/lib/drive';


const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Step 1 ("init"): validate everything we can know before the bytes exist, enforce
 * the allowance, and hand back a Google resumable-upload URL. The browser uploads
 * straight to Google, so large photos never pass through Vercel.
 */
async function handleInit(req: Request, body: Record<string, unknown>) {
  const studentId = String(body.studentId ?? '');
  const mimeType = String(body.mimeType ?? '');
  const size = Number(body.size);
  const fileKey = String(body.fileKey ?? '');

  if (!STUDENT_ID_REGEX.test(studentId)) return fail(400, 'Invalid student ID.');
  if (!(ALLOWED_TYPES as readonly string[]).includes(mimeType)) {
    return fail(400, 'Only JPEG, PNG and WebP photos are allowed.');
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
    return fail(400, 'Each photo must be 15 MB or smaller.');
  }
  if (!fileKey || fileKey.length > 300) return fail(400, 'Invalid request.');

  const folder = await findStudentFolder(studentId);
  if (!folder?.id) return fail(404, 'Please register first.');

  const files = await cleanupStale(await listFolderFiles(folder.id));
  const keyHash = createHash('sha256').update(fileKey).digest('hex').slice(0, 32);

  // Same photo sent again (retry or re-selected): never create a second copy.
  const dup = files.find((f) => f.appProperties?.keyHash === keyHash);
  if (dup?.id) {
    return NextResponse.json({
      status: 'duplicate',
      fileId: dup.id,
      verified: dup.appProperties?.verified === '1',
      remaining: REMAINING(files.length),
    });
  }

  if (files.length >= MAX_PHOTOS) {
    return fail(403, `You have reached the limit of ${MAX_PHOTOS} photos.`);
  }

  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const uploadUrl = await createUploadSession({
    folderId: folder.id,
    name: nextPhotoName(files, EXT[mimeType]),
    mimeType,
    size,
    keyHash,
    origin,
  });
  return NextResponse.json({ status: 'ready', uploadUrl, remaining: REMAINING(files.length) });
}

/**
 * Step 2 ("complete"): after the browser finished uploading, verify the real file
 * (size, magic bytes, belongs to this student), re-check the allowance using Drive
 * as the source of truth, then publish it. Anything invalid or over the limit is deleted.
 */
async function handleComplete(body: Record<string, unknown>) {
  const studentId = String(body.studentId ?? '');
  const fileId = String(body.fileId ?? '');
  if (!STUDENT_ID_REGEX.test(studentId)) return fail(400, 'Invalid student ID.');
  if (!/^[\w-]{10,100}$/.test(fileId)) return fail(400, 'Invalid file.');

  const folder = await findStudentFolder(studentId);
  if (!folder?.id) return fail(404, 'Please register first.');

  const drive = getDrive();
  const meta = (
    await drive.files.get({ fileId, fields: 'id,size,parents,appProperties,createdTime' })
  ).data;
  if (!meta.parents?.includes(folder.id)) return fail(403, 'That file does not belong to this student.');

  const files = activeFiles(await listFolderFiles(folder.id)); // oldest first
  if (meta.appProperties?.verified === '1') {
    return NextResponse.json({ ok: true, remaining: REMAINING(files.length) });
  }

  const size = Number(meta.size ?? 0);
  if (size <= 0 || size > MAX_FILE_BYTES) {
    await safeDelete(fileId);
    return fail(400, 'Each photo must be 15 MB or smaller.');
  }
  if (!detectImageType(await readHead(fileId))) {
    await safeDelete(fileId);
    return fail(400, 'That file is not a valid JPEG, PNG or WebP image.');
  }

  // Allowance check after the fact: the oldest 10 files win, extras are deleted.
  // This closes the race between simultaneous uploads without a database.
  const position = files.findIndex((f) => f.id === fileId);
  if (position === -1 || position >= MAX_PHOTOS) {
    await safeDelete(fileId);
    return fail(409, `You have reached the limit of ${MAX_PHOTOS} photos.`);
  }

  await drive.files.update({ fileId, requestBody: { appProperties: { verified: '1' } } });
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  return NextResponse.json({ ok: true, remaining: REMAINING(files.length) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return fail(400, 'Invalid request.');
    if (body.action === 'init') return await handleInit(req, body);
    if (body.action === 'complete') return await handleComplete(body);
    return fail(400, 'Unknown action.');
  } catch (e) {
    console.error('upload failed', e);
    return fail(500, 'Something went wrong. Please try again.');
  }
}
