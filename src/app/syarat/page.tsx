import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Syarat Layanan" };

export default function Page() {
  return (
    <LegalPage title="Syarat Layanan">
      <h2>Layanan</h2>
      <p>
        Denahin adalah alat bantu untuk menggambar denah, melihatnya dalam 3D, dan membagikannya. Hasil gambar, ukuran, dan perkiraan volume material adalah alat
        bantu perencanaan, bukan pengganti gambar kerja yang disahkan, perhitungan struktur, atau rencana anggaran dari tenaga ahli.
      </p>

      <h2>Milik Anda</h2>
      <p>Denah yang Anda buat adalah milik Anda. Anda bertanggung jawab atas isi denah dan atas kepada siapa tautan denah Anda bagikan.</p>

      <h2>Akun</h2>
      <p>
        Jaga kerahasiaan kata sandi Anda. Kami dapat menangguhkan akun yang dipakai untuk menyalahgunakan layanan, misalnya mengganggu sistem atau menyimpan konten
        yang melanggar hukum.
      </p>

      <h2>Ketersediaan dan data</h2>
      <p>
        Layanan disediakan apa adanya. Kami berusaha menjaga data tetap aman, tetapi Anda disarankan mengunduh cadangan proyek secara berkala. Kami tidak bertanggung
        jawab atas kehilangan data akibat data browser yang dibersihkan atau perangkat yang hilang.
      </p>

      <h2>Perubahan dan kontak</h2>
      <p>Syarat ini dapat berubah. Pertanyaan dapat dikirim ke <Contact />.</p>
    </LegalPage>
  );
}
