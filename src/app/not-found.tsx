import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-screen">
      <h1 className="stencil">Halaman tidak ada</h1>
      <p>Alamat ini tidak ada di Denahin. Mungkin salah ketik atau tautannya sudah lama.</p>
      <Link className="btn btn-accent btn-link" href="/">
        Ke daftar proyek
      </Link>
    </main>
  );
}
