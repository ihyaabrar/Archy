'use client'

// Mode jalan orang pertama: W A S D, panah, seret untuk melihat, tombol sentuh, dan tur ruangan.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { levelsOf, onLevel, type Point, type Project } from '@/lib/project'
import { EYE, move, roomAt, startPoint } from '@/lib/walk'
import { footing, walkBlockers } from '@/lib/stairs'
import type { Props } from './View3D'

const SPEED = 1.8 // m/detik, kecepatan jalan santai
const TURN = 1.8 // rad/detik

// Berjalan di seluruh bangunan: lantai tempat berdiri dilacak sendiri, berpindah saat melewati tengah tangga.
export function Walk({ project, level, input, tour, onManual, onRoom, onLevel: onLevelChange }: Omit<Props, 'roof' | 'mode' | 'hour'> & { project: Project }) {
  const gl = useThree((s) => s.gl)
  const lvl = useRef(level)
  const pos = useRef<Point>(startPoint(onLevel(project, level)))
  const segs = useMemo(() => new Map(levelsOf(project).map((l) => [l.id, walkBlockers(project, l.id)])), [project])
  // Lantai dipilih dari luar (tombol lantai): mulai lagi dari titik awal lantai itu.
  useEffect(() => {
    if (level === lvl.current) return
    lvl.current = level
    pos.current = startPoint(onLevel(project, level))
  }, [level, project])
  const yaw = useRef(0)
  const pitch = useRef(0)
  const keys = useRef(new Set<string>())
  const room = useRef<string | null>(null)

  useEffect(() => {
    const el = gl.domElement
    let drag: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
    }
    const moveP = (e: PointerEvent) => {
      if (!drag) return
      yaw.current -= (e.clientX - drag.x) * 0.005
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (e.clientY - drag.y) * 0.005))
      drag = { x: e.clientX, y: e.clientY }
      onManual()
    }
    const up = () => (drag = null)
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey) return
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault()
        keys.current.add(k)
        onManual()
      }
    }
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', moveP)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', moveP)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
  }, [gl, onManual])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const k = keys.current
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + input.current.fwd
    const strafe = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0)
    yaw.current += ((k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0) - input.current.turn) * TURN * dt

    if (tour) {
      // Tur: meluncur halus ke titik ruangan berikutnya, tembus dinding karena ini perpindahan kamera, bukan berjalan.
      pos.current = [MathUtils.damp(pos.current[0], tour.pos[0], 3, dt), MathUtils.damp(pos.current[1], tour.pos[1], 3, dt)]
      const d = Math.atan2(Math.sin(tour.yaw - yaw.current), Math.cos(tour.yaw - yaw.current))
      yaw.current += d * (1 - Math.exp(-3 * dt))
      pitch.current = MathUtils.damp(pitch.current, 0, 3, dt)
    } else if (fwd || strafe) {
      const s = Math.sin(yaw.current)
      const c = Math.cos(yaw.current)
      const step = SPEED * dt
      const to: Point = [pos.current[0] + (-s * fwd + c * strafe) * step, pos.current[1] + (-c * fwd - s * strafe) * step]
      pos.current = move(pos.current, to, segs.get(lvl.current) ?? [])
    }

    const foot = footing(project, lvl.current, pos.current)
    if (foot.level !== lvl.current) {
      lvl.current = foot.level
      onLevelChange?.(foot.level)
    }
    camera.position.set(pos.current[0], foot.y + EYE, pos.current[1])
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ') // yaw dulu, lalu pitch: kepala tidak miring

    const name = roomAt(pos.current, onLevel(project, lvl.current).rooms)
    if (name !== room.current) onRoom((room.current = name))
  })

  return null
}
