// Terapkan supabase/schema.sql ke database proyek. Kredensial dari .env.local (ditarik oleh `vercel env pull`).
// TLS diverifikasi penuh dengan CA Supabase: unduh dari dashboard Supabase > Database Settings > SSL Configuration,
// simpan sebagai supabase/ca.crt (sertifikat publik, bukan rahasia).
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const raw = process.env.POSTGRES_URL_NON_POOLING
if (!raw) throw new Error('POSTGRES_URL_NON_POOLING belum ada. Jalankan: vercel env pull .env.local --yes')

const ca = await readFile(new URL('../supabase/ca.crt', import.meta.url), 'utf8').catch(() => {
  throw new Error('supabase/ca.crt belum ada. Unduh CA dari dashboard Supabase > Database Settings > SSL Configuration.')
})
const url = new URL(raw)
url.searchParams.delete('sslmode') // sslmode di URL akan menimpa opsi ssl di bawah
const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } })
await client.connect()
try {
  await client.query(sql)
  const { rows } = await client.query(
    "select policyname from pg_policies where schemaname = 'public' and tablename = 'projects' order by 1",
  )
  console.log('Skema diterapkan. Policy:', rows.map((r) => r.policyname).join(', '))
} finally {
  await client.end()
}
