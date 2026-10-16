import { ArrowUp, ArrowUpRight } from "lucide-react"
import { BrandMark } from "@/components/ui/brand-mark"
import { MupxMark } from "@/components/ui/mupx-mark"
import { SectionLabel } from "@/components/ui/section-label"
import { CONTAINER } from "@/lib/layout"
import { AUTHOR_URL, DEPLOY_URL, REPO_URL } from "@/lib/links"

const GROUPS = [
  {
    label: "Project",
    links: [
      { label: "Source on GitHub", href: REPO_URL },
      { label: "Deploy to Cloudflare", href: DEPLOY_URL },
      { label: "Report an issue", href: `${REPO_URL}/issues` },
    ],
  },
  {
    label: "Docs",
    links: [
      { label: "Setup", href: "#setup" },
      { label: "Configuration", href: "#configuration" },
      { label: "Security", href: "#security" },
      { label: "FAQ", href: "#faq" },
    ],
  },
]

const LINK =
  "text-muted-foreground transition-colors hover:text-foreground hover:underline hover:decoration-border hover:underline-offset-4"

function external(href: string) {
  return href.startsWith("http")
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {}
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className={`${CONTAINER} flex flex-col gap-12 pt-14 pb-10`}>
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <a href="#" className="flex items-center gap-2.5 self-start">
              <MupxMark className="size-8 text-foreground" />
              <span className="font-display text-2xl font-semibold tracking-tight">
                mupx
              </span>
            </a>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Multiplex MCP: one connector per account, for claude.ai, ChatGPT,
              Claude Code and other MCP clients. A Cloudflare Worker you run in
              your own account.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-16 gap-y-8 text-sm"
          >
            {GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                <SectionLabel>{group.label}</SectionLabel>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        {...external(link.href)}
                        className={LINK}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 sm:items-center sm:gap-5 sm:p-6"
        >
          <BrandMark className="mt-0.5 size-8 shrink-0 text-foreground sm:mt-0" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-1 font-display text-base font-semibold tracking-tight text-foreground">
              Built by Simone Ergotino
              <ArrowUpRight className="size-4 text-muted-foreground sm:hidden" />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              AI Automation Engineer. I take the repetitive work out of the days
              of professionals and small businesses, without making them change
              the software they use.
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-foreground sm:flex">
            simoneergotino.it
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
          </span>
        </a>

        <div className="flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            MIT License · © 2026 Simone Ergotino. Not affiliated with Anthropic
            or Cloudflare.
          </span>
          <a href="#" className={`inline-flex items-center gap-1 ${LINK}`}>
            Back to top
            <ArrowUp aria-hidden className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  )
}
