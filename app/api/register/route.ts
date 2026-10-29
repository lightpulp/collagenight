import { NextResponse } from 'next/server';
import { MAX_PHOTOS, STUDENT_ID_REGEX } from '@/lib/config';
import {
  REMAINING,
  activeFiles,
  cleanName,
  displayName,
  getOrCreateStudentFolder,
  listFolderFiles,
} from '@/lib/drive';


export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : '';
    const name = cleanName(body?.name);
    if (!STUDENT_ID_REGEX.test(studentId)) {
      return NextResponse.json({ error: 'Student ID must look like 24-2157-703.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Please enter your full name (2-60 letters).' }, { status: 400 });
    }

    const folder = await getOrCreateStudentFolder(studentId, name);
    const files = activeFiles(await listFolderFiles(folder.id!));
    return NextResponse.json({
      // Returning students keep the name their folder was created with.
      studentName: displayName(folder.name ?? name),
      uploaded: files.length,
      remaining: REMAINING(files.length),
      max: MAX_PHOTOS,
    });
  } catch (e) {
    console.error('register failed', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
