import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARES-MED OS | NASA Space Apps Astronaut Health Monitor",
  description:
    "Autonomous astronaut health monitoring, BioTwin organ-cascade mapping, and guided medical triage console built for the 2026 NASA Space Apps Challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-white selection:text-[#0a0a0a]">
        {children}
      </body>
    </html>
  );
}
