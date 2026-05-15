import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeckFlow — Presentations from a prompt",
  description:
    "Type a topic, pick a theme, get a polished deck. DeckFlow writes, designs, and exports PowerPoint-ready presentations in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
