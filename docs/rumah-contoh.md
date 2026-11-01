# Perencanaan Rumah Contoh: Rumah Tropis Dua Lantai

Rumah contoh yang tampil di halaman depan Denahin. Datanya ada di [`src/lib/sample.ts`](../src/lib/sample.ts), dan bisa dibuka di editor lewat tombol "Buka contoh ini di editor".

Dokumen ini adalah **pra-rancangan**: denah, program ruang, dan alasan desainnya. Struktur, mekanikal-elektrikal, dan kesesuaian dengan aturan daerah (RDTR, PBG) belum dihitung dan tetap perlu diperiksa arsitek serta insinyur berlisensi.

| Lantai 1 | Lantai 2 |
|---|---|
| ![Denah Lantai 1](denah-lantai-1.svg) | ![Denah Lantai 2](denah-lantai-2.svg) |

## 1. Evaluasi rancangan sebelumnya

Versi sebelumnya ("Rumah Taman Tengah", satu lantai) punya masalah berikut, dan semuanya diperbaiki di versi ini:

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Ruang tamu bolong | Dinding timur ruang tamu hanya sampai y = 17. Sisa 2 m ke y = 19 tidak berdinding, jadi ruang tamu terbuka ke taman samping. | Setiap tepi ruang sekarang diperiksa otomatis oleh tes "tidak ada dinding bolong". Tepi yang boleh terbuka hanya yang menghadap ruang luar (carport, teras, balkon, jemur) atau pasangan ruang yang memang dirancang terbuka. |
| Kotak tanpa arti di depan teras | Jalan setapak 1,3 m berhenti di garis batas lahan tanpa pagar atau pintu pagar. | Jalan setapak dan jalan masuk mobil sekarang berujung di pintu pagar yang digambar di garis batas lahan. |
| Kamar utama hanya bisa dimasuki lewat walk-in closet | Pintu kamar utama ada di dinding closet. | Kamar utama punya pintu langsung dari ruang santai. Closet dan KM utama diakses dari dalam kamar. |
| Satu lantai di lahan besar (±400 m² atap) | Program ruang dijejer mendatar. | Dua lantai: lahan lebih hemat, taman lebih luas, zona privat terpisah di atas. |

## 2. Data tapak

| Item | Nilai |
|---|---|
| Lahan | 15 × 24,5 m = 367,5 m² (jalan di selatan) |
| Tapak bangunan | 13 × 16,5 m = 214,5 m² |
| KDB (koefisien dasar bangunan) | 214,5 / 367,5 = **58 %** |
| Luas lantai kotor | Lt. 1 214,5 m² + Lt. 2 193,5 m² (dikurangi void 21 m²) = 408 m² |
| KLB (koefisien lantai bangunan) | 408 / 367,5 = **1,11** |
| KDH (koefisien dasar hijau) | 367,5 − 214,5 − 36,5 (perkerasan) = 116,5 m² = **32 %** |
| Garis sempadan | Depan 5 m, belakang 3 m, samping timur 1 m, barat 1 m |

KDB 60 % dan KDH minimal 30 % adalah angka yang umum untuk perumahan, tetapi batas sebenarnya ditentukan RDTR tiap daerah.

## 3. Konsep

- **Zonasi vertikal.** Lantai 1 untuk tamu, keluarga, dan servis. Lantai 2 untuk kamar tidur. Tamu tidak perlu melewati area pribadi.
- **Void di atas ruang keluarga** (6 × 3,5 m, tinggi ±6,2 m). Lantai 1 dan 2 terhubung secara visual. Udara panas naik dan keluar lewat kaca tinggi di dinding barat Lantai 2 (efek cerobong).
- **Bukaan utama di utara dan selatan.** Sisi barat tetap berjendela untuk ventilasi silang: dapur, ruang keluarga, ruang kerja, void, dan kamar utama. Karena sisi ini paling panas sore hari, jendelanya perlu kerai atau sirip penahan matahari. Carport tertutup dinding ke tetangga di sisi barat.
- **Balkon depan menaungi teras**, dan teritisan atap 1 m melindungi jendela dari hujan dan matahari.

## 3a. Atap, balkon, dan tampak depan

| Elemen | Rancangan | Alasan |
|---|---|---|
| Atap | Pelana genteng tanah liat, kemiringan 30°, teritisan 1 m. Bubungan utara–selatan, jadi sisi segitiga (gevel) menghadap jalan. | Gevel di depan memberi wajah rumah yang jelas dari jalan. Kemiringan 30° cukup untuk genteng tanah liat di curah hujan tropis. Teritisan 1 m menaungi jendela dan balkon. |
| Balkon | 7 × 2 m di atas teras dan ruang tamu, lantai kayu, pagar kaca setinggi 1 m di antara tiang 10 cm. | Kaca tidak menghalangi pandangan ke jalan dan membuat fasad terasa ringan. Balkon berada di bawah gevel, jadi terlindung hujan. |
| Pagar void dan lubang tangga | Kaca 1 m, sama dengan pagar balkon. | Void tetap terbuka secara visual dari hall Lantai 2. |
| Fasad Lantai 1 | Bata ekspos di dinding depan ruang tamu dan dinding batas carport. Beton ekspos di dinding pintu masuk. | Bata memberi tekstur hangat di bagian yang paling dekat dengan orang. Beton menandai pintu masuk. |
| Fasad Lantai 2 | Beton ekspos di dinding depan kamar utama, dinding lain dicat putih. | Kamar utama dan balkon kaca terbaca sebagai dua massa yang berbeda di bawah gevel. |
| Pagar depan | Bata ekspos 1,6 m di garis batas lahan dan sisi taman depan. Dua bukaan: pintu pagar mobil 6 m dan pejalan kaki 1,3 m. | Privasi taman depan tanpa menutup rumah sepenuhnya. Jalur mobil dan pejalan kaki dipisah. |
- **Ventilasi silang.** Hampir semua kamar punya jendela di dua sisi atau jendela ke ruang terbuka. KM memakai jendela nako tinggi (ambang 1,6 m) supaya tetap privat.

## 4. Program ruang

### Lantai 1 (publik dan servis)

| Ruang | Ukuran (m) | Luas (m²) | Catatan |
|---|---|---|---|
| Carport | 6,00 × 5,50 | 33,00 | 2 mobil berdampingan, di bawah kamar utama |
| Teras | 3,50 × 3,00 | 10,50 | Ternaungi balkon |
| Foyer | 3,50 × 2,50 | 8,75 | Pintu utama ganda 1,4 m, akses ke ruang tamu, hall, dan carport |
| Ruang Tamu | 3,50 × 5,50 | 19,25 | Terpisah dari area keluarga |
| Ruang Keluarga | 6,00 × 6,50 | 39,00 | Sebagian di bawah void, terbuka ke dapur dan hall |
| Dapur & Makan | 6,00 × 4,50 | 27,00 | Dapur bersih menyatu dengan meja makan 6 kursi |
| Dapur Kotor & Cuci | 3,50 × 2,50 | 8,75 | Masak berat dan mencuci, dekat kamar ART |
| Hall & Tangga | 3,50 × 8,50 | 29,75 | Tangga lurus 1 m menempel dinding barat hall |
| Kamar Tamu | 3,50 × 5,00 | 17,50 | Untuk orang tua atau tamu yang tidak kuat naik tangga |
| Mushola | 2,00 × 3,00 | 6,00 | Dekat KM tamu untuk wudu |
| KM Tamu | 1,50 × 3,00 | 4,50 | Diakses dari ruang tamu |
| Kamar ART | 2,00 × 3,00 | 6,00 | Diakses dari dapur kotor |
| KM ART | 1,50 × 3,00 | 4,50 | |
| **Jumlah ruang dalam** | | **171,00** | Ditambah 43,5 m² carport dan teras |

### Lantai 2 (privat)

| Ruang | Ukuran (m) | Luas (m²) | Catatan |
|---|---|---|---|
| Kamar Utama | 6,00 × 5,50 | 33,00 | Kasur 160, meja rias, pintu geser ke balkon |
| Walk-in Closet | 3,00 × 3,00 | 9,00 | Dari kamar utama |
| KM Utama | 3,00 × 3,00 | 9,00 | Shower, kloset, wastafel |
| Ruang Santai | 7,00 × 3,50 | 24,50 | Ruang keluarga kedua, dua pintu geser 2,4 m ke balkon |
| Balkon | 7,00 × 2,00 | 14,00 | Pagar 1 m, di atas teras dan ruang tamu |
| Hall | 3,50 × 8,50 | 29,75 | Termasuk lubang tangga, pagar ke void |
| Kamar Anak 1 | 3,50 × 4,50 | 15,75 | Jendela utara dan timur |
| Kamar Anak 2 | 3,50 × 4,00 | 14,00 | Jendela timur |
| KM Anak | 3,50 × 2,50 | 8,75 | Bathtub, untuk kedua kamar anak |
| Ruang Kerja | 6,00 × 4,50 | 27,00 | Dinding kaca ke void |
| Area Jemur | 3,50 × 2,50 | 8,75 | Terbuka ke utara, pagar 1 m |
| **Jumlah ruang dalam** | | **170,75** | Ditambah 22,75 m² balkon dan jemur |

**Total ruang dalam: 341,75 m².** Ruang luar beratap (carport, teras, balkon, jemur): 66,25 m².

Patokan ukuran yang dipakai berasal dari artikel properti, bukan SNI: kamar tidur utama minimal 3 × 3 m dan nyaman 3,5 × 4 m, KM dengan bathtub minimal 2,5 × 3 m, carport 2 mobil sekitar 6 × 6 m. Semua kamar di rumah ini memenuhi angka "nyaman".

## 5. Sirkulasi

- **Tamu:** pagar, lalu jalan setapak, teras, foyer, dan ruang tamu. KM tamu dan mushola bisa dicapai tanpa masuk area keluarga.
- **Keluarga:** carport, pintu samping, ruang keluarga. Atau lewat foyer, lalu hall.
- **Servis:** dapur kotor terhubung langsung ke dapur bersih, hall, dan kamar ART.
- **Vertikal:** satu tangga di hall. Di Lantai 2 tangga tiba di ujung utara hall, lalu semua kamar dibuka dari hall dan ruang santai.

## 6. Tangga

| Item | Nilai |
|---|---|
| Tinggi lantai ke lantai | 3,20 m (dinding 3,00 + pelat 0,20) |
| Jumlah anak tangga | 17 |
| Tinggi anak tangga (optrede) | 3.200 / 17 = 188 mm |
| Lebar injakan (antrede) | 4.200 / 16 = 262 mm |
| Rumus langkah 2R + T | 2 × 188 + 262 = 638 mm (nyaman: 600–650 mm) |
| Lebar tangga | 1,00 m |
| Pagar lubang tangga dan void | Tinggi 1,00 m |

## 7. Struktur (indikatif)

- Kolom di persilangan as A–D dan 1–5. Bentang terbesar 6 m (as A–B), cocok untuk balok beton bertulang biasa.
- Carport tanpa kolom tengah: balok 6 m di as 5 menopang dinding kamar utama di atasnya. Kolom carport ada di (0; 16,5) dan (6; 16,5).
- Balkon bertumpu pada dinding ruang tamu dan kolom (6; 16,5), jadi tidak kantilever.
- Atap pelana genteng tanah liat, kemiringan 30°, teritisan 1 m, menutup seluruh denah termasuk void dan balkon. Gevel depan dan belakang berupa dinding pasangan bata di atas balok as 1 dan as 5.

Ukuran kolom, balok, pelat, dan pondasi belum dihitung.

## 8. Daftar pintu dan jendela

Kode di gambar mengikuti jenis dan ukuran. Bukaan sejenis memakai kode yang sama.

| Kode | Jenis | Lebar × tinggi (m) | Ambang (m) | Jumlah |
|---|---|---|---|---|
| P1 | Pintu ayun | 0,90 × 2,20 | | 9 |
| P2 | Pintu ganda (hall–foyer) | 1,60 × 2,20 | | 1 |
| P3 | Pintu ayun KM | 0,70 × 2,20 | | 2 |
| P4 | Pintu ganda (pintu utama) | 1,40 × 2,20 | | 1 |
| P5 | Pintu ayun | 0,80 × 2,20 | | 6 |
| P6 | Pintu ganda (foyer–ruang tamu) | 1,20 × 2,20 | | 1 |
| P7 | Pintu geser kaca (santai–balkon) | 2,40 × 2,20 | | 2 |
| P8 | Pintu geser kaca (kamar utama–balkon) | 1,60 × 2,20 | | 1 |
| J1 | Jendela buka | 2,40 × 1,40 | 0,90 | 7 |
| J2 | Jendela nako (dapur kotor) | 1,20 × 1,40 | 0,90 | 1 |
| J3 | Jendela buka | 0,80 × 1,40 | 0,90 | 1 |
| J4 | Jendela nako tinggi (KM) | 0,60 × 0,60 | 1,60 | 5 |
| J5 | Jendela buka | 1,60 × 1,40 | 0,90 | 6 |
| J6 | Kaca mati (void, barat) | 2,40 × 2,60 | 0,10 | 1 |
| J7 | Jendela buka | 1,20 × 1,40 | 0,90 | 2 |
| J8 | Kaca pagar balkon (sisi timur) | 1,80 × 0,85 | 0,10 | 1 |
| J9 | Kaca pagar balkon (depan) | 6,80 × 0,85 | 0,10 | 1 |
| J10 | Kaca mati (ruang kerja ke void) | 3,00 × 2,60 | 0,10 | 1 |
| J11 | Kaca pagar void | 3,30 × 0,85 | 0,10 | 1 |
| J12 | Kaca pagar lubang tangga (samping) | 4,00 × 0,85 | 0,10 | 1 |
| J13 | Kaca pagar lubang tangga (ujung) | 0,95 × 0,85 | 0,10 | 1 |

Jumlah: 23 pintu, 24 jendela, dan 5 panel kaca pagar.

## 9. Material

| Bagian | Material |
|---|---|
| Lantai ruang tamu, foyer, hall, dapur & makan | Teraso |
| Lantai kamar, ruang keluarga, ruang kerja, ruang santai, balkon | Parket kayu |
| Lantai KM, dapur kotor, kamar ART | Keramik 60 × 60 |
| Carport, teras, jemur, jalan masuk | Beton ekspos |
| Dinding | Bata diplester dan dicat putih, aksen bata ekspos dan beton ekspos di fasad depan |
| Pagar balkon, void, tangga | Kaca tempered 10 mm, tiang dan rel atas baja |
| Pagar depan | Bata ekspos 1,6 m |
| Atap | Genteng tanah liat |

## 10. Catatan dan risiko

- **Carport di bawah kamar utama.** Panas mesin dan asap knalpot bisa naik. Pelat lantai Lantai 2 di atas carport sebaiknya diberi insulasi.
- **KM keluarga di Lantai 1 hanya KM tamu.** Kalau keluarga sering di bawah, KM tamu bisa diperbesar ke ruang mushola, dan mushola dipindah ke ruang kerja Lantai 2.
- **Void menambah volume yang harus didinginkan** kalau rumah memakai AC. Sebaiknya void tetap mengandalkan ventilasi alami.
- **Angka KDB, KLB, KDH, dan sempadan** harus dicocokkan dengan RDTR lokasi sebelum mengurus PBG.
