import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BFHL — Hierarchy Inspector",
  description:
    "Submit a list of edges and inspect the resulting hierarchies, cycles, and summary stats.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
