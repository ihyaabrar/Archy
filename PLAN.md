# Denahin: rencana

Aplikasi web untuk arsitek: gambar denah 2D, lihat jadi 3D, lalu jalan keliling (room tour).
Referensi gaya: demo "Lintel / Casa Serra" (denah blueprint 1:200 naik jadi rumah 3D saat scroll).

## Keputusan
- Platform: web.
- Denah digambar sendiri di dalam aplikasi. Impor DXF ditunda.

## Stack
- Next.js (App Router) + TypeScript
- Three.js lewat React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- Zustand untuk state proyek
- GSAP untuk animasi denah naik jadi 3D
- Supabase untuk akun dan simpan proyek (tahap 4)
- Deploy: Vercel

## Model data inti
Satu JSON proyek dibaca oleh editor 2D dan tampilan 3D.

```ts
type Project = {
  scale: number            // mis. 200 untuk 1:200
  walls: { id: string; a: [number, number]; b: [number, number]; thickness: number; height: number }[]
  openings: { id: string; wallId: string; at: number; width: number; kind: 'door' | 'window'; sill: number; height: number }[]
  rooms: { id: string; name: string; points: [number, number][] }[] // poligon digambar langsung
}
```

Satuan meter. Dinding menyimpan titik, bukan mesh. 3D dibangun ulang dari data.

## Tahap
1. **Editor 2D.** Kanvas SVG, grid, snap, gambar dinding, tambah pintu dan jendela, nama ruangan, dimensi otomatis, undo/redo. Tampilan gaya blueprint.
2. **Generator 3D.** Extrude dinding, lubang pintu/jendela (CSG atau segmen dinding), lantai, atap datar. Animasi denah naik ke 3D.
3. **Room tour.** Jalan orang pertama (WASD + sentuh), tur otomatis per ruangan, tautan bagikan.
4. **Proyek dan ekspor.** Banyak proyek di browser, impor/ekspor file proyek, ekspor PNG, PDF (cetak 1:100), GLB. Akun (Supabase lewat Vercel) dan sinkron cloud sudah dikodekan; tertunda: simpan CA Supabase ke `supabase/ca.crt` lalu `npm run db:apply`.
5. **Sudah:** furnitur, material dan matahari, rapikan dasar, presentasi scroll (`/presentasi`), bangunan bertingkat dengan tangga, volume material dan CSV untuk RAB.
6. **Lanjutan.** Material, matahari dan bayangan, potongan dan exploded, furnitur, kolaborasi.

## Risiko
- Editor denah paling berat. Mulai dari model data dan editor, bukan animasi.
- Lubang pintu/jendela di dinding: bangun dinding sebagai segmen, hindari boolean CSG di awal.
- Kinerja di HP: batasi bayangan dan jumlah mesh.

## Langkah pertama
Scaffold Next.js, definisikan tipe `Project`, buat editor 2D yang bisa menggambar dinding dan menyimpan ke state.
