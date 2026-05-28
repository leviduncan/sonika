import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trysonika.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sonika | Voice infrastructure for marketing agencies",
  description:
    "Sonika is voice infrastructure built for marketing agencies. Building in public.",
  openGraph: {
    title: "Sonika — Voice infrastructure for agencies",
    description: "Voice infrastructure for marketing agencies. Building in public.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
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
