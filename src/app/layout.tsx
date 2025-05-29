// src/app/layout.tsx  ──★ Server Component (← "use client" なし)
import type { Metadata } from "next";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Toaster } from "@/components/ui/toaster";
import DevToolsScript from "@/components/DevToolsScript";   // ← 追加

/* ここはそのまま */
export const metadata: Metadata = {
  title: "Melody Sketcher",
  description: "A web-based MIDI keyboard with recording and scale-locking features.",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
     <html lang="en" className={inter.className}>
     <body className={`${inter.className} antialiased`}>
        {/* ← Client Component をここで呼び出す */}
        <DevToolsScript />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
