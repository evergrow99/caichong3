"use client";

import { useState } from "react";

export function StaticCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={handleCopy}>
      {copied ? "已复制" : "复制链接"}
    </button>
  );
}
