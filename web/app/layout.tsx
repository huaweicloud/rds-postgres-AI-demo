import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/AgentIcon";
import { AuthBar } from "@/components/AuthBar";
import { SupabaseProvider } from "@/lib/browser";
import { publicConfig } from "@/lib/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "StackDowser",
  description: "Evidence-backed infrastructure and tech stack profiles from public sources.",
};

// Config is read per request, not baked in at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = publicConfig();
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SupabaseProvider supabaseUrl={config.supabaseUrl} anonKey={config.anonKey}>
          <header className="topbar">
            <Link href="/" className="brand">
              <BrandMark />
              <span>
                Stack<span>Dowser</span>
              </span>
            </Link>
            <nav>
              <Link href="/watchlist">Watchlist</Link>
              <AuthBar />
            </nav>
          </header>
          <main>{children}</main>
          <footer className="foot">
            Public sources only: web pages, DNS, certificate transparency and public APIs. No
            scanning, no logins.
          </footer>
        </SupabaseProvider>
      </body>
    </html>
  );
}
