import type { Metadata } from "next";
import { SignInPage } from "@/components/account/SignInPage";

export const metadata: Metadata = { title: "Masuk ke Denahin" };

export default function Page() {
  return <SignInPage />;
}
