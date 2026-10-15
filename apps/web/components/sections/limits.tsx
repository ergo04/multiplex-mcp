import { Code } from "@/components/ui/code"
import { Section, Strong, TextLink } from "@/components/ui/section"
import { PREDECESSOR_URL } from "@/lib/links"

export function LimitsSection() {
  return (
    <Section id="limits" label="Limits" title="Limits and what isn't there yet">
      <ul className="flex list-disc flex-col gap-3 pl-5 marker:text-muted-foreground">
        <li>
          <Strong>Cloudflare&apos;s free plan</Strong> allows 100,000 requests a
          day and 10 ms of CPU per request. Time spent waiting on the upstream
          doesn&apos;t count. On my deployment a request takes 4 to 7 ms on an
          isolate that is already running, but 10 to 15 ms when it is the first
          one a fresh isolate serves, and signing in with OAuth up to 30 ms.
          claude.ai calls from many data centers, so fresh isolates are common.
          Cloudflare tolerates an isolate going over the limit now and then and
          only stops one that does so consistently, with error 1102; so far none
          has been stopped. KV allows 1,000 writes a day, and the gateway writes
          when it issues tokens.
        </li>
        <li>
          <Strong>The merged connector&apos;s tool list</Strong> costs the most
          CPU: it asks every account, then merges the lists. With four Linear
          workspaces, about 70 tools and 115 KB each, building it took 18 to 20
          ms. The list is cached for five minutes with the Cache API, but that
          cache belongs to one data center, and claude.ai rarely calls twice
          from the same one, so most lists are built again. The Cache API only
          works on a custom domain: on <Code>workers.dev</Code> every list asks
          every account again.
        </li>
        <li>
          <Strong>The merged connector is for stateless servers</Strong>, like
          Linear&apos;s and Resend&apos;s, which answer without an MCP session.
          It answers <Code>initialize</Code> itself and keeps no session per
          account, so a server that needs one only works through its per-account
          URLs.
        </li>
        <li>
          <Strong>Upstreams that only speak OAuth</Strong>, like Vercel&apos;s
          MCP, aren&apos;t supported yet. The gateway needs an API key to send.
          It&apos;s planned.
        </li>
        <li>
          <Strong>One owner.</Strong> There is one password and no user
          accounts.
        </li>
      </ul>

      <p>
        The merged connector grew out of{" "}
        <TextLink href={PREDECESSOR_URL}>linear-mcp-gateway</TextLink>, which
        did the same for Linear workspaces only, with the same{" "}
        <Code>workspace</Code> argument and the same extra tools.
      </p>
    </Section>
  )
}
