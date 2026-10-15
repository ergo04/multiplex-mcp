import { Code } from "@/components/ui/code"
import { Section, Strong, TextLink } from "@/components/ui/section"
import { VarList } from "@/components/ui/var-list"

const BUILT_IN = [
  {
    name: "Linear",
    upstream: "https://mcp.linear.app/mcp",
    key: "a personal API key",
    secret: "ACCOUNT_LINEAR_<ACCOUNT>",
  },
  {
    name: "Resend",
    upstream: "https://mcp.resend.com/mcp",
    key: "an API key",
    secret: "ACCOUNT_RESEND_<ACCOUNT>",
  },
]

export function ServicesSection() {
  return (
    <Section
      id="services"
      label="Services"
      title="Linear, Resend, or any MCP server that takes an API key"
      muted
    >
      <p>
        Two services are built in. I only list servers I checked accept an API
        key as a bearer token.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {BUILT_IN.map((service) => (
          <li
            key={service.name}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-background p-4"
          >
            <p className="font-medium text-foreground">{service.name}</p>
            <p className="font-mono text-xs wrap-anywhere text-foreground">
              {service.upstream}
            </p>
            <p className="text-xs">
              Takes {service.key}, sent as <Code>Authorization: Bearer</Code>.
              Secret: <Code>{service.secret}</Code>.
            </p>
          </li>
        ))}
      </ul>

      <h3 className="pt-4 text-base font-medium text-foreground">
        Any other server
      </h3>
      <p>
        For an MCP server that isn&apos;t built in, tell the gateway where it is
        with plain text variables (not secrets), then add accounts as usual. The
        name you pick in <Code>SERVICE_&lt;NAME&gt;_*</Code> is the one you use
        in <Code>ACCOUNT_&lt;NAME&gt;_*</Code>.
      </p>

      <VarList
        label="Settings → Variables and Secrets"
        rows={[
          ["SERVICE_EXAMPLE_URL", "https://mcp.example.com/mcp"],
          ["SERVICE_EXAMPLE_HEADER", "X-Api-Key"],
          ["SERVICE_EXAMPLE_NAME", "Example"],
          ["ACCOUNT_EXAMPLE_TEAM", "the API key, as a secret"],
        ]}
      />

      <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">
        <li>
          <Strong>
            <Code>SERVICE_&lt;NAME&gt;_URL</Code>
          </Strong>{" "}
          is the server&apos;s MCP endpoint. It must be https. Setting it for{" "}
          <Code>LINEAR</Code> or <Code>RESEND</Code> overrides the built-in one.
        </li>
        <li>
          <Strong>
            <Code>SERVICE_&lt;NAME&gt;_HEADER</Code>
          </Strong>{" "}
          is optional: the key goes in that header instead of{" "}
          <Code>Authorization: Bearer</Code>. Letters, digits and hyphens;{" "}
          <Code>Host</Code>, <Code>Content-Length</Code> and <Code>Cookie</Code>{" "}
          are refused.
        </li>
        <li>
          <Strong>
            <Code>SERVICE_&lt;NAME&gt;_NAME</Code>
          </Strong>{" "}
          is optional too: the display name on the status and consent pages.
        </li>
      </ul>

      <p>
        Servers that only accept OAuth, like Vercel&apos;s MCP, don&apos;t work
        yet. See <TextLink href="#limits">Limits</TextLink>.
      </p>
    </Section>
  )
}
