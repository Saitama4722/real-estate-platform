import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Centreal — Недвижимость",
  description: "Платформа недвижимости Краснодарского края",
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
