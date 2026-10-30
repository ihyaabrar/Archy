'use client'

import { useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { BuildingScene } from './View3D'
import { keyframes, riseAt, sample } from '@/lib/presentation'
import type { Project } from '@/lib/project'

// Latar 3D halaman presentasi. Progres scroll dibaca lewat ref setiap frame, jadi scroll tidak memicu render React.
export default function PresentationScene({ project, progressRef, reduce }: { project: Project; progressRef: RefObject<number>; reduce: boolean }) {
  const levelRef = useRef(0)
  return (
    <Canvas className="present-canvas" shadows camera={{ fov: 45, near: 0.05, far: 500 }} aria-hidden>
      <BuildingScene project={project} roof={false} hour={9} level={levelRef} />
      <ScrollCamera project={project} progressRef={progressRef} levelRef={levelRef} reduce={reduce} />
    </Canvas>
  )
}

function ScrollCamera({ project, progressRef, levelRef, reduce }: { project: Project; progressRef: RefObject<number>; levelRef: RefObject<number>; reduce: boolean }) {
  const keys = useMemo(() => keyframes(project), [project])
  const look = useRef(new Vector3())
  const first = useRef(true)

  useFrame(({ camera }, rawDt) => {
    const t = progressRef.current
    const k = sample(keys, t, reduce)
    levelRef.current = riseAt(t, reduce)
    // Kamera mengejar posisi target dengan redaman: scroll roda yang patah-patah tetap terasa halus.
    const a = reduce || first.current ? 1 : 1 - Math.exp(-6 * Math.min(rawDt, 0.1))
    first.current = false
    camera.position.set(
      MathUtils.lerp(camera.position.x, k.pos[0], a),
      MathUtils.lerp(camera.position.y, k.pos[1], a),
      MathUtils.lerp(camera.position.z, k.pos[2], a),
    )
    look.current.lerp(new Vector3(...k.look), a)
    camera.lookAt(look.current)
  })
  return null
}
