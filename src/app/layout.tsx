import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer, Header } from "@/components/layout/SiteChrome";
import { CompareTray } from "@/components/models/compare";
import { themeInitScript } from "@/components/layout/theme";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "OneAtlas: every AI model, compared", template: "%s · OneAtlas" },
  description: "Discover, compare and rank AI models across labs and providers: specs, pricing, capabilities and benchmarks.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1216" },
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
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 sm:px-6">
            {children}
          </main>
          <Footer />
          <CompareTray />
        </Providers>
      </body>
    </html>
  );
}
