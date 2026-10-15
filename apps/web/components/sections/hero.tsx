import { buttonClass } from "@/lib/button"
import { REPO_URL } from "@/lib/links"
import { SECTIONS } from "@/lib/sections"
import { Badge } from "@/components/ui/badge"
import { SectionLabel } from "@/components/ui/section-label"
import { Code } from "@/components/ui/code"
import { DeployButton } from "@/components/ui/deploy-button"
import { GitHubMark } from "@/components/ui/github-mark"

export function HeroSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-3xl px-5 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <div className="flex flex-col gap-6">
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

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <DeployButton />
            <a href="#setup" className={buttonClass({ size: "lg" })}>
              Read the setup
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "outline", size: "lg" })}
            >
              <GitHubMark />
              Source
            </a>
          </div>

          <nav aria-label="On this page" className="pt-6">
            <SectionLabel>On this page</SectionLabel>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  )
}
