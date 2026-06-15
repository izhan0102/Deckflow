import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import MobileGate from "@/components/MobileGate";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import {
  SITE_URL, BRAND, KEYWORDS, DEFAULT_TITLE, TITLE_TEMPLATE, DEFAULT_DESCRIPTION,
  softwareJsonLd, organizationJsonLd, websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: BRAND,
  keywords: KEYWORDS,
  authors: [{ name: "Muhammad Izhan" }],
  creator: "Muhammad Izhan",
  publisher: BRAND,
  category: "Productivity",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    creator: "@izhan0102",
  },
  icons: {
    icon: "/icon",
    apple: "/icon",
  },
};

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@400;500;600;700;800",
    "family=Manrope:wght@400;500;600;700;800",
    "family=DM+Sans:wght@400;500;700",
    "family=Work+Sans:wght@400;500;600;700",
    "family=Plus+Jakarta+Sans:wght@400;500;600;700;800",
    "family=Outfit:wght@400;500;600;700;800",
    "family=Space+Grotesk:wght@400;500;700",
    "family=IBM+Plex+Sans:wght@400;500;600;700",
    "family=Figtree:wght@400;500;600;700;800",
    "family=Playfair+Display:wght@400;600;700;800",
    "family=Lora:wght@400;500;600;700",
    "family=Merriweather:wght@400;700",
    "family=Fraunces:wght@400;600;700;800",
    "family=Source+Serif+Pro:wght@400;600;700",
    "family=Bricolage+Grotesque:wght@400;600;700;800",
    "family=Syne:wght@400;600;700;800",
    "family=Archivo:wght@400;600;700;800",
    "family=Roboto:wght@400;500;700",
    "family=Open+Sans:wght@400;600;700;800",
    "family=Lato:wght@400;700;900",
    "family=Montserrat:wght@400;500;600;700;800",
    "family=Poppins:wght@400;500;600;700;800",
    "family=Raleway:wght@400;500;600;700;800",
    "family=Nunito:wght@400;600;700;800",
    "family=PT+Sans:wght@400;700",
    "family=Oswald:wght@400;500;600;700",
    "family=Roboto+Slab:wght@400;500;700;800",
    "family=Fontdiner+Swanky",
    "family=Fredoka:wght@400;500;600;700",
    "family=JetBrains+Mono:wght@400;500;700",
  ].join("&") + "&display=swap";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Theme boot — runs synchronously before paint to set
            data-theme on <html> so light-mode users don't see a
            dark flash on load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />

        {/* Structured data — tells Google this is a free web app for
            making PowerPoint presentations, plus the brand/site graph.
            Rich-result eligible and a strong relevance signal. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />

        {/* Preconnect speeds up the first paint of any font we end up using. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body>
        {children}
        <MobileGate />
        <Analytics />
      </body>
    </html>
  );
}
