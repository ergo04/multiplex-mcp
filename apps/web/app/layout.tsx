import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google"
import type { ReactNode } from "react"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { SITE_URL } from "@/lib/links"
import { THEME_SCRIPT } from "@/lib/theme"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-inter-tight",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const DESCRIPTION =
  "A Cloudflare Worker that gives every account of an MCP service its own connector URL, so claude.ai, ChatGPT, Claude Code or any other MCP client can use two Resend accounts or three Linear workspaces."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "mupx",
  description: DESCRIPTION,
  authors: [{ name: "Simone Ergotino", url: "https://simoneergotino.it" }],
  openGraph: {
    type: "website",
    url: "/",
    title: "mupx",
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // The theme script adds `dark` before React hydrates.
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="min-h-svh bg-background text-foreground">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
