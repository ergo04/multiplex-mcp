import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { Code } from "@/components/ui/code"
import { Section, TextLink } from "@/components/ui/section"
import { NO_REFRESH_ISSUE } from "@/lib/links"

function Point({
  title,
  caveat = false,
  children,
}: {
  title: string
  caveat?: boolean
  children: ReactNode
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-4",
        // The limit is marked with weight, not orange: the accent is for actions.
        caveat ? "border-foreground/50" : "border-border"
      )}
    >
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p>{children}</p>
    </li>
  )
}

export function SecuritySection() {
  return (
    <Section
      id="security"
      label="Security"
      title="What keeps your accounts yours"
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Point title="One owner, one password">
          The status page and the consent page ask for{" "}
          <Code>OWNER_PASSWORD</Code>, at most 10 attempts a minute per IP.
          Changing the password signs every browser out.
        </Point>
        <Point title="An OAuth token opens one connector">
          OAuth tokens carry their connector as audience (RFC 8707). A token for
          a Resend account doesn&apos;t open Linear, nor the other Resend
          account.
        </Point>
        <Point title="Only allowlisted clients">
          By default only claude.ai and Claude Code may start an authorization;
          add others, like ChatGPT, with <Code>ALLOWED_CLIENTS</Code>. The check
          runs before the gateway fetches any client metadata, so nobody can
          make it fetch a URL of their choice.
        </Point>
        <Point title="No open registration">
          Dynamic client registration is off by default, so nobody can register
          a client or use up your KV writes.
        </Point>
        <Point title="Long-lived tokens, on purpose">
          30 days for access tokens and 180 sliding for refresh tokens, because
          claude.ai may never refresh a custom connector&apos;s token (
          <TextLink href={NO_REFRESH_ISSUE}>
            anthropics/claude-ai-mcp#228
          </TextLink>
          ). Both can be shortened.
        </Point>
        <Point title="Keys stay in secrets">
          API keys live only in Worker secrets, never in KV. What the OAuth
          grants in KV carry is encrypted with a key only the token holder can
          unwrap.
        </Point>
        <Point title="The upstream sees only the request">
          It gets the account&apos;s key, the MCP request and a short list of
          headers, never your token or cookies. Your client never sees the
          upstream&apos;s auth challenge or cookies.
        </Point>
        <Point title="The public page names nothing">
          Signed out, the home page shows only counts. Problem details name the
          variable at fault, and only after you sign in.
        </Point>
        <Point title="The other side of it" caveat>
          Whoever has the password, or a client token, reaches every account
          that password or token opens. Treat them like the API keys themselves.
        </Point>
      </ul>
    </Section>
  )
}
