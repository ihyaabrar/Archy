# Denahin

Aplikasi web untuk arsitek: gambar denah 2D, lihat jadi bangunan 3D, berjalan di dalamnya, lalu bagikan ke klien.

## Fitur

- Editor denah 2D: dinding, pintu, jendela, ruangan, furnitur, ukuran otomatis, banyak lantai.
- Tampilan 3D (three.js): material lantai/dinding/atap, matahari dan bayangan, atap pelana/perisai.
- Room tour: berjalan di dalam bangunan (keyboard atau tombol sentuh), tur per ruangan.
- Presentasi scroll untuk klien di `/presentasi`.
- Ekspor PNG, PDF (cetak 1:100), GLB, file proyek, dan volume material (CSV untuk RAB).
- Penyimpanan di browser; akun opsional untuk sinkron cloud (Supabase).

## Menjalankan

Butuh Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm test` | Tes (vitest) |
| `npm run lint` | ESLint |
| `npm run db:apply` | Terapkan `supabase/schema.sql` ke database |

## Halaman

| Alamat | Isi |
|---|---|
| `/` | Daftar proyek di perangkat ini (dan di cloud kalau masuk) |
| `/proyek/[id]` | Editor; `/proyek/kiriman#denah=...` untuk denah dari tautan bagikan |
| `/masuk` | Masuk, daftar, lupa kata sandi |
| `/presentasi#nama=...&denah=...` | Presentasi scroll |

## Akun dan cloud (opsional)

Tanpa konfigurasi ini Denahin tetap berjalan; proyek disimpan di browser.

1. Hubungkan proyek Vercel dan Supabase: `vercel link`, lalu `vercel integration add supabase`.
2. Tarik env: `vercel env pull .env.local --yes`.
3. Unduh sertifikat CA dari dashboard Supabase (Database Settings, SSL Configuration), simpan sebagai `supabase/ca.crt`.
4. Terapkan skema: `npm run db:apply`. Tabel `projects` memakai Row Level Security per pemilik.
5. Di Supabase (Auth, URL Configuration), tambahkan alamat situs ke Redirect URLs, termasuk `/masuk/atur-sandi` untuk lupa kata sandi.

Hanya kunci publishable yang dipakai di browser. Jangan pernah memakai service role key di kode klien.

## Struktur

- `src/lib/`: logika tanpa UI (model data, geometri, 3D, ekspor, volume, penyimpanan), semuanya dites.
- `src/components/`: editor, tampilan 3D, dashboard, akun, presentasi.
- `PLAN.md`: rencana dan status tahap. `DESIGN.md`: arah desain visual.
