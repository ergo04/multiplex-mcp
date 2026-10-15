import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

function Box({
  title,
  highlight = false,
  children,
}: {
  title: string
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border p-4",
        highlight
          ? "border-foreground/30 bg-card shadow-sm"
          : "border-border bg-background"
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.7rem] wrap-anywhere text-foreground">
      {children}
    </span>
  )
}

function Flow({
  icon: Icon,
  wideIcon: WideIcon,
  children,
}: {
  icon: LucideIcon
  wideIcon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden className="size-3.5 md:hidden" />
      <WideIcon aria-hidden className="hidden size-3.5 md:block" />
      {children}
    </span>
  )
}

function Arrows({ request, response }: { request: string; response: string }) {
  return (
    <div className="flex items-center justify-center gap-x-6 gap-y-2 py-1 font-mono text-[0.7rem] text-muted-foreground md:flex-col md:items-start md:py-0">
      <Flow icon={ArrowDown} wideIcon={ArrowRight}>
        {request}
      </Flow>
      <Flow icon={ArrowUp} wideIcon={ArrowLeft}>
        {response}
      </Flow>
    </div>
  )
}

export function FlowDiagram() {
  return (
    <figure className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
        <Box title="Your client">
          <span>
            <span className="text-foreground">claude.ai</span>: OAuth token from
            the gateway
          </span>
          <span>
            <span className="text-foreground">Claude Code</span>: static client
            token
          </span>
        </Box>

        <Arrows request="your token" response="response" />

        <Box title="Your gateway" highlight>
          <Mono>/m/resend/work/mcp</Mono>
          <span>Checks the token was issued for this URL.</span>
          <span>
            Drops it and adds the key in <Mono>ACCOUNT_RESEND_WORK</Mono>.
          </span>
        </Box>

        <Arrows request="API key" response="stream" />

        <Box title="The real MCP server">
          <Mono>mcp.resend.com/mcp</Mono>
          <span>Sees the account&apos;s API key and the MCP request.</span>
        </Box>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        One request to the work Resend account. The personal one goes through{" "}
        <span className="font-mono">/m/resend/personal/mcp</span> and its own
        secret, to the same server.
      </figcaption>
    </figure>
  )
}
