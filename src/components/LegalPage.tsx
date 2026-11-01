import Link from "next/link";
import type { ReactNode } from "react";

// Kerangka halaman hukum. Label draf tampil jelas sampai isinya ditinjau ahli hukum dan kontak resmi diisi.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="stencil auth-brand">
        Denahin
      </Link>
      <article className="legal-body">
        <h1 className="stencil">{title}</h1>
        <p className="legal-draft" role="note">
          Draf: belum ditinjau ahli hukum.
        </p>
        {children}
        <nav className="legal-nav" aria-label="Halaman lain">
          <Link href="/privasi">Kebijakan Privasi</Link>
          <Link href="/syarat">Syarat Layanan</Link>
          <Link href="/">Daftar proyek</Link>
        </nav>
      </article>
    </main>
  );
}

// Alamat kontak pemilik layanan untuk pertanyaan privasi, penghapusan akun, dan syarat.
export const CONTACT_EMAIL = 'ihyakpati1144@gmail.com'

export function Contact() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
}
