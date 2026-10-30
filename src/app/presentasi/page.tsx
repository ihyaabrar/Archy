import type { Metadata } from "next";
import { Presentation } from "@/components/presentation/Presentation";

export const metadata: Metadata = {
  title: "Presentasi denah",
  description: "Denah rumah yang berdiri jadi bangunan 3D saat digulir, dibuat dengan Denahin.",
};

export default function Page() {
  return <Presentation />;
}
