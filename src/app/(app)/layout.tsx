import { AppState } from "@/components/AppState";

// Dashboard, login, dan editor berbagi satu state proyek (dimuat sekali, tetap hidup saat berpindah halaman).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppState>{children}</AppState>;
}
