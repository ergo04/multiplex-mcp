import type { ReactNode } from "react"
import { CodeBlock } from "@/components/ui/code-block"
import { Code } from "@/components/ui/code"
import { Section, Strong } from "@/components/ui/section"

interface Variable {
  name: string
  kind: "secret" | "variable"
  required?: boolean
  fallback?: ReactNode
  children: ReactNode
}

const VARIABLES: Variable[] = [
  {
    name: "OWNER_PASSWORD",
    kind: "secret",
    required: true,
    children: (
      <>
        The password for the status page and the consent page. Without it nobody
        can approve a connector.
      </>
    ),
  },
  {
    name: "ACCOUNT_<SERVICE>_<ACCOUNT>",
    kind: "secret",
    children: (
      <>
        One per account: its API key. Becomes the connector{" "}
        <Code>/m/&lt;service&gt;/&lt;account&gt;/mcp</Code>.
      </>
    ),
  },
  {
    name: "SERVICE_<NAME>_URL",
    kind: "variable",
    children: (
      <>
        The MCP endpoint of a service that isn&apos;t built in, or an override
        for a built-in one. https only.
      </>
    ),
  },
  {
    name: "SERVICE_<NAME>_HEADER",
    kind: "variable",
    fallback: <Code>Authorization: Bearer</Code>,
    children: <>The header that carries the API key.</>,
  },
  {
    name: "SERVICE_<NAME>_NAME",
    kind: "variable",
    fallback: "the built-in name, or the service slug",
    children: <>Display name on the status and consent pages.</>,
  },
  {
    name: "CLIENT_TOKEN_<NAME>",
    kind: "secret",
    children: (
      <>
        A static bearer token for a client that can send headers, like Claude
        Code. At least 32 characters.
      </>
    ),
  },
  {
    name: "CLIENT_PATHS_<NAME>",
    kind: "variable",
    fallback: "every connector",
    children: (
      <>
        Comma-separated connector paths the token with the same name may open.
      </>
    ),
  },
  {
    name: "PUBLIC_URL",
    kind: "variable",
    fallback: "the origin of each request",
    children: (
      <>
        Pins the gateway to one origin, such as your own domain. Requests on any
        other hostname get a plain 404 that doesn&apos;t name the right one, so
        a hard-to-guess hostname stays hard to guess.
      </>
    ),
  },
  {
    name: "ACCESS_TOKEN_DAYS",
    kind: "variable",
    fallback: "30",
    children: <>How long an OAuth access token lasts.</>,
  },
  {
    name: "REFRESH_TOKEN_DAYS",
    kind: "variable",
    fallback: "180",
    children: (
      <>
        How long a refresh token lasts. It slides: the grant stays alive while
        the connector is in use.
      </>
    ),
  },
  {
    name: "ALLOWED_CLIENTS",
    kind: "variable",
    fallback: "claude.ai and Claude Code",
    children: (
      <>
        Comma-separated Client ID Metadata Document URLs that may start an
        authorization.
      </>
    ),
  },
  {
    name: "DYNAMIC_REGISTRATION",
    kind: "variable",
    fallback: "off",
    children: (
      <>
        <Code>true</Code> turns on dynamic client registration (RFC 7591) at{" "}
        <Code>/oauth/register</Code>. Registered clients may only redirect to
        claude.ai&apos;s callback, or over http to <Code>localhost</Code>,{" "}
        <Code>127.0.0.1</Code> or <Code>[::1]</Code>.
      </>
    ),
  },
]

export function ConfigurationSection() {
  return (
    <Section
      id="configuration"
      label="Configuration"
      title="Every setting is a variable or a secret on the Worker"
    >
      <p>
        Nothing is configured in code, so the fork the Deploy button makes
        doesn&apos;t need editing. Credentials go in as <Strong>secrets</Strong>
        , the rest as plain text <Strong>variables</Strong>, both under{" "}
        <Strong>Settings → Variables and Secrets</Strong>. The Worker keeps what
        you set in the dashboard when it is redeployed from your fork (
        <Code>keep_vars</Code> is on).
      </p>

      <dl className="flex flex-col divide-y divide-border border-y border-border">
        {VARIABLES.map((variable) => (
          <div key={variable.name} className="flex flex-col gap-1.5 py-4">
            <dt className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[0.8rem] font-medium wrap-anywhere text-foreground">
                {variable.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {variable.kind === "secret" ? "Secret" : "Variable"}
                {variable.required && " · required"}
              </span>
            </dt>
            <dd>{variable.children}</dd>
            {variable.fallback && (
              <dd className="text-xs">Default: {variable.fallback}</dd>
            )}
          </div>
        ))}
      </dl>

      <p>
        The default <Code>ALLOWED_CLIENTS</Code> are claude.ai&apos;s and Claude
        Code&apos;s metadata documents:
      </p>

      <CodeBlock label="ALLOWED_CLIENTS">
        {`https://claude.ai/oauth/mcp-oauth-client-metadata,https://claude.ai/oauth/claude-code-client-metadata`}
      </CodeBlock>

      <p>
        OAuth tokens are bound to the origin they were issued on. If you move
        the gateway to a new hostname, add the connectors again from there.
      </p>
    </Section>
  )
}
