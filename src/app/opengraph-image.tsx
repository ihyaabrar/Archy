import { ImageResponse } from "next/og";

// Gambar pratinjau saat tautan Denahin dibagikan (WhatsApp, Slack, dsb.). Isi teks = fitur yang memang ada.
export const alt = "Denahin: gambar denah rumah, lihat 3D, dan berjalan di dalamnya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#f3eee3",
          color: "#2a2420",
          border: "12px solid #2a2420",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, fontFamily: "serif" }}>Denahin</div>
        <div style={{ fontSize: 44, marginTop: 24, maxWidth: 900 }}>Gambar denah rumah, lihat jadi 3D, lalu berjalan di dalamnya.</div>
        <div style={{ width: 220, height: 10, background: "#a8401a", marginTop: 40 }} />
      </div>
    ),
    size,
  );
}
