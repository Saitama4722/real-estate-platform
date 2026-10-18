import type { Metadata, Viewport } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FavoritesProvider } from "@/lib/favorites";
import { CompareProvider } from "@/lib/compare";
import { CompareBar } from "@/components/compare/CompareBar";
import { RevealController } from "@/components/layout/RevealController";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { SiteChrome } from "@/components/layout/SiteChrome";

/**
 * Golos Text — the design system's single type family, chosen for full Cyrillic
 * coverage (subsets: cyrillic, cyrillic-ext, latin, latin-ext). Loaded as a
 * variable font, so 400/500/600/700 all come from one file.
 *
 * The control-height scale (buttons 32/40/48, fields 40) is metric-tuned to this
 * face — swapping it means re-checking every control (load-bearing decision #3).
 */
const golosText = Golos_Text({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  variable: "--font-golos",
});

const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "ЦЕНТРЕАЛЪ — недвижимость Краснодара и Геленджика",
};

/**
 * Icons, manifest and OG image are declared HERE ONLY. The files live in
 * public/ (copied from the brand package, SVGs stripped of C2PA metadata).
 * ⚠ Do not add app/favicon.ico or app/icon.* — the App Router auto-serves those
 * and they would emit a second, competing set of <link rel="icon"> tags.
 *
 * metadataBase makes the OG/twitter image URLs absolute. Same env var as
 * siteOrigin(), but with an unconditional fallback: `new URL("")` would throw.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3001",
  ),
  title: "ЦЕНТРЕАЛЪ — Недвижимость",
  description: "Платформа недвижимости Краснодарского края",
  applicationName: "ЦЕНТРЕАЛЪ",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    siteName: "ЦЕНТРЕАЛЪ",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE],
  },
};

/* Next 15 moved themeColor out of `metadata` into the viewport export. */
export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={golosText.variable}>
      <body className="flex flex-col min-h-screen">
        <FavoritesProvider>
          <CompareProvider>
            {/* Renders nothing; arms the section reveal and the compact header.
                Must stay mounted for both — see RevealController. */}
            <RevealController />
            {/* Fills the silent gap between a nav click and the RSC payload
                arriving. Renders an overlay only while a pathname change is in
                flight — see NavigationProgress. */}
            <NavigationProgress />
            {/* Auth routes are full-bleed split screens with their own
                branding, so the site chrome is withheld there. Header/Footer
                are still SERVER-rendered and passed through as slots. */}
            <SiteChrome>
              <Header />
            </SiteChrome>
            <main className="flex-1">{children}</main>
            <SiteChrome>
              <Footer />
              <CompareBar />
            </SiteChrome>
          </CompareProvider>
        </FavoritesProvider>
      </body>
    </html>
  );
}
