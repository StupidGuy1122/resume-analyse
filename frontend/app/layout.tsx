import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "resume-analyse — 智能简历分析",
  description: "上传你的简历，本地大模型秒级输出改进建议与面试题预测。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-gradient-to-b from-violet-50 via-background to-background">
        {children}
      </body>
    </html>
  );
}
