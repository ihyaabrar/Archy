import { Suspense } from "react";
import { EditorRoute } from "@/components/editor/EditorRoute";

// Id proyek baru diketahui di browser (useParams), jadi editor dirender di dalam Suspense.
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="state-screen" aria-busy="true">
          <p>Membuka proyek…</p>
        </main>
      }
    >
      <EditorRoute />
    </Suspense>
  );
}
