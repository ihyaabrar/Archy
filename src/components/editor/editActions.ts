// Aksi edit elemen terpilih, dipakai pintasan keyboard editor dan tombol inspector.

import { type Selection } from './PlanCanvas'
import { useProject } from '@/lib/store'
import { clampOpening, duplicate, moveNote, translateWall, type Point, type Project } from '@/lib/project'

// Putar furnitur terpilih, atau arah taruh berikutnya kalau belum ada yang dipilih.
export const turn = (rot: number, by: number) => (((rot + by) % 360) + 360) % 360

// Salinan bergeser 0,5 m supaya terlihat terpisah dari aslinya, lalu salinan itu yang terpilih.
export function duplicateSelected(sel: NonNullable<Selection>, select: (s: Selection) => void) {
  if (sel.kind === 'opening') return
  let id: string | null = null
  useProject.getState().apply((p) => {
    const r = duplicate(p, sel.kind as 'wall' | 'room' | 'furniture' | 'note', sel.id, [0.5, 0.5])
    id = r?.id ?? null
    return r?.project ?? p
  })
  if (id) select({ kind: sel.kind, id })
}

export function rotateFurniture(id: string, by: number) {
  useProject.getState().apply((p) => ({ ...p, furniture: p.furniture.map((f) => (f.id === id ? { ...f, rot: turn(f.rot, by) } : f)) }))
}

export function removeSelected(p: ReturnType<typeof useProject.getState>['project'], sel: NonNullable<Selection>) {
  if (sel.kind === 'wall')
    return { ...p, walls: p.walls.filter((w) => w.id !== sel.id), openings: p.openings.filter((o) => o.wallId !== sel.id) }
  if (sel.kind === 'opening') return { ...p, openings: p.openings.filter((o) => o.id !== sel.id) }
  if (sel.kind === 'furniture') return { ...p, furniture: p.furniture.filter((f) => f.id !== sel.id) }
  if (sel.kind === 'note') return { ...p, notes: p.notes?.filter((n) => n.id !== sel.id) }
  return { ...p, rooms: p.rooms.filter((r) => r.id !== sel.id) }
}

// Geser elemen terpilih sejauh d (meter) dari keyboard. Pintu/jendela bergeser sepanjang dindingnya:
// panah kanan/bawah menambah jarak dari ujung awal dinding, kiri/atas mengurangi.
export function nudge(p: Project, sel: NonNullable<Selection>, d: Point): Project {
  const add = (q: Point): Point => [Math.round((q[0] + d[0]) * 1000) / 1000, Math.round((q[1] + d[1]) * 1000) / 1000]
  switch (sel.kind) {
    case 'wall':
      return translateWall(p, sel.id, d)
    case 'furniture':
      return { ...p, furniture: p.furniture.map((f) => (f.id === sel.id ? { ...f, pos: add(f.pos) } : f)) }
    case 'room':
      return { ...p, rooms: p.rooms.map((r) => (r.id === sel.id ? { ...r, points: r.points.map(add) } : r)) }
    case 'note':
      return { ...p, notes: p.notes?.map((n) => (n.id === sel.id ? moveNote(n, d) : n)) }
    case 'opening':
      return {
        ...p,
        openings: p.openings.map((o) => {
          const w = p.walls.find((x) => x.id === o.wallId)
          return o.id === sel.id && w ? { ...o, at: clampOpening(o.at + d[0] + d[1], o.width, w) } : o
        }),
      }
  }
}
