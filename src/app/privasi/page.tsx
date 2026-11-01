import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

// Isi mengikuti cara kerja aplikasi saat ini (src/lib/store.ts, share.ts, cloud.ts). Ubah halaman ini kalau perilakunya berubah.
export default function Page() {
  return (
    <LegalPage title="Kebijakan Privasi">
      <h2>Tanpa akun</h2>
      <p>
        Denah yang Anda buat disimpan di penyimpanan browser (localStorage) di perangkat Anda sendiri. Denah tidak dikirim ke server Denahin. Membersihkan data
        browser akan menghapus denah tersebut, kecuali Anda sudah mengunduh cadangan atau menyimpannya ke cloud.
      </p>

      <h2>Tautan bagikan dan presentasi</h2>
      <p>
        Saat Anda menyalin tautan denah atau tautan presentasi, isi denah dipadatkan dan dimasukkan ke dalam tautan itu sendiri (bagian setelah tanda #). Bagian
        ini tidak dikirim browser ke server mana pun saat tautan dibuka. Siapa pun yang memegang tautan tersebut dapat melihat denahnya, jadi bagikan hanya
        kepada orang yang Anda percaya.
      </p>

      <h2>Dengan akun</h2>
      <p>
        Akun bersifat opsional. Kalau Anda mendaftar, alamat email dan kata sandi Anda dikelola oleh Supabase, penyedia layanan akun dan database yang kami pakai
        melalui Vercel. Kata sandi tidak disimpan dalam bentuk teks biasa. Proyek yang Anda simpan ke cloud tersimpan di database Supabase, dan aturan database
        membatasi setiap proyek hanya bisa dibaca dan diubah oleh pemiliknya.
      </p>

      <h2>Yang tidak kami lakukan</h2>
      <p>Denahin tidak memasang iklan, tidak memakai alat analitik pihak ketiga, dan tidak menjual data Anda.</p>

      <h2>Laporan kesalahan</h2>
      <p>
        Kalau aplikasi mengalami kesalahan teknis, browser mengirim pesan kesalahan dan alamat halaman (tanpa isi denah) ke server Denahin
        supaya bisa diperbaiki. Laporan ini tidak memuat nama proyek, denah, atau data akun, dan tidak disimpan di basis data.
      </p>

      <h2>Menghapus data</h2>
      <p>
        Proyek di browser bisa Anda hapus sendiri dari daftar proyek. Proyek di cloud bisa dihapus dari menu Proyek di editor. Untuk menghapus akun beserta semua
        datanya, hubungi [KONTAK].
      </p>

      <h2>Perubahan dan kontak</h2>
      <p>Kebijakan ini dapat berubah mengikuti perkembangan aplikasi. Pertanyaan tentang privasi dapat dikirim ke [KONTAK].</p>
    </LegalPage>
  );
}
