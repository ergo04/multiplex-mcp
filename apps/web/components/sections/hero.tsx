import { buttonClass } from "@/lib/button"
import { REPO_URL } from "@/lib/links"
import { Badge } from "@/components/ui/badge"
import { Code } from "@/components/ui/code"
import { DeployButton } from "@/components/ui/deploy-button"
import { GitHubMark } from "@/components/ui/github-mark"

const CONTENTS = [
  { href: "#problem", label: "The problem" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#setup", label: "Setup" },
  { href: "#claude-code", label: "Claude Code" },
  { href: "#services", label: "Services" },
  { href: "#configuration", label: "Configuration" },
  { href: "#security", label: "Security" },
  { href: "#limits", label: "Limits" },
  { href: "#faq", label: "FAQ" },
]

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

          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
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
            <p className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
              On this page
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {CONTENTS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
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
