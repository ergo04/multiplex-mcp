import { Split } from "lucide-react"
import { buttonClass } from "@/lib/button"
import { REPO_URL } from "@/lib/links"
import { GitHubMark } from "@/components/ui/github-mark"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const NAV = [
  { href: "/#setup", label: "Setup" },
  { href: "/#configuration", label: "Configuration" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "FAQ" },
]

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="/" className="flex min-w-0 items-center gap-2">
          <Split className="size-4 shrink-0 rotate-90 text-foreground" />
          <span className="truncate font-display text-[0.95rem] font-semibold tracking-tight">
            mupx
          </span>
        </a>
        <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`${buttonClass({ variant: "ghost" })} text-muted-foreground hover:text-foreground`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source on GitHub"
            className={buttonClass({ variant: "ghost" })}
          >
            <GitHubMark />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
