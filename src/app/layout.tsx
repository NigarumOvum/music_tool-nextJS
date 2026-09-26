import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { Providers } from "@/components/providers";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "BandsChamber Studio",
    template: "%s · BandsChamber Studio",
  },
  description: "Standalone music production workspace for songs, lyrics, DAW flows, and tab editing.",
  applicationName: "BandsChamber Studio",
  authors: [{ name: "BandsChamber Studio" }],
  keywords: ["music", "DAW", "lyrics", "tabs", "production", "songwriting", "studio"],
  manifest: "/manifest.webmanifest",
  category: "music",
  appleWebApp: {
    capable: true,
    title: "BandsChamber Studio",
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/icons/icon-512x512.png" },
    ],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    siteName: "BandsChamber Studio",
    title: "BandsChamber Studio",
    description: "Standalone music production workspace for songs, lyrics, DAW flows, and tab editing.",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "BandsChamber Studio",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "BandsChamber Studio",
    description: "Standalone music production workspace for songs, lyrics, DAW flows, and tab editing.",
    images: ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/icons/icon-192x192.png"],
    apple: [
      { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/icons/icon-180x180.png",
      },
      {
        rel: "mask-icon",
        url: "/icons/icon.svg",
        color: "#8b5cf6",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8b5cf6" },
    { media: "(prefers-color-scheme: dark)", color: "#4c1d95" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}
      data-theme="light"
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BandsChamber" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="BandsChamber Studio" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#8b5cf6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#4c1d95" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
