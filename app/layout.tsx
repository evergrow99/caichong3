import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AICHONG",
  description: "发布创作任务、查看投稿并选择满意结果"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
