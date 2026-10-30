import { create } from 'zustand'
import { emptyProject, parseProject, type Project } from './project'

const HISTORY_LIMIT = 100
const STORAGE_KEY = 'denahin:project'

type State = {
  project: Project
  past: Project[]
  future: Project[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
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

// Muat denah dari localStorage sekali, lalu simpan setiap ada perubahan.
// Data rusak tidak ditimpa: pengguna yang memutuskan lewat tampilan error.
export function startPersistence() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    useProject.getState().replace(raw ? parseProject(JSON.parse(raw)) : emptyProject())
  } catch (e) {
    useProject.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
  return useProject.subscribe((s, prev) => {
    if (s.status !== 'ready' || s.project === prev.project) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project))
    } catch {
      useProject.setState({ error: 'Gagal menyimpan ke browser. Perubahan terakhir belum tersimpan.' })
    }
  })
}

export function discardStoredProject() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
  useProject.getState().replace(emptyProject())
}
