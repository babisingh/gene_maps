import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Gene-Maps — 3D Genome Drug Discovery",
  description:
    "Explore spatial pharmacogenomics: 3D gene interaction networks, cross-species conservation, CRISPR safety, and drug target scoring powered by real genomic data.",
  keywords: ["spatial genomics", "pharmacogenomics", "drug discovery", "CRISPR", "gene network", "gene-maps"],
  openGraph: {
    title: "Gene-Maps",
    description: "Consumer-friendly spatial pharmacogenomics research tool",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
