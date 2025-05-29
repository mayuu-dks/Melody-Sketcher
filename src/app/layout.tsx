// src/app/layout.tsx  ──★ Server Component (← "use client" なし)
import type { Metadata } from "next";
import { Geist_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import DevToolsScript from "@/components/DevToolsScript";   // ← 追加

/* ここはそのまま */
export const metadata: Metadata = {
  title: "Melody Sketcher",
  description: "A web-based MIDI keyboard with recording and scale-locking features.",
};

const geistSans = Geist_Sans({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ← Client Component をここで呼び出す */}
        <DevToolsScript />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
