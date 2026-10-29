import { NextResponse, connection } from 'next/server';
import type { GalleryPhoto } from '@/lib/config';
import { listGallery } from '@/lib/drive';


// Short server-side cache so many viewers cause at most ~1 Drive listing per minute.
const TTL_MS = 60_000;
let cache: { at: number; photos: GalleryPhoto[] } | null = null;
let inflight: Promise<GalleryPhoto[]> | null = null;

export async function GET() {
  await connection(); // always run at request time, never at build time
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      if (!inflight) inflight = listGallery().finally(() => (inflight = null));
      cache = { at: Date.now(), photos: await inflight };
    } catch (e) {
      console.error('photos failed', e);
      if (!cache) return NextResponse.json({ error: 'Could not load photos.' }, { status: 500 });
      // otherwise fall back to the last good list
    }
  }
  return NextResponse.json(
    { photos: cache ? cache.photos : [] },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  );
}
