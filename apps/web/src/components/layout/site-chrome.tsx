"use client";

import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { Header } from "./header";
import { Footer } from "./footer";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Topbar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
