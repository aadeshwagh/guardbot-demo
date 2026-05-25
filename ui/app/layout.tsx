import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guard Bot — Runtime Governance",
  description: "Runtime governance and preventative security for agentic AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
