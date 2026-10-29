// Server-only Google Drive helpers. Never import this from client components.
import { google, type Auth, type drive_v3 } from 'googleapis';
import { ALLOWED_TYPES, MAX_PHOTOS, type GalleryPhoto } from './config';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const STALE_MS = 60 * 60 * 1000; // unfinished uploads older than 1h are discarded

export type DriveFile = drive_v3.Schema$File;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let _auth: Auth.OAuth2Client | null = null;
function getAuth(): Auth.OAuth2Client {
  if (!_auth) {
    _auth = new google.auth.OAuth2(env('GOOGLE_CLIENT_ID'), env('GOOGLE_CLIENT_SECRET'));
    _auth.setCredentials({ refresh_token: env('GOOGLE_REFRESH_TOKEN') });
  }
  return _auth;
}

export function getDrive(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuth() });
}

const rootId = () => env('DRIVE_ROOT_FOLDER_ID');

/* ---------- Names ---------- */

const NAME_STRIP = new RegExp("[^\\p{L}\\p{M}\\s'.-]", 'gu');

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.normalize('NFC').replace(NAME_STRIP, '').replace(/\s+/g, ' ').trim();
  return n.length >= 2 && n.length <= 60 ? n : null;
}

export function toFolderName(studentId: string, name: string): string {
  return `${studentId}_${name.replace(/['.]/g, '').replace(/\s+/g, '-')}`;
}

// "24-2157-703_Ron-Brian-Rodriguez" -> "Ron Brian Rodriguez" (ID is never exposed)
export function displayName(folderName: string): string {
  const i = folderName.indexOf('_');
  const raw = i >= 0 ? folderName.slice(i + 1) : folderName;
  return raw.replace(/-/g, ' ').trim() || 'Anonymous';
}

/* ---------- Student folders ---------- */

export async function findStudentFolder(studentId: string): Promise<DriveFile | null> {
  // studentId is regex-validated by callers, so it is safe inside the query.
  const res = await getDrive().files.list({
    q: `'${rootId()}' in parents and mimeType='${FOLDER_MIME}' and trashed=false and appProperties has { key='studentId' and value='${studentId}' }`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime',
    pageSize: 10,
  });
  return res.data.files?.[0] ?? null;
}

export async function getOrCreateStudentFolder(studentId: string, name: string): Promise<DriveFile> {
  const existing = await findStudentFolder(studentId);
  if (existing) return existing;
  await getDrive().files.create({
    requestBody: {
      name: toFolderName(studentId, name),
      mimeType: FOLDER_MIME,
      parents: [rootId()],
      appProperties: { studentId },
    },
    fields: 'id',
  });
  // Re-query so two simultaneous first registrations converge on the oldest folder.
  const folder = await findStudentFolder(studentId);
  if (!folder) throw new Error('Could not create student folder');
  return folder;
}

/* ---------- Files in a student folder ---------- */

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const res = await getDrive().files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: 'files(id,name,createdTime,appProperties)',
    orderBy: 'createdTime',
    pageSize: 100,
  });
  return res.data.files ?? [];
}

const isActive = (f: DriveFile, now: number) =>
  f.appProperties?.verified === '1' || now - Date.parse(f.createdTime ?? '') < STALE_MS;

/** Verified files, plus uploads still in progress (younger than 1 hour). */
export function activeFiles(files: DriveFile[]): DriveFile[] {
  const now = Date.now();
  return files.filter((f) => isActive(f, now));
}

/** Deletes abandoned, never-verified uploads and returns the active files. */
export async function cleanupStale(files: DriveFile[]): Promise<DriveFile[]> {
  const now = Date.now();
  const drive = getDrive();
  const active: DriveFile[] = [];
  for (const f of files) {
    if (isActive(f, now)) active.push(f);
    else if (f.id) await drive.files.delete({ fileId: f.id }).catch(() => undefined);
  }
  return active;
}

export function nextPhotoName(files: DriveFile[], ext: string): string {
  const used = new Set<number>();
  for (const f of files) {
    const m = f.name?.match(/^photo_(\d+)\./);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return `photo_${String(n).padStart(2, '0')}.${ext}`;
}

export async function safeDelete(fileId: string): Promise<void> {
  await getDrive().files.delete({ fileId }).catch(() => undefined);
}

/* ---------- Resumable upload ---------- */

/**
 * Creates a Drive resumable-upload session on the server. The browser then
 * uploads the bytes directly to Google (bypassing Vercel's body-size limit).
 * Passing Origin makes the session URL usable from that browser origin (CORS).
 */
export async function createUploadSession(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  keyHash: string;
  origin: string;
}): Promise<string> {
  const { token } = await getAuth().getAccessToken();
  if (!token) throw new Error('Could not get Google access token');
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': opts.mimeType,
        'X-Upload-Content-Length': String(opts.size),
        Origin: opts.origin,
      },
      body: JSON.stringify({
        name: opts.name,
        parents: [opts.folderId],
        mimeType: opts.mimeType,
        appProperties: { keyHash: opts.keyHash },
      }),
    }
  );
  if (!res.ok) throw new Error(`Drive session failed: ${res.status} ${await res.text()}`);
  const location = res.headers.get('location');
  if (!location) throw new Error('Drive did not return an upload URL');
  return location;
}

/* ---------- Content validation ---------- */

export async function readHead(fileId: string): Promise<Buffer> {
  const res = await getDrive().files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer', headers: { Range: 'bytes=0-15' } }
  );
  return Buffer.from(res.data as unknown as ArrayBuffer);
}

/** Checks the real file signature (magic bytes), not just the declared type. */
export function detectImageType(b: Buffer): (typeof ALLOWED_TYPES)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

/* ---------- Public gallery ---------- */

export async function listGallery(): Promise<GalleryPhoto[]> {
  const drive = getDrive();

  const folders = new Map<string, string>();
  let folderToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${rootId()}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
      fields: 'nextPageToken,files(id,name)',
      pageSize: 1000,
      pageToken: folderToken,
    });
    for (const f of res.data.files ?? []) if (f.id && f.name) folders.set(f.id, f.name);
    folderToken = res.data.nextPageToken ?? undefined;
  } while (folderToken);

  const photos: GalleryPhoto[] = [];
  let fileToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `appProperties has { key='verified' and value='1' } and mimeType contains 'image/' and trashed=false`,
      fields: 'nextPageToken,files(id,parents,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
      pageToken: fileToken,
    });
    for (const f of res.data.files ?? []) {
      const parent = f.parents?.[0];
      const folderName = parent ? folders.get(parent) : undefined;
      if (f.id && folderName) {
        photos.push({ id: f.id, uploader: displayName(folderName), createdTime: f.createdTime ?? '' });
      }
    }
    fileToken = res.data.nextPageToken ?? undefined;
  } while (fileToken);

  return photos;
}

export const REMAINING = (activeCount: number) => Math.max(0, MAX_PHOTOS - activeCount);
