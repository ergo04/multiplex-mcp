import { AUTHOR_URL, PREDECESSOR_URL, REPO_URL } from "@/lib/links"

const LINKS = [
  { label: "GitHub", href: REPO_URL },
  { label: "linear-mcp-gateway", href: PREDECESSOR_URL },
  { label: "simoneergotino.it", href: AUTHOR_URL },
]

export function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <span>
          multiaccount-mcp-gateway · MIT · by{" "}
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground transition-colors hover:underline hover:underline-offset-4"
          >
            Simone Ergotino
          </a>
        </span>
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
    </footer>
  )
}
