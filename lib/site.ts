export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const SITE_NAME = 'SolidSoundZ'
export const SITE_TAGLINE = 'Stream new music free. Upload, master and share your tracks.'
