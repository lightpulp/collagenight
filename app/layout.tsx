import type { Metadata, Viewport } from 'next';
import './globals.css';
import { EVENT_NAME } from '@/lib/config';

export const metadata: Metadata = {
  title: EVENT_NAME,
  description: `Share and download photos from ${EVENT_NAME}.`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1020',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
