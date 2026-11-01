'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, MathUtils, Object3D, RepeatWrapping, SRGBColorSpace, Path, Shape, Vector2, type Group } from 'three'
import { bounds, buildPieces, type Piece } from '@/lib/mesh'
import { DEFAULT_FLOOR, DEFAULT_WALL, paint, repeatSize, type FloorKey, type TextureKey, type WallKey } from '@/lib/materials'
import { DEFAULT_ROOF, roofMesh, type Roof, type Tri } from '@/lib/roof'
import { centroid, elevationOf, polygonArea, finishOf, levelOf, levelsOf, type Point, type Project, type Room } from '@/lib/project'
import { slabHoles } from '@/lib/stairs'

// Warna dari DESIGN.md: badan bangunan kertas, garis tepi tinta, supaya 3D tetap terbaca seperti gambar.
const PAPER = '#f3eee3'
const INK = '#2a2420'
const NIGHT = '#26252c' // langit malam di belakang bangunan
const FURNITURE = '#d6c8b0' // sedikit lebih gelap dari dinding supaya terbaca sebagai benda di dalam ruang
const DOOR = '#9c7652' // daun pintu kayu, kontras dengan dinding putih maupun bata

// Isi adegan (cahaya, bangunan, tanah) tanpa kamera: dipakai editor 3D dan halaman presentasi.
// `level` (0..1) mengendalikan tinggi bangunan dari luar; tanpa itu bangunan naik sendiri sekali saat dibuka.
export function BuildingScene({ project, roof, lamps, hour, level }: { project: Project; roof: boolean; lamps?: boolean; hour: number; level?: RefObject<number> }) {
  const pieces = useMemo(() => buildPieces(project), [project])
  const { center, size } = useMemo(() => bounds(project), [project])
  // Atap hanya di lantai teratas yang tampil; lantai di bawahnya tertutup pelat lantai atas.
  const top = levelsOf(project).filter((l) => project.walls.some((w) => levelOf(project, w) === l.id)).reduce((a, l) => (l.elevation > a.elevation ? l : a), levelsOf(project)[0])
  const topWalls = project.walls.filter((w) => levelOf(project, w) === top.id)
  const roofY = top.elevation + Math.max(0, ...topWalls.map((w) => w.height))
  const wall = project.wallFinish ?? DEFAULT_WALL
  // Dihitung sekali per denah: geometri pelat dibangun ulang hanya kalau lubangnya berubah.
  const holes = useMemo(() => new Map(project.rooms.map((r) => [r.id, slabHoles(project, levelOf(project, r), r.points)])), [project])
  const finishes = useMemo(() => new Map(project.walls.map((w) => [w.id, finishOf(project, w)])), [project])

  return (
    <>
      <color attach="background" args={[hour > 18 ? NIGHT : PAPER]} />
      <Sun hour={hour} center={center} size={size} />

      <Rise level={level}>
        {pieces.map((p, i) =>
          p.kind === 'wall' ? (
            <WallMesh key={i} piece={p} finish={finishes.get(p.wallId) ?? wall} />
          ) : (
            <mesh key={i} position={p.center} rotation={[0, p.rotY, 0]} castShadow={p.kind !== 'glass'} receiveShadow>
              <boxGeometry args={p.size} />
              {p.kind === 'glass' ? (
                <meshStandardMaterial color="#9fb7bf" transparent opacity={0.35} />
              ) : (
                <meshStandardMaterial color={p.kind === 'door' ? DOOR : (p.color ?? FURNITURE)} />
              )}
              <Edges color={INK} />
            </mesh>
          ),
        )}
        {project.rooms.map((r) => (
          <RoomFloor key={r.id} room={r} elev={elevationOf(project, levelOf(project, r))} holes={holes.get(r.id)} />
        ))}
        {roof &&
          ((project.roof ?? DEFAULT_ROOF).type === 'datar' ? (
            project.rooms.filter((r) => levelOf(project, r) === top.id).map((r) => <Slab key={'roof' + r.id} points={r.points} y={roofY} color={PAPER} thick={0.15} />)
          ) : (
            <PitchedRoof project={project} roof={project.roof ?? DEFAULT_ROOF} finish={wall} />
          ))}
        {lamps && <Lamps project={project} />}
      </Rise>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.01, center[1]]} receiveShadow>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color="#ebe4d6" />
      </mesh>
    </>
  )
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
function RoomFloor({ room, elev, holes }: { room: Room; elev: number; holes?: Point[][] }) {
  const floor = room.floor ?? DEFAULT_FLOOR
  return elev > 0 ? <Slab points={room.points} holes={holes} y={elev - 0.15} floor={floor} thick={0.15} /> : <Slab points={room.points} y={0.005} floor={floor} />
}

// Lantai atau atap dari poligon ruangan. Shape di bidang XY, diputar ke bidang lantai (z = y denah).
// UV ShapeGeometry = koordinat meter, jadi tekstur lantai tampil seukuran aslinya.
function Slab({ points, holes, y, color, floor, thick }: { points: Point[]; holes?: Point[][]; y: number; color?: string; floor?: FloorKey; thick?: number }) {
  const shape = useMemo(() => {
    const s = new Shape()
    points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)))
    for (const h of holes ?? []) s.holes.push(new Path(h.map(([x, z]) => new Vector2(x, -z))))
    return s
  }, [points, holes])
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

// Satu lampu plafon hangat di tengah tiap ruangan, 25 cm di bawah plafon. Tanpa bayangan supaya tetap ringan;
// cahayanya meredup oleh jarak, jadi tembus dinding ke ruang sebelah hanya sedikit.
// shortcut: maksimal 16 lampu (batas wajar untuk GPU ponsel); ruangan sisanya tanpa lampu.
function Lamps({ project }: { project: Project }) {
  const lamps = useMemo(
    () =>
      project.rooms.slice(0, 16).map((r) => {
        const lv = levelOf(project, r)
        const top = Math.max(2.4, ...project.walls.filter((w) => levelOf(project, w) === lv).map((w) => w.height))
        const [x, z] = centroid(r.points)
        // Ruangan besar butuh lampu lebih kuat dan jangkauan lebih jauh supaya sudutnya tidak gelap.
        const area = polygonArea(r.points)
        return { id: r.id, pos: [x, elevationOf(project, lv) + top - 0.25, z] as [number, number, number], power: Math.max(6, area * 0.3), reach: Math.max(7, Math.sqrt(area) * 1.6) }
      }),
    [project],
  )
  return lamps.map((l) => (
    <group key={l.id} position={l.pos}>
      <pointLight color="#ffd9a0" intensity={l.power} distance={l.reach} decay={2} />
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
        <meshStandardMaterial color="#fff3dc" emissive="#ffd9a0" emissiveIntensity={1.5} />
      </mesh>
    </group>
  ))
}

// Matahari bergerak dari timur (+x) ke barat (-x) sesuai jam. Utara denah = atas layar (-z);
// di Indonesia matahari hampir di atas kepala, jadi kemiringan ke utara dibuat kecil.
function Sun({ hour, center, size }: { hour: number; center: Point; size: number }) {
  const target = useMemo(() => new Object3D(), [])
  const t = ((Math.min(hour, 18) - 6) / 12) * Math.PI
  const r = size * 1.5 + 6
  const elevation = Math.sin(t)
  // Senja: lewat 18.00 cahaya langit meredup sampai tinggal cahaya bulan yang kebiruan.
  const dusk = Math.min(1, Math.max(0, (hour - 18) / 1.5))
  if (dusk > 0) return <hemisphereLight args={['#9aa6c4', '#2f2c33', 0.6 * (1 - dusk) + 0.12]} />
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
