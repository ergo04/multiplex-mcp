import { ArrowDown } from "lucide-react"
import { CONTAINER } from "@/lib/layout"
import { SECTIONS } from "@/lib/sections"
import { Badge } from "@/components/ui/badge"
import { SectionLabel } from "@/components/ui/section-label"
import { Code } from "@/components/ui/code"
import { DeployButton } from "@/components/ui/deploy-button"

export function HeroSection() {
  return (
    <section className="border-b border-border/60">
      <div
        className={`${CONTAINER} grid gap-12 pt-16 pb-14 sm:pt-24 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end`}
      >
        <div className="flex max-w-3xl flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge>Cloudflare Worker</Badge>
            <Badge>claude.ai + Claude Code</Badge>
            <Badge>MIT</Badge>
          </div>

          <h1 className="text-4xl leading-[1.05] tracking-[-0.04em] text-balance sm:text-6xl">
            Several accounts of the same MCP service,{" "}
            <span className="text-muted-foreground">
              in claude.ai and Claude Code.
            </span>
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground">
            claude.ai takes a custom connector once per URL, so a second Resend
            account or a third Linear workspace has no way in. This is a
            Cloudflare Worker you deploy in your own account. It gives every
            account its own URL, like <Code>/m/resend/work/mcp</Code> and{" "}
            <Code>/m/resend/personal/mcp</Code>, and forwards each request to
            the real MCP server with that account&apos;s API key.
          </p>

          {/* One primary action: the Deploy button has its own look, so the
              second way in is a plain link that can't compete with it. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <DeployButton />
            <a
              href="#setup"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Read the setup
              <ArrowDown aria-hidden className="size-3.5" />
            </a>
          </div>
        </div>

        <nav aria-label="On this page">
          <SectionLabel>On this page</SectionLabel>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col lg:gap-y-1.5">
            {SECTIONS.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="group inline-flex gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="hidden text-foreground tabular-nums lg:inline">
                    {String(index + 1).padStart(2, "0")}.
                  </span>
                  <span className="underline decoration-border underline-offset-4 group-hover:decoration-foreground lg:no-underline">
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  )
}
