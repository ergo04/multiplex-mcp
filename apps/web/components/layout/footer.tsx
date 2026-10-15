import { ArrowUpRight } from "lucide-react"
import { BrandMark } from "@/components/ui/brand-mark"
import { AUTHOR_URL, PREDECESSOR_URL, REPO_URL } from "@/lib/links"

const LINKS = [
  { label: "GitHub", href: REPO_URL },
  { label: "linear-mcp-gateway", href: PREDECESSOR_URL },
]

export function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:px-6">
        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
        >
          <BrandMark className="mt-0.5 size-8 shrink-0 text-foreground" />
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-1 font-display text-base font-semibold tracking-tight text-foreground">
              Built by Simone Ergotino
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              AI Automation Engineer. I take the repetitive work out of the days
              of professionals and small businesses, without making them change
              the software they use.
            </span>
          </span>
        </a>

        <div className="flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>multiaccount-mcp-gateway · MIT</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
