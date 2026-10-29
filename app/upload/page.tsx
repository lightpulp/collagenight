'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { ALLOWED_TYPES, EVENT_NAME, MAX_FILE_BYTES, MAX_PHOTOS, STUDENT_ID_REGEX } from '@/lib/config';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'] });
const body = Jost({ subsets: ['latin'], weight: ['400', '500', '600'] });

type Status = 'queued' | 'uploading' | 'done' | 'error';
interface Item {
  id: string;
  file: File;
  preview: string;
  status: Status;
  progress: number;
  error?: string;
}
interface ApiData {
  error?: string;
  status?: string;
  uploadUrl?: string;
  fileId?: string;
  verified?: boolean;
  remaining?: number;
  studentName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: ApiData = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network problem. Check your connection.' } as ApiData };
  }
}

// Sends the file straight to Google's resumable-upload URL (not through Vercel).
function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Unexpected response from Google.'));
        }
      } else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network problem during upload.'));
    xhr.send(file);
  });
}

const GOLD_BTN =
  'w-full rounded-full bg-gradient-to-b from-[#f0d595] to-[#c9993f] px-6 py-3 text-base font-semibold text-[#2a0a10] transition-opacity focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 disabled:opacity-50';
const INPUT =
  'w-full rounded-lg border border-[#d9b26a]/35 bg-black/40 px-3 py-3 text-base text-[#f4e9d8] outline-none placeholder:text-[#f4e9d8]/35 focus:border-[#e8c77f] focus:ring-2 focus:ring-[#e8c77f]/30';

function Ornament() {
  return (
    <svg viewBox="0 0 220 16" className="mx-auto h-3 w-44" aria-hidden="true">
      <path d="M0 8h88M132 8h88" stroke="#d9b26a" strokeWidth="1" opacity=".7" />
      <path d="M110 1l7 7-7 7-7-7z" fill="none" stroke="#e8c77f" strokeWidth="1.2" />
      <circle cx="94" cy="8" r="1.5" fill="#e8c77f" />
      <circle cx="126" cy="8" r="1.5" fill="#e8c77f" />
    </svg>
  );
}

export default function UploadPage() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [formError, setFormError] = useState('');

  const [student, setStudent] = useState<{ name: string; id: string } | null>(null);
  const [remaining, setRemaining] = useState(MAX_PHOTOS);
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const ref = itemsRef;
    return () => ref.current.forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  const pending = items.filter((i) => i.status !== 'done').length;
  const capacity = Math.max(0, remaining - pending);

  async function register(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError('');
    const id = studentId.trim();
    if (name.trim().length < 2) return setFormError('Please enter your full name.');
    if (!STUDENT_ID_REGEX.test(id)) return setFormError('Student ID must look like 24-2157-703.');
    if (!agreed) return setFormError('Please accept the notice about photo visibility.');
    setRegistering(true);
    const res = await api('/api/register', { name: name.trim(), studentId: id });
    setRegistering(false);
    if (!res.ok) return setFormError(res.data.error ?? 'Could not register. Try again.');
    setStudent({ name: res.data.studentName ?? name.trim(), id });
    setRemaining(res.data.remaining ?? 0);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    const problems: string[] = [];
    const accepted: Item[] = [];
    let room = capacity;
    for (const file of picked) {
      if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
        problems.push(`${file.name}: only JPEG, PNG or WebP.`);
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name}: larger than 15 MB.`);
      } else if (room <= 0) {
        problems.push(`${file.name}: no allowance left.`);
      } else {
        room--;
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          status: 'queued',
          progress: 0,
        });
      }
    }
    setItems((prev) => [...prev, ...accepted]);
    setNotice(problems.length ? { kind: 'error', text: problems.join(' ') } : null);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function uploadOne(item: Item, studentId: string): Promise<'done' | 'limit' | 'error'> {
    const update = (patch: Partial<Item>) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const fail = (text: string, result: 'limit' | 'error' = 'error') => {
      update({ status: 'error', error: text });
      return result;
    };
    const finish = (rem?: number) => {
      update({ status: 'done', progress: 1, error: undefined });
      if (typeof rem === 'number') setRemaining(rem);
      return 'done' as const;
    };

    update({ status: 'uploading', progress: 0, error: undefined });
    const fileKey = `${item.file.name}|${item.file.size}|${item.file.lastModified}`;
    let fileId: string | null = null;
    let lastError = 'Upload failed.';

    for (let attempt = 1; attempt <= 3 && !fileId; attempt++) {
      const init = await api('/api/upload', {
        action: 'init',
        studentId,
        mimeType: item.file.type,
        size: item.file.size,
        fileKey,
      });
      if (!init.ok) {
        lastError = init.data.error ?? lastError;
        if (init.status === 403) return fail(lastError, 'limit');
        if (init.status !== 0 && init.status < 500) return fail(lastError);
        await sleep(1000 * attempt);
        continue;
      }
      if (init.data.status === 'duplicate' && init.data.fileId) {
        if (init.data.verified) return finish(init.data.remaining);
        fileId = init.data.fileId; // uploaded earlier but never confirmed
        break;
      }
      try {
        const result = await putFile(init.data.uploadUrl!, item.file, (p) => update({ progress: p }));
        fileId = result.id;
      } catch (e) {
        lastError = e instanceof Error ? e.message : lastError;
        await sleep(1000 * attempt);
      }
    }
    if (!fileId) return fail(lastError);

    update({ progress: 1 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const done = await api('/api/upload', { action: 'complete', studentId, fileId });
      if (done.ok) return finish(done.data.remaining);
      lastError = done.data.error ?? lastError;
      if (done.status !== 0 && done.status < 500) return fail(lastError, done.status === 409 ? 'limit' : 'error');
      await sleep(1000 * attempt);
    }
    return fail(lastError);
  }

  async function startUpload() {
    if (!student) return;
    setUploading(true);
    setNotice(null);
    let ok = 0;
    let failed = 0;
    for (const item of items.filter((i) => i.status === 'queued' || i.status === 'error')) {
      const result = await uploadOne(item, student.id);
      if (result === 'done') ok++;
      else {
        failed++;
        if (result === 'limit') break;
      }
    }
    setUploading(false);
    setNotice(
      failed === 0
        ? { kind: 'ok', text: `${ok} photo${ok === 1 ? '' : 's'} uploaded. They will show up on the main screen shortly.` }
        : { kind: 'error', text: `${ok} uploaded, ${failed} failed. Tap "Upload photos" to retry the failed ones.` }
    );
  }

  const queuedCount = items.filter((i) => i.status === 'queued' || i.status === 'error').length;

  return (
    <main
      className={`${body.className} relative min-h-screen bg-[#0b0507] text-[#f4e9d8]`}
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 40% at 50% 0%,rgba(190,25,50,.5),transparent 70%)',
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 pb-8 pt-6">
        <Link
          href="/"
          className="w-fit text-sm text-[#f4e9d8]/75 underline decoration-[#d9b26a]/60 underline-offset-4 hover:text-[#f4e9d8]"
        >
          Back to photos
        </Link>

        <header className="mt-6 text-center">
          <p className={`${display.className} text-xl italic text-[#e8c77f]`}>College Night</p>
          <h1
            className={`${display.className} text-4xl font-bold leading-none sm:text-5xl`}
            style={{
              background: 'linear-gradient(180deg,#f6e3b4,#d9b26a 55%,#a97c3a)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {EVENT_NAME}
          </h1>
          <div className="mt-3">
            <Ornament />
          </div>
          <p className="mt-3 text-sm text-[#f4e9d8]/75">Upload up to {MAX_PHOTOS} photos per student.</p>
        </header>

        <div className="mt-6 flex-1">
          {!student ? (
            <form onSubmit={register} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={INPUT}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Student ID</span>
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="24-2157-703"
                  inputMode="numeric"
                  className={INPUT}
                />
                <span className="mt-1 block text-xs text-[#f4e9d8]/55">
                  Come back with the same ID any time to upload your remaining photos.
                </span>
              </label>

              <div className="rounded-lg border border-[#d9b26a]/45 bg-[#8f1226]/20 p-4 text-sm">
                <p className={`${display.className} text-lg font-semibold italic text-[#e8c77f]`}>Before you upload</p>
                <p className="mt-1 text-[#f4e9d8]/85">
                  Photos you upload can be seen and downloaded by other people at this event, and are shown on
                  the big screen with your name. Only upload photos you are happy to share.
                </p>
                <label className="mt-3 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-[#d9b26a]"
                  />
                  <span>I understand and agree.</span>
                </label>
              </div>

              {formError && <p className="text-sm text-[#ff9aa8]">{formError}</p>}
              <button disabled={registering} className={GOLD_BTN}>
                {registering ? 'Checking…' : 'Continue'}
              </button>
            </form>
          ) : (
            <section className="space-y-4">
              <div className="rounded-lg border border-[#d9b26a]/30 bg-black/35 p-4">
                <p className={`${display.className} text-2xl font-semibold italic`}>Hi {student.name}</p>
                <p className="text-sm text-[#f4e9d8]/75">
                  {MAX_PHOTOS - remaining} of {MAX_PHOTOS} photos used. <strong className="text-[#e8c77f]">{remaining} remaining.</strong>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#b3122b] to-[#e8c77f] transition-all"
                    style={{ width: `${((MAX_PHOTOS - remaining) / MAX_PHOTOS) * 100}%` }}
                  />
                </div>
                {!uploading && (
                  <button
                    onClick={() => {
                      items.forEach((i) => URL.revokeObjectURL(i.preview));
                      setItems([]);
                      setStudent(null);
                      setNotice(null);
                    }}
                    className="mt-2 text-xs text-[#f4e9d8]/70 underline underline-offset-4"
                  >
                    Not you? Use a different ID
                  </button>
                )}
              </div>

              {remaining > 0 ? (
                <label
                  className={`block cursor-pointer rounded-lg border-2 border-dashed border-[#d9b26a]/45 bg-black/25 p-6 text-center transition-colors hover:border-[#e8c77f] focus-within:border-[#e8c77f] ${
                    capacity === 0 || uploading ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <span className={`${display.className} text-2xl font-semibold italic text-[#e8c77f]`}>Choose photos</span>
                  <span className="mt-1 block text-sm text-[#f4e9d8]/75">
                    JPEG, PNG or WebP, up to 15 MB each. You can add {capacity} more.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPick}
                    className="sr-only"
                  />
                </label>
              ) : (
                <p className="rounded-lg border border-[#d9b26a]/30 bg-black/35 p-4 text-sm">
                  You have used all {MAX_PHOTOS} photos. Thank you for sharing.
                </p>
              )}

              {items.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((i) => (
                    <li key={i.id} className="overflow-hidden rounded-[3px] bg-[#f4e9d8] p-1 text-[#2a0a10] shadow-[0_6px_18px_rgba(0,0,0,.6)]">
                      <div className="relative aspect-square overflow-hidden bg-[#2a0a10]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.preview} alt="" className="h-full w-full object-cover" />
                        {i.status === 'done' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-[#e8c77f]">
                            Uploaded
                          </span>
                        )}
                        {i.status === 'queued' && !uploading && (
                          <button
                            onClick={() => removeItem(i.id)}
                            aria-label="Remove photo"
                            className="absolute right-1 top-1 h-8 w-8 rounded-full bg-black/75 text-lg leading-none text-[#f4e9d8]"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="px-1 py-1.5 text-xs">
                        {i.status === 'uploading' && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#2a0a10]/20">
                            <div className="h-full bg-[#b3122b]" style={{ width: `${Math.round(i.progress * 100)}%` }} />
                          </div>
                        )}
                        {i.status === 'queued' && <span className="text-[#2a0a10]/70">Ready</span>}
                        {i.status === 'error' && <span className="text-[#a1111f]">{i.error}</span>}
                        {i.status === 'uploading' && <span className="mt-1 block text-[#2a0a10]/70">Uploading…</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {notice && (
                <p className={`text-sm ${notice.kind === 'ok' ? 'text-[#9ee6b0]' : 'text-[#ff9aa8]'}`}>{notice.text}</p>
              )}

              <button onClick={startUpload} disabled={uploading || queuedCount === 0} className={GOLD_BTN}>
                {uploading ? 'Uploading… keep this page open' : `Upload photos${queuedCount ? ` (${queuedCount})` : ''}`}
              </button>
            </section>
          )}
        </div>

        <footer className={`${display.className} mt-10 text-center text-base italic text-[#e8c77f]`}>
          Built by MSD-2026
        </footer>
      </div>
    </main>
  );
}