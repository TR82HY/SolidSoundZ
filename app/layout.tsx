import './globals.css'
import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono, Space_Grotesk } from 'next/font/google'
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

const bodyFont = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-body' })
const displayFont = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-display' })
const monoFont = DM_Mono({ weight: ['400', '500'], subsets: ['latin'], display: 'swap', variable: '--font-mono' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_TAGLINE,
  icons: { icon: [
    { url: '/brand/solidsoundz-mark.svg', type: 'image/svg+xml', sizes: 'any', media: '(prefers-reduced-motion: no-preference)' },
    { url: '/brand/solidsoundz-mark-static.svg', type: 'image/svg+xml', sizes: 'any', media: '(prefers-reduced-motion: reduce)' },
  ] },
  openGraph: { siteName: SITE_NAME, type: 'website', title: SITE_NAME, description: SITE_TAGLINE },
  twitter: { card: 'summary', title: SITE_NAME, description: SITE_TAGLINE },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
      <body className="bg-[#0a0a0a] text-white min-h-screen antialiased">
        <aside role="status" className="border-b border-[#d8ff16]/40 bg-[#151b10] px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#e7f0df]">
          Beta build: SolidSoundZ is actively developing. Features and performance are improving every week.
        </aside>
        {children}
      </body>
    </html>
  )
}
