import type { Metadata } from "next";
import { ResetPasswordPage } from "@/components/account/ResetPasswordPage";

export const metadata: Metadata = { title: "Atur kata sandi baru" };

export default function Page() {
  return <ResetPasswordPage />;
}
