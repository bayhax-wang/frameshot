import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Frameshot - Video Frame Extraction API',
  description: 'Extract high-quality frames from any video URL or file. Fast, reliable video thumbnail generation with global CDN delivery.',
  keywords: 'video frames, thumbnail generation, video API, frame extraction, video processing',
  authors: [{ name: 'Frameshot' }],
  openGraph: {
    title: 'Frameshot - Video Frame Extraction API',
    description: 'Extract high-quality frames from any video URL or file',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frameshot - Video Frame Extraction API',
    description: 'Extract high-quality frames from any video URL or file',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}