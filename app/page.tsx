'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import {
  EVENT_NAME,
  POLL_SECONDS,
  downloadUrl,
  fullUrl,
  thumbUrl,
  type GalleryPhoto,
} from '@/lib/config';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'] });
const body = Jost({ subsets: ['latin'], weight: ['400', '500', '600'] });

/*
  OPTIONAL IMAGE SLOTS (drop files into /public/theme/ - the design works without them):
    /theme/hero.jpg   -> faint backdrop behind the header (stage, dance floor, crowd, lights)
    /qr.png           -> your upload QR code
*/

const CSS = `
  .gold-text{background:linear-gradient(180deg,#f6e3b4 0%,#d9b26a 55%,#a97c3a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .velvet{background:
    repeating-linear-gradient(90deg,rgba(0,0,0,.45) 0,rgba(0,0,0,0) 10px,rgba(255,80,100,.10) 18px,rgba(0,0,0,.45) 28px),
    linear-gradient(180deg,#8f1226,#5c0b19 60%,#3a0610)}
  .twinkle{animation:twinkle 4s ease-in-out infinite}
  @keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
  @media (prefers-reduced-motion:reduce){.twinkle{animation:none}}
`;

function Star({ className = '', size = 14 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.8 6.5 5.5 11.2 12 12-6.5.8-11.2 5.5-12 12-.8-6.5-5.5-11.2-12-12 6.5-.8 11.2-5.5 12-12z" fill="#e8c77f" />
    </svg>
  );
}

function Ornament() {
  return (
    <svg viewBox="0 0 220 16" className="mx-auto h-3 w-40 sm:w-56" aria-hidden="true">
      <path d="M0 8h88M132 8h88" stroke="#d9b26a" strokeWidth="1" opacity=".7" />
      <path d="M110 1l7 7-7 7-7-7z" fill="none" stroke="#e8c77f" strokeWidth="1.2" />
      <circle cx="94" cy="8" r="1.5" fill="#e8c77f" />
      <circle cx="126" cy="8" r="1.5" fill="#e8c77f" />
    </svg>
  );
}

function Curtains() {
  return (
    <>
      {/* side drapes */}
      <div
        aria-hidden="true"
        className="velvet pointer-events-none absolute inset-y-0 left-0 z-20 w-5 shadow-[8px_0_30px_rgba(0,0,0,.8)] sm:w-10 lg:w-20"
        style={{ clipPath: 'polygon(0 0,100% 0,70% 50%,100% 100%,0 100%)' }}
      />
      <div
        aria-hidden="true"
        className="velvet pointer-events-none absolute inset-y-0 right-0 z-20 w-5 shadow-[-8px_0_30px_rgba(0,0,0,.8)] sm:w-10 lg:w-20"
        style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%,30% 50%)' }}
      />
    </>
  );
}

function QrTicket() {
  // Put your QR code image at public/qr.png. Until then a placeholder is shown.
  const [hasQr, setHasQr] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasQr(true);
    img.onerror = () => setHasQr(false);
    img.src = '/qr.png';
  }, []);
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[#d9b26a]/50 bg-[#f4e9d8] p-2 pr-4 text-[#2a0a10] shadow-[0_10px_40px_rgba(0,0,0,.6)] lg:gap-4 lg:p-3 lg:pr-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white p-1 sm:h-24 sm:w-24 lg:h-32 lg:w-32">
        {hasQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/qr.png" alt="QR code linking to the upload page" className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-[10px] font-semibold leading-tight text-neutral-500">
            QR code
            <br />
            (add public/qr.png)
          </span>
        )}
      </div>
      <div className="border-l border-dashed border-[#2a0a10]/40 pl-3 lg:pl-4">
        <p className={`${display.className} text-xl font-bold italic leading-none lg:text-3xl`}>Add yours</p>
        <p className="mt-1 text-xs leading-snug text-[#2a0a10]/75 lg:text-sm">
          Scan to share
          <br />
          your photos
        </p>
      </div>
    </div>
  );
}

function PhotoCard({ photo, onOpen, tilt }: { photo: GalleryPhoto; onOpen: () => void; tilt: number }) {
  return (
    <button
      onClick={onOpen}
      style={{ transform: `rotate(${tilt}deg)` }}
      className="group relative flex aspect-[5/4] h-full shrink-0 flex-col rounded-[3px] bg-[#f4e9d8] p-1.5 pb-0 text-left shadow-[0_8px_24px_rgba(0,0,0,.65)] transition-transform duration-300 hover:z-10 hover:!rotate-0 hover:scale-[1.04] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e8c77f]"
    >
      <div className="min-h-0 flex-1 overflow-hidden bg-[#2a0a10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl(photo.id)}
          alt={`Photo uploaded by ${photo.uploader}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
      <span className={`${display.className} truncate px-1 py-1 text-sm font-semibold italic text-[#2a0a10] sm:text-base lg:text-lg`}>
        by {photo.uploader}
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
  const tilts = [-1.5, 1, -0.5, 1.5, -1, 0.5];
  return (
    <div className="marquee-row min-h-0 flex-1 overflow-hidden py-1.5">
      <div
        className="marquee-track h-full"
        style={{ animationName: reverse ? 'marquee-right' : 'marquee-left', animationDuration: `${duration}s` }}
      >
        {[0, 1].map((half) => (
          <div key={half} className="flex h-full shrink-0 gap-5 pr-5">
            {items.map((p, i) => (
              <PhotoCard key={`${half}-${i}-${p.id}`} photo={p} tilt={tilts[i % tilts.length]} onOpen={() => onOpen(p)} />
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#080204]/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="rounded-[3px] bg-[#f4e9d8] p-2 shadow-[0_20px_80px_rgba(179,18,43,.35)]" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fullUrl(photo.id)}
          alt={`Photo uploaded by ${photo.uploader}`}
          referrerPolicy="no-referrer"
          className="max-h-[70vh] max-w-full object-contain"
        />
        <p className={`${display.className} px-1 pt-2 text-xl font-semibold italic text-[#2a0a10]`}>by {photo.uploader}</p>
      </div>
      <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
        <a
          href={downloadUrl(photo.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-gradient-to-b from-[#f0d595] to-[#c9993f] px-6 py-2.5 font-semibold text-[#2a0a10]"
        >
          Download photo
        </a>
        <button onClick={onClose} className="rounded-full border border-[#e8c77f]/60 px-6 py-2.5 font-semibold text-[#f4e9d8]">
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
    <main className={`${body.className} min-h-screen bg-[#0b0507] text-[#f4e9d8]`}>
      <style>{CSS}</style>

      <div className="relative flex h-[100svh] flex-col gap-3 overflow-hidden px-8 pb-3 pt-4 sm:px-14 lg:gap-4 lg:px-28 lg:pb-4 lg:pt-6">
        {/* backdrop: optional photo + spotlight + vignette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/theme/hero.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% 0%,rgba(190,25,50,.55),transparent 70%),radial-gradient(ellipse at 50% 120%,rgba(120,10,30,.5),transparent 60%)',
          }}
        />
        <Curtains />

        {/* sparkles */}
        <Star className="twinkle absolute left-[18%] top-6 z-10" size={12} />
        <Star className="twinkle absolute right-[22%] top-10 z-10" size={18} />
        <Star className="twinkle absolute left-[30%] top-16 z-10 hidden lg:block" size={10} />
        <Star className="twinkle absolute right-[34%] top-5 z-10 hidden lg:block" size={10} />

        <header className="relative z-10 flex flex-col items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="hidden lg:block" />
          <div className="text-center">
            <p className={`${display.className} text-lg italic text-[#e8c77f] sm:text-2xl`}>College Night</p>
            <h1
              className={`${display.className} gold-text text-4xl font-bold leading-[0.95] sm:text-6xl lg:text-8xl`}
            >
              {EVENT_NAME}
            </h1>
            <div className="mt-2 lg:mt-3">
              <Ornament />
            </div>
            <p className="mt-2 text-xs tracking-wide text-[#f4e9d8]/80 sm:text-base lg:text-lg">
              Our night, through your photos
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <QrTicket />
          </div>
        </header>

        <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 lg:gap-2" aria-label="Photo slideshow">
          {photos.length === 0 ? (
            <div
              className={`${display.className} flex flex-1 items-center justify-center rounded-2xl border border-[#d9b26a]/40 bg-black/30 px-6 text-center text-2xl italic text-[#f4e9d8]/85 lg:text-4xl`}
            >
              {loaded ? 'The night is just starting. Scan the code to add the first photo.' : 'Setting the stage…'}
            </div>
          ) : (
            rows.map((row, i) => <Strip key={i} photos={row} reverse={i === 1} onOpen={setSelected} />)
          )}
        </section>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xl text-[#f4e9d8]/80 sm:text-sm">
          <span>Tap a photo to view or download it.</span>
          <span className={`${display.className} text-sm italic text-[#e8c77f] sm:text-base`}>
            Built by MSD-2026
          </span>
          <Link
            href="/upload"
            className="rounded-full bg-gradient-to-b from-[#f0d595] to-[#c9993f] px-5 py-2 text-sm font-semibold text-[#2a0a10] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          >
            Upload photos
          </Link>
        </footer>
      </div>

      {photos.length > 0 && (
        <section className="relative px-8 pb-16 pt-10 sm:px-14 lg:px-28" aria-label="All photos">
          <div className="mb-6 text-center">
            <h2 className={`${display.className} gold-text text-3xl font-bold sm:text-5xl`}>The full gallery</h2>
            <div className="mt-2">
              <Ornament />
            </div>
            <p className="mt-2 text-sm text-[#f4e9d8]/75">{photos.length} photos so far</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="rounded-[3px] bg-[#f4e9d8] p-1.5 text-left shadow-[0_6px_18px_rgba(0,0,0,.6)] transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e8c77f]"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#2a0a10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(p.id)}
                    alt={`Photo uploaded by ${p.uploader}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className={`${display.className} truncate px-1 pb-0.5 pt-1.5 text-base font-semibold italic text-[#2a0a10]`}>
                  by {p.uploader}
                </p>
              </button>
            ))}
          </div>
          <p className={`${display.className} mt-12 text-center text-base italic text-[#e8c77f]`}>
            Built by MSD-2026</p>
        </section>
      )}

      {selected && <Lightbox photo={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}