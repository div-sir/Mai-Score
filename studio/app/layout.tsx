import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mai-Score Studio",
  description: "Preview and customize maimai DX International B50 exports.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
