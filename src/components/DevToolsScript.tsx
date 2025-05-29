// src/components/DevToolsScript.tsx
"use client";

import Script from "next/script";

/**
 * ── Eruda（モバイル向け DevTools）を読み込んで初期化するだけの
 *     Client Component。
 */
export default function DevToolsScript() {
  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/eruda@3"
      strategy="afterInteractive"          // ページ描画後に読み込む
      onLoad={() => {
        // iOS Safari などで window.eruda が生えたら初期化
        if (typeof window !== "undefined" && (window as any).eruda) {
          (window as any).eruda.init();
        }
      }}
    />
  );
}
