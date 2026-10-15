import { Code } from "@/components/ui/code"
import { Section, Strong, TextLink } from "@/components/ui/section"
import { PREDECESSOR_URL } from "@/lib/links"

export function LimitsSection() {
  return (
    <Section id="limits" label="Limits" title="Limits and what isn't there yet">
      <ul className="flex list-disc flex-col gap-3 pl-5 marker:text-muted-foreground">
        <li>
          <Strong>Cloudflare&apos;s free plan</Strong> allows 100,000 requests a
          day and 10 ms of CPU per request. Forwarding uses almost none of that
          CPU: time spent waiting on the upstream doesn&apos;t count. KV allows
          1,000 writes a day, and the gateway writes when it issues tokens.
        </li>
        <li>
          <Strong>Upstreams that only speak OAuth</Strong>, like Vercel&apos;s
          MCP, aren&apos;t supported yet. The gateway needs an API key to send.
          It&apos;s planned.
        </li>
        <li>
          <Strong>A merged mode</Strong> isn&apos;t there yet either: one URL
          per service, with an <Code>account</Code> argument on every tool. Also
          planned.
        </li>
        <li>
          <Strong>One owner.</Strong> There is one password and no user
          accounts.
        </li>
      </ul>

      <p>
        If you only need Linear,{" "}
        <TextLink href={PREDECESSOR_URL}>linear-mcp-gateway</TextLink>, the
        project this one grew out of, puts every workspace behind a single
        connection with a <Code>workspace</Code> argument on each tool.
      </p>
    </Section>
  )
}
