'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  EVENT_NAME,
  POLL_SECONDS,
  downloadUrl,
  fullUrl,
  thumbUrl,
  type GalleryPhoto,
} from '@/lib/config';

function QrBlock() {
  // Put your QR code image at public/qr.png. Until then a placeholder is shown.
  const [hasQr, setHasQr] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasQr(true);
    img.onerror = () => setHasQr(false);
    img.src = '/qr.png';
  }, []);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white p-1.5 sm:h-28 sm:w-28 lg:h-36 lg:w-36">
        {hasQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/qr.png" alt="QR code linking to the upload page" className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-[10px] font-semibold leading-tight text-neutral-500 sm:text-xs">
            QR CODE
            <br />
            (add public/qr.png)
          </span>
        )}
      </div>
      <span className="text-xs text-neutral-300 lg:text-sm">Scan to add your photos</span>
    </div>
  );
}

function PhotoCard({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="relative aspect-[4/3] h-full shrink-0 overflow-hidden rounded-2xl bg-neutral-800 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#f5c542]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(photo.id)}
        alt={`Photo uploaded by ${photo.uploader}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-3 py-1.5 text-xs font-medium sm:text-sm lg:text-base">
        Uploaded by: {photo.uploader}
      </span>
    </button>
  );
}

function Strip({
  photos,
  reverse,
  onOpen,
}: {
  photos: GalleryPhoto[];
  reverse: boolean;
  onOpen: (p: GalleryPhoto) => void;
}) {
  if (photos.length === 0) return <div className="min-h-0 flex-1" />;
  let items = photos;
  while (items.length < 6) items = items.concat(photos);
  const duration = Math.max(40, items.length * 7);
  return (
    <div className="marquee-row min-h-0 flex-1 overflow-hidden">
      <div
        className="marquee-track h-full"
        style={{ animationName: reverse ? 'marquee-right' : 'marquee-left', animationDuration: `${duration}s` }}
      >
        {[0, 1].map((half) => (
          <div key={half} className="flex h-full shrink-0 gap-4 pr-4">
            {items.map((p, i) => (
              <PhotoCard key={`${half}-${i}-${p.id}`} photo={p} onOpen={() => onOpen(p)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Lightbox({ photo, onClose }: { photo: GalleryPhoto; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fullUrl(photo.id)}
        alt={`Photo uploaded by ${photo.uploader}`}
        referrerPolicy="no-referrer"
        className="max-h-[75vh] max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="text-base font-medium">Uploaded by: {photo.uploader}</p>
      <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
        <a
          href={downloadUrl(photo.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#f5c542] px-6 py-2.5 font-semibold text-black"
        >
          Download photo
        </a>
        <button onClick={onClose} className="rounded-full border border-white/40 px-6 py-2.5 font-semibold">
          Close
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch('/api/photos', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { photos: GalleryPhoto[] } | null) => {
          if (!active) return;
          if (data) {
            // Only replace state when something changed, so the strips keep rotating undisturbed.
            setPhotos((prev) =>
              prev.map((p) => p.id).join() === data.photos.map((p) => p.id).join() ? prev : data.photos
            );
          }
          setLoaded(true);
        })
        .catch(() => active && setLoaded(true)); // keep showing what we have
    };
    load();
    const timer = setInterval(load, POLL_SECONDS * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const rows = [0, 1, 2].map((r) => {
    const own = photos.filter((_, i) => i % 3 === r);
    return own.length > 0 ? own : photos; // few photos: every strip shows what exists
  });

  return (
    <main>
      <div className="flex h-[100svh] flex-col gap-3 p-4 lg:gap-4 lg:p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-4xl lg:text-6xl">{EVENT_NAME}</h1>
            <p className="mt-1 text-sm text-neutral-300 sm:text-base lg:text-xl">
              Our night, through your photos
            </p>
          </div>
          <QrBlock />
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-4" aria-label="Photo slideshow">
          {photos.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/15 text-center text-lg text-neutral-300 lg:text-2xl">
              {loaded ? 'No photos yet. Scan the QR code to add the first one.' : 'Loading photos…'}
            </div>
          ) : (
            rows.map((row, i) => <Strip key={i} photos={row} reverse={i === 1} onOpen={setSelected} />)
          )}
        </section>

        <footer className="flex items-center justify-between gap-3 text-sm text-neutral-300">
          <span>Tap a photo to view or download it.</span>
          <Link
            href="/upload"
            className="rounded-full bg-[#f5c542] px-4 py-2 text-sm font-semibold text-black"
          >
            Upload photos
          </Link>
        </footer>
      </div>

      {photos.length > 0 && (
        <section className="px-4 pb-12 pt-4 lg:px-6" aria-label="All photos">
          <h2 className="mb-3 text-xl font-semibold">All photos ({photos.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="overflow-hidden rounded-xl bg-neutral-800 text-left"
              >
                <div className="aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(p.id)}
                    alt={`Photo uploaded by ${p.uploader}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="truncate px-2 py-1.5 text-xs">Uploaded by: {p.uploader}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {selected && <Lightbox photo={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
