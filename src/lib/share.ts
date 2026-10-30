// Denah dibagikan lewat URL: JSON dipadatkan (deflate) lalu base64url di hash.
// Hash tidak dikirim ke server, jadi denah tidak pernah lewat server mana pun.

import { parseProject, type Project } from './project'

export const SHARE_PREFIX = '#denah='

// Angka dibulatkan ke milimeter supaya tautan lebih pendek.
const mm = (_: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

const toB64url = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function encodeProject(p: Project) {
  const json = new TextEncoder().encode(JSON.stringify(p, mm))
  return toB64url(await pipe(json, new CompressionStream('deflate-raw')))
}

// Data dari URL tidak dipercaya: batasi ukuran dan validasi bentuknya.
export async function decodeProject(code: string): Promise<Project> {
  if (code.length > 200_000) throw new Error('Tautan denah terlalu panjang')
  const bytes = await pipe(fromB64url(code), new DecompressionStream('deflate-raw'))
  if (bytes.length > 2_000_000) throw new Error('Isi tautan denah terlalu besar')
  return parseProject(JSON.parse(new TextDecoder().decode(bytes)))
}
