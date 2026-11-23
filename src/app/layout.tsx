// Root layout: fonts, theme bootstrap script, header/footer chrome, client providers and the compare tray.
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer, Header } from "@/components/layout/SiteChrome";
import { CompareTray } from "@/components/models/compare";
import { themeInitScript } from "@/components/layout/theme";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// mono is only used for ids and the code viewer: no preload, so it never competes with the page font
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: { default: "OneAtlas: every AI model, compared", template: "%s · OneAtlas" },
  description: "Discover, compare and rank AI models across labs and providers: specs, pricing, capabilities and benchmarks.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may set data-theme before React hydrates
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Providers>
          <Header />
          <main id="main" className="w-full min-w-0 flex-1 px-4 sm:px-6 lg:px-8 2xl:px-10">
            {children}
          </main>
          <Footer />
          <Suspense fallback={null}>
            <CompareTray />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
