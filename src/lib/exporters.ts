// Ekspor dan impor di browser. Semua berjalan lokal, tidak ada yang dikirim ke server.

import { planSheets } from './drawing'
import { finishOf, parseProject, type Project } from './project'
import { DEFAULT_FLOOR, DEFAULT_WALL, FLOORS, WALLS, type FloorKey, type WallKey } from './materials'
import { DEFAULT_ROOF, ROOF_MATERIALS, roofMesh } from './roof'

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'denah'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, type: string) {
  download(new Blob([text], { type: `${type};charset=utf-8` }), filename.replace(/[\\/:*?"<>|]/g, '-'))
}

export function exportProjectFile(p: Project, name: string) {
  download(new Blob([JSON.stringify({ name, project: p }, null, 1)], { type: 'application/json' }), `${slug(name)}.denahin.json`)
}

// File dari pengguna tidak dipercaya: batasi ukuran dan validasi isinya.
export type Imported = { project: Project; name: string; id?: string } // id asli, hanya dari file cadangan

const BACKUP_KIND = 'denahin-cadangan'

const cleanName = (n: unknown, fallback: string) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 60) : fallback)

// Menerima file satu proyek (.denahin.json) maupun file cadangan berisi banyak proyek.
export async function importProjectFile(file: File): Promise<Imported[]> {
  if (file.size > 30_000_000) throw new Error('File terlalu besar (maksimal 30 MB)')
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('File ini bukan file proyek Denahin')
  }
  const o = data as { kind?: unknown; name?: unknown; project?: unknown; projects?: unknown }
  if (o?.kind === BACKUP_KIND) {
    if (!Array.isArray(o.projects) || !o.projects.length) throw new Error('File cadangan ini kosong')
    return o.projects.map((x: { name?: unknown; project?: unknown; id?: unknown }, i: number) => ({
      project: parseProject(x?.project),
      name: cleanName(x?.name, `Proyek ${i + 1}`),
      ...(typeof x?.id === 'string' && { id: x.id }),
    }))
  }
  if (file.size > 5_000_000) throw new Error('File terlalu besar untuk sebuah denah (maksimal 5 MB)')
  return [{ project: parseProject(o?.project ?? data), name: cleanName(o?.name, file.name.replace(/\.denahin\.json$|\.json$/i, '')) }]
}

// Satu file berisi semua proyek, untuk cadangan atau pindah browser/perangkat.
export function backupJson(items: Imported[]) {
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(), projects: items })
}

export function exportBackup(items: Imported[]) {
  download(new Blob([backupJson(items)], { type: 'application/json' }), `denahin-cadangan-${new Date().toISOString().slice(0, 10)}.json`)
}

const NO_PLAN = 'Denah masih kosong. Gambar dinding atau ruangan dulu.'

// Bangunan bertingkat: gambar tiap lantai disusun ke bawah dalam satu PNG.
export async function exportPng(p: Project, name: string) {
  const sheets = planSheets(p, name)
  if (!sheets.length) throw new Error(NO_PLAN)
  const w = Math.max(...sheets.map((s) => s.width))
  const h = sheets.reduce((sum, s) => sum + s.height, 0)
  // 100 px per meter (1 cm gambar = 1 m), dibatasi supaya kanvas tidak melebihi batas browser.
  const scale = Math.min(100, 8000 / Math.max(w, h))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w * scale), height: Math.round(h * scale) })
  const g = canvas.getContext('2d')!
  g.fillStyle = '#f3eee3'
  g.fillRect(0, 0, canvas.width, canvas.height)
  let y = 0
  for (const s of sheets) {
    const img = new Image()
    img.src = URL.createObjectURL(new Blob([s.svg], { type: 'image/svg+xml' }))
    await img.decode()
    g.drawImage(img, 0, y * scale, s.width * scale, s.height * scale)
    URL.revokeObjectURL(img.src)
    y += s.height
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Browser gagal membuat gambar PNG')
  download(blob, `${slug(name)}.png`)
}

// PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF"): tanpa pustaka tambahan, hasil vektor tajam.
// Satu halaman per lantai.
export function printPlan(p: Project, name: string) {
  const sheets = planSheets(p, name)
  if (!sheets.length) throw new Error(NO_PLAN)
  const frame = Object.assign(document.createElement('iframe'), { title: 'Cetak denah' })
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${name.replace(/</g, '')}</title>
<style>@page{size:auto;margin:10mm}html,body{margin:0}svg{display:block;max-width:100%;height:auto}section+section{break-before:page}</style></head>
<body>${sheets.map((s) => `<section>${s.svg}</section>`).join('')}</body></html>`
  frame.onload = () => {
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
    setTimeout(() => frame.remove(), 60_000) // beri waktu dialog cetak; iframe tak terlihat
  }
  document.body.append(frame)
}

// Model 3D GLB (dibuka di Blender, SketchUp, dll). three.js dimuat hanya saat dibutuhkan.
export async function exportGlb(p: Project, name: string) {
  if (!p.walls.length) throw new Error('Belum ada dinding untuk dijadikan model 3D.')
  const [THREE, { GLTFExporter }, { buildPieces }] = await Promise.all([
    import('three'),
    import('three/examples/jsm/exporters/GLTFExporter.js'),
    import('./mesh'),
  ])
  const scene = new THREE.Scene()
  // Material GLB memakai warna dasar saja (tanpa tekstur kanvas) supaya file tetap kecil; nama material = nama finishing.
  const wallMats = new Map<string, InstanceType<typeof THREE.MeshStandardMaterial>>()
  const wallMat = (key: WallKey) => {
    if (!wallMats.has(key)) wallMats.set(key, new THREE.MeshStandardMaterial({ color: WALLS[key].base, name: `Dinding ${WALLS[key].label}` }))
    return wallMats.get(key)!
  }
  const finishes = new Map(p.walls.map((w) => [w.id, finishOf(p, w)]))
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fb7bf', transparent: true, opacity: 0.35, name: 'Kaca' })
  const floorMats = new Map<string, InstanceType<typeof THREE.MeshStandardMaterial>>()
  const floorMat = (key: FloorKey) => {
    if (!floorMats.has(key)) floorMats.set(key, new THREE.MeshStandardMaterial({ color: FLOORS[key].base, side: THREE.DoubleSide, name: `Lantai ${FLOORS[key].label}` }))
    return floorMats.get(key)!
  }
  const furnMats = new Map<string, InstanceType<typeof THREE.MeshStandardMaterial>>()
  const furnMat = (color = '#d6c8b0') => {
    if (!furnMats.has(color)) furnMats.set(color, new THREE.MeshStandardMaterial({ color, name: `Furnitur ${color}` }))
    return furnMats.get(color)!
  }
  const doorMat = new THREE.MeshStandardMaterial({ color: '#9c7652', name: 'Daun pintu' })
  for (const piece of buildPieces(p)) {
    const mat = piece.kind === 'glass' ? glassMat : piece.kind === 'furniture' ? furnMat(piece.color) : piece.kind === 'door' ? doorMat : wallMat(finishes.get(piece.wallId) ?? DEFAULT_WALL)
    const m = new THREE.Mesh(new THREE.BoxGeometry(...piece.size), mat)
    m.position.set(...piece.center)
    m.rotation.y = piece.rotY
    scene.add(m)
  }
  for (const r of p.rooms) {
    const shape = new THREE.Shape(r.points.map(([x, z]) => new THREE.Vector2(x, -z)))
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat(r.floor ?? DEFAULT_FLOOR))
    floor.rotation.x = -Math.PI / 2
    floor.name = r.name
    scene.add(floor)
  }
  // Atap miring (kalau dipilih), dengan warna dasar materialnya.
  const roof = roofMesh(p, p.roof ?? DEFAULT_ROOF)
  if (roof) {
    const mk = (tris: typeof roof.roof, color: string, name: string) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flatMap((t) => t.p.flat()), 3))
      g.computeVertexNormals()
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, name }))
      m.name = name
      scene.add(m)
    }
    const rm = ROOF_MATERIALS[(p.roof ?? DEFAULT_ROOF).material]
    mk(roof.roof, rm.base, `Atap ${rm.label}`)
    if (roof.gables.length) mk(roof.gables, WALLS[p.wallFinish ?? DEFAULT_WALL].base, 'Dinding sopi-sopi')
  }
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  download(new Blob([glb], { type: 'model/gltf-binary' }), `${slug(name)}.glb`)
}
