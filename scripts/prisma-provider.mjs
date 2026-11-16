// Points prisma/schema.prisma at the right database engine based on DATABASE_URL,
// so the same code runs on a local SQLite file and on Neon Postgres (Vercel).
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Local runs read .env only (Vercel's pulled secrets are kept in .env.vercel, which nothing auto-loads).
function fromDotEnv(name) {
  for (const file of ['.env']) {
    if (!existsSync(file)) continue
    const m = readFileSync(file, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))
    if (m) return m[1]
  }
  return ''
}

const url = process.env.DATABASE_URL || fromDotEnv('DATABASE_URL')
const postgres = /^postgres(ql)?:\/\//.test(url)
const direct = postgres && (process.env.DATABASE_URL_UNPOOLED || fromDotEnv('DATABASE_URL_UNPOOLED'))

const path = 'prisma/schema.prisma'
const schema = readFileSync(path, 'utf8')
const block = [
  'datasource db {',
  `  provider = "${postgres ? 'postgresql' : 'sqlite'}"`,
  '  url      = env("DATABASE_URL")',
  ...(direct ? ['  directUrl = env("DATABASE_URL_UNPOOLED")'] : []),
  '}',
].join('\n')
const next = schema.replace(/datasource db \{[\s\S]*?\}/, block)
if (next !== schema) writeFileSync(path, next)
console.log(`prisma: using ${postgres ? 'postgresql (Neon)' : 'sqlite (local file)'}`)
