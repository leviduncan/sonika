import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trysonika.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sonika | White-label Voice AI for agencies",
  description:
    "Launch AI voice agents for every client in under 10 minutes. White-label Voice AI built specifically for GoHighLevel, Local SEO, Web Design and Lead Gen agencies.",
  openGraph: {
    title: "Sonika — White-label Voice AI for agencies",
    description: "Launch AI voice agents for every client in under 10 minutes.",
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
