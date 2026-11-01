'use client'

import { useLayoutEffect, useMemo, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { bounds } from '@/lib/mesh'
import { useProject } from '@/lib/store'
import { upTo, type Point } from '@/lib/project'
import { BuildingScene } from './BuildingScene'
import { Walk } from './Walk'

const webglOk = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export type WalkInput = { fwd: number; turn: number } // diisi tombol sentuh, -1..1
export type TourStop = { pos: Point; yaw: number } | null

export type Props = {
  level: string // lantai aktif: tampil sampai lantai ini, berjalan di lantai ini
  roof: boolean
  lamps?: boolean // satu lampu plafon per ruangan
  hour: number // jam, 6 sampai 21; lewat 18 matahari sudah terbenam
  mode: 'orbit' | 'walk'
  input: RefObject<WalkInput>
  tour: TourStop
  onManual: () => void
  onRoom: (name: string | null) => void
  onLevel?: (id: string) => void // lantai berpindah karena naik/turun tangga di mode jalan
}

export default function View3D({ level, roof, lamps, hour, mode, input, tour, onManual, onRoom, onLevel: onLevelChange }: Props) {
  const full = useProject((s) => s.project)
  const project = useMemo(() => upTo(full, level), [full, level])
  const { center, size } = useMemo(() => bounds(project), [project])

  if (!webglOk())
    return (
      <div className="view3d-msg" role="alert">
        <p className="stencil">Tampilan 3D tidak bisa dibuka</p>
        <p>Browser atau kartu grafis ini tidak mendukung WebGL 2. Coba buka Denahin di Chrome, Edge, atau Firefox versi terbaru.</p>
      </div>
    )

  if (!project.walls.length)
    return (
      <div className="view3d-msg">
        <p className="stencil">Belum ada yang bisa dibangun</p>
        <p>Kembali ke 2D dan gambar dinding dulu. Tampilan 3D dibangun dari dinding, pintu, jendela, dan ruangan di denah.</p>
      </div>
    )

  return (
    <Canvas
      className="view3d"
      shadows
      camera={{ fov: 50, near: 0.05, far: 500 }}
      aria-label={
        mode === 'walk'
          ? 'Mode jalan. W, A, S, D atau panah untuk bergerak, seret untuk melihat sekeliling.'
          : 'Tampilan 3D bangunan. Seret untuk memutar, gulir untuk memperbesar.'
      }
    >
      <BuildingScene project={project} roof={roof} lamps={lamps} hour={hour} />
      {mode === 'orbit' ? (
        <Orbit center={center} size={size} />
      ) : (
        <Walk project={full} level={level} input={input} tour={tour} onManual={onManual} onRoom={onRoom} onLevel={onLevelChange} />
      )}
    </Canvas>
  )
}

function Orbit({ center, size }: { center: Point; size: number }) {
  const camera = useThree((s) => s.camera)
  // Kamera serong dari depan-kanan, cukup jauh agar seluruh denah masuk bingkai. Diset ulang tiap kembali dari mode jalan.
  useLayoutEffect(() => {
    camera.position.set(center[0] + size * 1.2, size * 1.3, center[1] + size * 1.6)
  }, [camera, center, size])
  return <OrbitControls target={[center[0], 1, center[1]]} maxPolarAngle={Math.PI / 2.05} minDistance={2} maxDistance={size * 5} makeDefault />
}

