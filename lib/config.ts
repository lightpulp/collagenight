// Shared constants (safe for browser and server). No secrets here.
export const EVENT_NAME = 'CCS College Night 2026';
export const MAX_PHOTOS = 10;
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const STUDENT_ID_REGEX = /^\d{2}-\d{4}-\d{3}$/;
export const POLL_SECONDS = Number(process.env.NEXT_PUBLIC_POLL_SECONDS) || 600;

export interface GalleryPhoto {
  id: string;
  uploader: string;
  createdTime: string;
}

// Uploaded files are shared as "anyone with the link" (unguessable IDs); the
// Drive account, folders and credentials are never exposed.
export const thumbUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w800`;
export const fullUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w2000`;
export const downloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;
