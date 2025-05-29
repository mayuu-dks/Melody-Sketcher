import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google'; // Corrected import for Geist font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster for notifications
import Script from "next/script";


const geistSans = Geist({ // Corrected instantiation
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({ // Corrected instantiation
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Melody Sketcher',
  description: 'A web-based MIDI keyboard with recording and scale-locking features.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
   {/* --- Eruda Dev Console (debug only) ------------------ */}
    <Script
      src="https://cdn.jsdelivr.net/npm/eruda@3"
      strategy="afterInteractive"
      onLoad={() => {
        // @ts-ignore
        window.eruda && window.eruda.init();
      }}
    />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
