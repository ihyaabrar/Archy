import type { Metadata } from "next";
import { Big_Shoulders_Stencil, IBM_Plex_Mono, IBM_Plex_Sans, Stardos_Stencil } from "next/font/google";
import "./globals.css";

// Plex dibuat untuk konteks teknik: jelas di ukuran kecil, angka mono sejajar untuk dimensi.
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
// Stensil sans tebal untuk judul besar halaman depan (gaya lembar gambar kerja).
const display = Big_Shoulders_Stencil({ variable: "--font-display", subsets: ["latin"], weight: ["800", "900"] });
// Stensil: tradisi lettering di gambar kerja arsitek, dipakai hanya untuk judul dan nama ruangan.
const stencil = Stardos_Stencil({ variable: "--font-stencil", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: "Denahin", template: "%s · Denahin" },
  description: "Gambar denah rumah langsung di browser, lihat jadi bangunan 3D, dan berjalan di dalamnya.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable} ${stencil.variable} ${display.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
