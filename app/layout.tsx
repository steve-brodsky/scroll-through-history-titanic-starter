import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scroll Through History",
  description: "Experience history as a living chronological feed."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
