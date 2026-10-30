// Akun dan penyimpanan cloud (Supabase). Proyek tetap tersimpan lokal lebih dulu;
// proyek yang ditautkan ke cloud diunggah otomatis sesaat setelah berubah.
// Keamanan data ada di database (RLS per pemilik, lihat supabase/schema.sql), bukan di kode ini.

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { parseProject, type Project } from './project'
import { setCloudId, useProject, type ProjectMeta } from './store'

type Row = { id: string; name: string; updated_at: string }
export type CloudProject = { id: string; name: string; updatedAt: string }

let client: SupabaseClient | null | undefined
// Kunci publishable boleh ada di browser. Kunci secret/service role tidak pernah dipakai di sini.
export function supabase() {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    client = url && key ? createClient(url, key) : null
  }
  return client
}

export const useCloud = create<{
  ready: boolean
  session: Session | null
  sync: 'idle' | 'saving' | 'saved' | 'error'
  syncError: string | null
}>(() => ({ ready: false, session: null, sync: 'idle', syncError: null }))

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(translate(e.message))
}

// Pesan Supabase umum dalam bahasa pengguna; sisanya ditampilkan apa adanya.
function translate(m: string) {
  if (/invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.'
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Buka tautan di email pendaftaran dulu.'
  if (/already registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.'
  if (/password should be at least/i.test(m)) return 'Kata sandi minimal 6 karakter.'
  if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
  if (/could not find the table|relation .* does not exist/i.test(m))
    return 'Penyimpanan cloud belum disiapkan (skema database belum diterapkan). Proyek tetap aman di browser ini.'
  if (/failed to fetch|network/i.test(m)) return 'Tidak tersambung ke server. Periksa koneksi internet.'
  return m
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase()!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
  fail(error)
  return { needsConfirm: !data.session }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase()!.auth.signInWithPassword({ email, password })
  fail(error)
}

export async function signOut() {
  fail((await supabase()!.auth.signOut()).error)
}

export async function listCloud(): Promise<CloudProject[]> {
  const { data, error } = await supabase()!.from('projects').select('id,name,updated_at').order('updated_at', { ascending: false })
  fail(error)
  return (data as Row[]).map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }))
}

export async function loadCloud(id: string): Promise<Project> {
  const { data, error } = await supabase()!.from('projects').select('data').eq('id', id).single()
  fail(error)
  return parseProject(data?.data) // data dari server tetap divalidasi sebelum dipakai
}

// Unggah proyek. Kalau baris cloud-nya sudah dihapus di perangkat lain, dibuat baris baru.
export async function pushCloud(cloudId: string | undefined, name: string, p: Project): Promise<string> {
  const db = supabase()!.from('projects')
  if (cloudId) {
    const { data, error } = await db.update({ name, data: p, updated_at: new Date().toISOString() }).eq('id', cloudId).select('id')
    fail(error)
    if (data?.length) return cloudId
  }
  const { data, error } = await db.insert({ name, data: p }).select('id').single()
  fail(error)
  if (!data) throw new Error('Server tidak mengembalikan id proyek')
  return data.id as string
}

export async function deleteCloud(id: string) {
  fail((await supabase()!.from('projects').delete().eq('id', id)).error)
}

async function pushMeta(meta: ProjectMeta, project: Project) {
  useCloud.setState({ sync: 'saving', syncError: null })
  try {
    const id = await pushCloud(meta.cloudId, meta.name, project)
    if (id !== meta.cloudId) setCloudId(meta.id, id)
    useCloud.setState({ sync: 'saved' })
  } catch (e) {
    useCloud.setState({ sync: 'error', syncError: (e as Error).message })
    throw e
  }
}

// Tautkan proyek yang sedang terbuka ke cloud (unggah pertama kali).
export async function linkCurrentToCloud() {
  const { currentId, projects, project } = useProject.getState()
  const meta = projects.find((m) => m.id === currentId)
  if (meta) await pushMeta(meta, project)
}

const DEBOUNCE_MS = 1500

// Pantau sesi login dan unggah otomatis proyek tertaut setelah berhenti mengedit sebentar.
export function startCloudSync() {
  const sb = supabase()
  if (!sb) {
    useCloud.setState({ ready: true })
    return () => {}
  }
  sb.auth.getSession().then(({ data }) => useCloud.setState({ ready: true, session: data.session }))
  const { data: auth } = sb.auth.onAuthStateChange((_, session) => useCloud.setState({ session }))

  // Unggahan tertunda memegang proyek dan isinya sendiri, jadi pindah proyek tidak mengunggah isi yang salah.
  let pending: { timer: ReturnType<typeof setTimeout>; run: () => void } | null = null
  const flush = () => {
    if (!pending) return
    clearTimeout(pending.timer)
    pending.run()
  }
  const unsub = useProject.subscribe((s, prev) => {
    if (s.currentId !== prev.currentId) return flush()
    const meta = s.projects.find((m) => m.id === s.currentId)
    const changed = s.project !== prev.project || meta?.name !== prev.projects.find((m) => m.id === s.currentId)?.name
    if (!meta?.cloudId || s.shared || !changed || !useCloud.getState().session) return
    if (pending) clearTimeout(pending.timer)
    useCloud.setState({ sync: 'saving', syncError: null })
    const run = () => {
      pending = null
      pushMeta(meta, s.project).catch(() => {}) // status error sudah dicatat di useCloud
    }
    pending = { timer: setTimeout(run, DEBOUNCE_MS), run }
  })
  addEventListener('pagehide', flush)
  return () => {
    flush()
    removeEventListener('pagehide', flush)
    unsub()
    auth.subscription.unsubscribe()
  }
}
