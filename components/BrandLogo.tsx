import Image from 'next/image'

const ASSETS = {
  wordmark: { src: '/brand/solidsoundz-wordmark.svg', staticSrc: '/brand/solidsoundz-wordmark-static.svg', width: 262, height: 64 },
  mark: { src: '/brand/solidsoundz-mark.svg', staticSrc: '/brand/solidsoundz-mark-static.svg', width: 64, height: 64 },
}

export default function BrandLogo({ variant = 'wordmark', className = '', priority = false }: {
  variant?: keyof typeof ASSETS, className?: string, priority?: boolean,
}) {
  const asset = ASSETS[variant]
  return <picture className="block">
    <source media="(prefers-reduced-motion: reduce)" srcSet={asset.staticSrc} />
    <Image src={asset.src} width={asset.width} height={asset.height} alt="SolidSoundZ" className={`block ${className}`} priority={priority} unoptimized />
  </picture>
}
