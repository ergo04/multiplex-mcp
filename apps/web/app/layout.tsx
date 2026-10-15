import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { SITE_URL } from "@/lib/links"
import { THEME_SCRIPT } from "@/lib/theme"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const DESCRIPTION =
  "A Cloudflare Worker that gives every account of an MCP service its own connector URL, so claude.ai and Claude Code can use two Resend accounts or three Linear workspaces."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "multiaccount-mcp-gateway",
  description: DESCRIPTION,
  authors: [{ name: "Simone Ergotino", url: "https://simoneergotino.it" }],
  openGraph: {
    type: "website",
    url: "/",
    title: "multiaccount-mcp-gateway",
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141114" },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // The theme script adds `dark` before React hydrates.
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} antialiased`}
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
