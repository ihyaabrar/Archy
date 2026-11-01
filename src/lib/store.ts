import { create } from 'zustand'
import { emptyProject, parseProject, uid, type Project } from './project'
import { SHARE_PREFIX, decodeProject } from './share'

const HISTORY_LIMIT = 100
// Penyimpanan di browser: daftar proyek + isi tiap proyek di kunci sendiri,
// supaya proyek yang rusak tidak ikut merusak proyek lain.
const INDEX_KEY = 'denahin:projects'
const CURRENT_KEY = 'denahin:current'
const LEGACY_KEY = 'denahin:project' // format tahap 1-3: satu denah saja
const projectKey = (id: string) => `denahin:p:${id}`

export type ProjectMeta = { id: string; name: string; updatedAt: number; cloudId?: string }

type State = {
  project: Project
  past: Project[]
  future: Project[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  shared: boolean // denah dibuka dari tautan bagikan
  currentId: string | null
  projects: ProjectMeta[]
  // Setiap perubahan lewat sini supaya undo/redo selalu tercatat.
  apply: (fn: (p: Project) => Project) => void
  replace: (p: Project) => void
  undo: () => void
  redo: () => void
}

export const useProject = create<State>((set) => ({
  project: emptyProject(),
  past: [],
  future: [],
  status: 'loading',
  error: null,
  shared: false,
  currentId: null,
  projects: [],
  apply: (fn) =>
    set((s) => {
      const next = fn(s.project)
      if (next === s.project) return s
      return { project: next, past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] }
    }),
  replace: (project) => set({ project, past: [], future: [], status: 'ready', error: null }),
  undo: () =>
    set((s) =>
      s.past.length ? { project: s.past.at(-1)!, past: s.past.slice(0, -1), future: [s.project, ...s.future] } : s,
    ),
  redo: () =>
    set((s) =>
      s.future.length ? { project: s.future[0], past: [...s.past, s.project], future: s.future.slice(1) } : s,
    ),
}))

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const SAVE_FAILED = 'Gagal menyimpan ke browser. Perubahan terakhir belum tersimpan.'

function readIndex(): ProjectMeta[] {
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return []
  const list = JSON.parse(raw)
  if (!Array.isArray(list)) throw new Error('Daftar proyek rusak')
  return list.filter((m) => typeof m?.id === 'string' && typeof m?.name === 'string')
}

function writeIndex(list: ProjectMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
  useProject.setState({ projects: list })
}

// Pindahkan denah format lama ke daftar proyek, sekali saja.
function migrateLegacy(list: ProjectMeta[]) {
  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw || list.length) return list
  const id = uid()
  localStorage.setItem(projectKey(id), raw)
  const next = [{ id, name: 'Denah pertama', updatedAt: Date.now() }]
  writeIndex(next)
  localStorage.setItem(CURRENT_KEY, id)
  localStorage.removeItem(LEGACY_KEY)
  return next
}

// currentId dan isi diganti sekaligus, supaya penyimpan otomatis tidak menulis ulang proyek yang baru dibuka.
function openLocal(id: string) {
  localStorage.setItem(CURRENT_KEY, id)
  const raw = localStorage.getItem(projectKey(id))
  const project = raw ? parseProject(JSON.parse(raw)) : emptyProject()
  useProject.setState({ currentId: id, project, past: [], future: [], status: 'ready', error: null })
}

function loadLocal() {
  try {
    let list = migrateLegacy(readIndex())
    if (!list.length) {
      list = [{ id: uid(), name: 'Denah pertama', updatedAt: Date.now() }]
      writeIndex(list)
    }
    useProject.setState({ projects: list })
    const current = localStorage.getItem(CURRENT_KEY)
    openLocal(list.some((m) => m.id === current) ? current! : list[0].id)
  } catch (e) {
    useProject.setState({ status: 'error', error: message(e) })
  }
}

function save(id: string, p: Project) {
  try {
    localStorage.setItem(projectKey(id), JSON.stringify(p))
    writeIndex(useProject.getState().projects.map((m) => (m.id === id ? { ...m, updatedAt: Date.now() } : m)))
  } catch {
    useProject.setState({ error: SAVE_FAILED })
  }
}

// Muat denah (dari tautan bagikan kalau ada, kalau tidak dari localStorage), lalu simpan setiap ada perubahan.
// Data rusak tidak ditimpa: pengguna yang memutuskan lewat tampilan error.
// Denah kiriman tidak pernah disimpan otomatis, supaya tidak menimpa denah milik pengguna.
export function startPersistence() {
  if (location.hash.startsWith(SHARE_PREFIX)) {
    useProject.setState({ shared: true })
    try {
      useProject.setState({ projects: readIndex() })
    } catch {}
    decodeProject(location.hash.slice(SHARE_PREFIX.length))
      .then((p) => useProject.getState().replace(p))
      .catch((e) => {
        console.warn('Gagal membaca tautan denah:', e)
        useProject.setState({ status: 'error', error: 'Isi tautan denah rusak atau tidak lengkap' })
      })
  } else loadLocal()

  return useProject.subscribe((s, prev) => {
    if (s.status === 'ready' && !s.shared && s.currentId && s.project !== prev.project && s.currentId === prev.currentId)
      save(s.currentId, s.project)
  })
}

// Keluar dari mode denah kiriman (tanpa memuat apa pun).
function leaveSharedState() {
  if (!useProject.getState().shared) return
  history.replaceState(null, '', location.pathname + location.search)
  useProject.setState({ shared: false })
}

// Simpan denah dari luar (tautan kiriman, file, atau cloud) sebagai proyek baru. Proyek yang ada tidak disentuh.
export function addProject(p: Project, name: string, cloudId?: string): string | null {
  const id = uid()
  try {
    localStorage.setItem(projectKey(id), JSON.stringify(p))
    writeIndex([{ id, name, updatedAt: Date.now(), ...(cloudId && { cloudId }) }, ...useProject.getState().projects])
    leaveSharedState()
    openLocal(id)
    return id
  } catch {
    useProject.setState({ error: SAVE_FAILED })
    return null
  }
}

// Baca isi proyek tanpa membukanya (untuk pratinjau di dashboard). Rusak atau tidak ada = null.
export function readProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(projectKey(id))
    return raw ? parseProject(JSON.parse(raw)) : emptyProject()
  } catch {
    return null
  }
}

export function setCloudId(id: string, cloudId: string | undefined) {
  try {
    writeIndex(useProject.getState().projects.map((m) => (m.id === id ? { ...m, cloudId } : m)))
  } catch {
    useProject.setState({ error: SAVE_FAILED })
  }
}

// Buka versi cloud: salinan lokal yang tertaut diganti isinya, atau dibuat baru kalau belum ada.
export function openFromCloud(cloudId: string, name: string, p: Project) {
  const local = useProject.getState().projects.find((m) => m.cloudId === cloudId)
  if (!local) return addProject(p, name, cloudId)
  try {
    localStorage.setItem(projectKey(local.id), JSON.stringify(p))
    writeIndex(useProject.getState().projects.map((m) => (m.id === local.id ? { ...m, name } : m)))
    leaveSharedState()
    openLocal(local.id)
  } catch {
    useProject.setState({ error: SAVE_FAILED })
  }
}

export const adoptShared = () => addProject(useProject.getState().project, 'Denah kiriman')

// Tinggalkan denah kiriman dan buka denah milik pengguna.
export function leaveShared() {
  leaveSharedState()
  loadLocal()
}

export const newProject = (name: string) => addProject(emptyProject(), name)

export function openProject(id: string) {
  try {
    leaveSharedState()
    openLocal(id)
  } catch (e) {
    useProject.setState({ status: 'error', error: message(e), currentId: id })
  }
}

export function renameProject(id: string, name: string) {
  try {
    writeIndex(useProject.getState().projects.map((m) => (m.id === id ? { ...m, name } : m)))
  } catch {
    useProject.setState({ error: SAVE_FAILED })
  }
}

// Hapus proyek dari browser ini. Kalau yang dihapus sedang terbuka, buka proyek lain (atau buat baru).
export function deleteProject(id: string) {
  try {
    localStorage.removeItem(projectKey(id))
    const rest = useProject.getState().projects.filter((m) => m.id !== id)
    writeIndex(rest)
    if (useProject.getState().currentId !== id) return
    if (rest.length) openLocal(rest[0].id)
    else newProject('Denah baru')
  } catch {
    useProject.setState({ error: SAVE_FAILED })
  }
}

// Dipakai tampilan error: buang isi proyek yang rusak, proyek lain tetap aman.
export function discardStoredProject() {
  const id = useProject.getState().currentId
  try {
    if (id) localStorage.removeItem(projectKey(id))
    else localStorage.removeItem(INDEX_KEY)
  } catch {}
  loadLocal()
}
