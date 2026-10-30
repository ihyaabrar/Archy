'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, MathUtils, Object3D, RepeatWrapping, SRGBColorSpace, Shape, type Group } from 'three'
import { bounds, buildPieces, type Piece } from '@/lib/mesh'
import { DEFAULT_FLOOR, DEFAULT_WALL, paint, repeatSize, type FloorKey, type TextureKey, type WallKey } from '@/lib/materials'
import { DEFAULT_ROOF, roofMesh, type Roof, type Tri } from '@/lib/roof'
import { useProject } from '@/lib/store'
import { elevationOf, levelOf, levelsOf, onLevel, upTo, type Point, type Project, type Room } from '@/lib/project'
import { EYE, blockers, move, roomAt, startPoint } from '@/lib/walk'

// Warna dari DESIGN.md: badan bangunan kertas, garis tepi tinta, supaya 3D tetap terbaca seperti gambar.
const PAPER = '#f3eee3'
const INK = '#2a2420'
const FURNITURE = '#d6c8b0' // sedikit lebih gelap dari dinding supaya terbaca sebagai benda di dalam ruang
const DOOR = '#9c7652' // daun pintu kayu, kontras dengan dinding putih maupun bata

const webglOk = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export type WalkInput = { fwd: number; turn: number } // diisi tombol sentuh, -1..1
export type TourStop = { pos: Point; yaw: number } | null

type Props = {
  level: string // lantai aktif: tampil sampai lantai ini, berjalan di lantai ini
  roof: boolean
  hour: number // jam matahari, 6 sampai 18
  mode: 'orbit' | 'walk'
  input: RefObject<WalkInput>
  tour: TourStop
  onManual: () => void
  onRoom: (name: string | null) => void
}

export default function View3D({ level, roof, hour, mode, input, tour, onManual, onRoom }: Props) {
  const full = useProject((s) => s.project)
  const project = useMemo(() => upTo(full, level), [full, level])
  const here = useMemo(() => onLevel(full, level), [full, level])
  const elev = elevationOf(full, level)
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
      <BuildingScene project={project} roof={roof} hour={hour} />
      {mode === 'orbit' ? (
        <Orbit center={center} size={size} />
      ) : (
        <Walk key={level} project={here} elev={elev} input={input} tour={tour} onManual={onManual} onRoom={onRoom} />
      )}
    </Canvas>
  )
}

// Isi adegan (cahaya, bangunan, tanah) tanpa kamera: dipakai editor 3D dan halaman presentasi.
// `level` (0..1) mengendalikan tinggi bangunan dari luar; tanpa itu bangunan naik sendiri sekali saat dibuka.
export function BuildingScene({ project, roof, hour, level }: { project: Project; roof: boolean; hour: number; level?: RefObject<number> }) {
  const pieces = useMemo(() => buildPieces(project), [project])
  const { center, size } = useMemo(() => bounds(project), [project])
  // Atap hanya di lantai teratas yang tampil; lantai di bawahnya tertutup pelat lantai atas.
  const top = levelsOf(project).filter((l) => project.walls.some((w) => levelOf(project, w) === l.id)).reduce((a, l) => (l.elevation > a.elevation ? l : a), levelsOf(project)[0])
  const topWalls = project.walls.filter((w) => levelOf(project, w) === top.id)
  const roofY = top.elevation + Math.max(0, ...topWalls.map((w) => w.height))
  const wall = project.wallFinish ?? DEFAULT_WALL

  return (
    <>
      <color attach="background" args={[PAPER]} />
      <Sun hour={hour} center={center} size={size} />

      <Rise level={level}>
        {pieces.map((p, i) =>
          p.kind === 'wall' ? (
            <WallMesh key={i} piece={p} finish={wall} />
          ) : (
            <mesh key={i} position={p.center} rotation={[0, p.rotY, 0]} castShadow={p.kind !== 'glass'} receiveShadow>
              <boxGeometry args={p.size} />
              {p.kind === 'glass' ? (
                <meshStandardMaterial color="#9fb7bf" transparent opacity={0.35} />
              ) : (
                <meshStandardMaterial color={p.kind === 'door' ? DOOR : FURNITURE} />
              )}
              <Edges color={INK} />
            </mesh>
          ),
        )}
        {project.rooms.map((r) => (
          <RoomFloor key={r.id} room={r} elev={elevationOf(project, levelOf(project, r))} />
        ))}
        {roof &&
          ((project.roof ?? DEFAULT_ROOF).type === 'datar' ? (
            project.rooms.filter((r) => levelOf(project, r) === top.id).map((r) => <Slab key={'roof' + r.id} points={r.points} y={roofY} color={PAPER} thick={0.15} />)
          ) : (
            <PitchedRoof project={project} roof={project.roof ?? DEFAULT_ROOF} finish={wall} />
          ))}
      </Rise>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.01, center[1]]} receiveShadow>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color="#ebe4d6" />
      </mesh>
    </>
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

const SPEED = 1.8 // m/detik, kecepatan jalan santai
const TURN = 1.8 // rad/detik

function Walk({ project, elev, input, tour, onManual, onRoom }: Omit<Props, 'roof' | 'mode' | 'hour' | 'level'> & { project: Project; elev: number }) {
  const segs = useMemo(() => blockers(project), [project])
  const gl = useThree((s) => s.gl)
  const pos = useRef<Point>(startPoint(project))
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
      pos.current = move(pos.current, to, segs)
    }

    camera.position.set(pos.current[0], elev + EYE, pos.current[1])
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ') // yaw dulu, lalu pitch: kepala tidak miring

    const name = roomAt(pos.current, project.rooms)
    if (name !== room.current) onRoom((room.current = name))
  })

  return null
}

// Bangunan naik dari denah datar saat tampilan 3D dibuka: menunjukkan bahwa 3D ini adalah denah yang sama.
// Dengan `level`, tinggi diatur dari luar (halaman presentasi mengikutinya ke progres scroll).
function Rise({ children, level }: { children: React.ReactNode; level?: RefObject<number> }) {
  const ref = useRef<Group>(null)
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  // Skala awal diset sekali saat dipasang, bukan lewat prop, supaya edit berikutnya tidak memutar ulang animasi.
  useLayoutEffect(() => {
    if (ref.current && !reduce && !level) ref.current.scale.y = 0.001
  }, [reduce, level])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    if (level) {
      g.scale.y = Math.max(0.001, level.current) // skala 0 membuat matriks rusak; 0,001 tetap tampak datar
      return
    }
    if (g.scale.y === 1) return
    g.scale.y = g.scale.y > 0.999 ? 1 : MathUtils.damp(g.scale.y, 1, 4, dt)
  })
  return <group ref={ref}>{children}</group>
}

// Lantai dasar tipis di muka tanah; lantai atas berupa pelat 15 cm yang bagian atasnya rata dengan elevasi lantai.
function RoomFloor({ room, elev }: { room: Room; elev: number }) {
  const floor = room.floor ?? DEFAULT_FLOOR
  return elev > 0 ? <Slab points={room.points} y={elev - 0.15} floor={floor} thick={0.15} /> : <Slab points={room.points} y={0.005} floor={floor} />
}

// Lantai atau atap dari poligon ruangan. Shape di bidang XY, diputar ke bidang lantai (z = y denah).
// UV ShapeGeometry = koordinat meter, jadi tekstur lantai tampil seukuran aslinya.
function Slab({ points, y, color, floor, thick }: { points: Point[]; y: number; color?: string; floor?: FloorKey; thick?: number }) {
  const shape = useMemo(() => {
    const s = new Shape()
    points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)))
    return s
  }, [points])
  const map = floor ? texture(floor) : null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow castShadow={!!thick}>
      {thick ? <extrudeGeometry args={[shape, { depth: thick, bevelEnabled: false }]} /> : <shapeGeometry args={[shape]} />}
      <meshStandardMaterial color={map ? '#ffffff' : color} map={map} roughness={floor === 'kayu' ? 0.6 : 0.85} />
      {thick && <Edges color={INK} />}
    </mesh>
  )
}

// Atap miring dari segitiga hasil roofMesh. UV dalam meter, jadi tekstur genteng tampil seukuran aslinya.
function PitchedRoof({ project, roof, finish }: { project: Project; roof: Roof; finish: WallKey }) {
  const mesh = useMemo(() => roofMesh(project, roof), [project, roof])
  const roofGeo = useMemo(() => (mesh ? toGeometry(mesh.roof) : null), [mesh])
  const gableGeo = useMemo(() => (mesh?.gables.length ? toGeometry(mesh.gables) : null), [mesh])
  useEffect(() => () => roofGeo?.dispose(), [roofGeo])
  useEffect(() => () => gableGeo?.dispose(), [gableGeo])
  if (!roofGeo) return null
  return (
    <>
      <mesh geometry={roofGeo} castShadow receiveShadow>
        <meshStandardMaterial map={texture(`roof:${roof.material}`)} side={DoubleSide} roughness={roof.material === 'metal' ? 0.55 : 0.9} />
        <Edges color={INK} threshold={20} />
      </mesh>
      {gableGeo && (
        <mesh geometry={gableGeo} castShadow receiveShadow>
          <meshStandardMaterial map={texture(`wall:${finish}`)} side={DoubleSide} roughness={0.9} />
          <Edges color={INK} threshold={20} />
        </mesh>
      )}
    </>
  )
}

function toGeometry(tris: Tri[]) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(tris.flatMap((t) => t.p.flat()), 3))
  g.setAttribute('uv', new Float32BufferAttribute(tris.flatMap((t) => t.uv.flat()), 2))
  g.computeVertexNormals()
  return g
}

// Satu tekstur per material, dibuat sekali lalu dipakai ulang.
const textures = new Map<string, CanvasTexture>()
function texture(kind: TextureKey) {
  let t = textures.get(kind)
  if (!t) {
    t = new CanvasTexture(paint(kind))
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    const s = 1 / repeatSize(kind)
    t.repeat.set(s, s)
    textures.set(kind, t)
  }
  return t
}

// Dinding: UV kotak bernilai 0..1 per sisi, jadi tekstur diulang sesuai panjang dan tinggi potongan agar motif tidak melar.
function WallMesh({ piece, finish }: { piece: Piece; finish: WallKey }) {
  const [len, h] = piece.size
  const map = useMemo(() => {
    const t = texture(`wall:${finish}`).clone()
    const s = repeatSize(`wall:${finish}`)
    t.repeat.set(len / s, h / s)
    t.needsUpdate = true
    return t
  }, [finish, len, h])
  useEffect(() => () => map.dispose(), [map])
  return (
    <mesh position={piece.center} rotation={[0, piece.rotY, 0]} castShadow receiveShadow>
      <boxGeometry args={piece.size} />
      <meshStandardMaterial map={map} roughness={0.9} />
      <Edges color={INK} />
    </mesh>
  )
}

// Matahari bergerak dari timur (+x) ke barat (-x) sesuai jam. Utara denah = atas layar (-z);
// di Indonesia matahari hampir di atas kepala, jadi kemiringan ke utara dibuat kecil.
function Sun({ hour, center, size }: { hour: number; center: Point; size: number }) {
  const target = useMemo(() => new Object3D(), [])
  const t = ((hour - 6) / 12) * Math.PI
  const r = size * 1.5 + 6
  const elevation = Math.sin(t)
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8cbb4', 0.6 + 0.5 * elevation]} />
      <primitive object={target} position={[center[0], 0, center[1]]} />
      <directionalLight
        target={target}
        position={[center[0] + Math.cos(t) * r, Math.max(0.5, elevation * r), center[1] - r * 0.25]}
        intensity={0.4 + 1.8 * elevation}
        color={elevation < 0.4 ? '#ffd9a8' : '#fff6e8'} // pagi dan sore lebih hangat
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-far={r * 3}
      />
    </>
  )
}
