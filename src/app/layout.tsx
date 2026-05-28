import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sonika | Voice infrastructure for marketing agencies",
  description:
    "Sonika is voice infrastructure built for marketing agencies. Building in public.",
  openGraph: {
    title: "Sonika — Voice infrastructure for agencies",
    description: "Voice infrastructure for marketing agencies. Building in public.",
    type: "website",
  },
  twitter: {
    card: "summary",
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
