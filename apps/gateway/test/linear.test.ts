import { describe, expect, it } from "vitest"
import { gatewayWith, LAPTOP_TOKEN, ORIGIN, type SeenRequest } from "./helpers"

const LINEAR = `${ORIGIN}/u/linear/mcp`
const LINEAR_VARS = {
  ACCOUNT_LINEAR_EGIX: "lin_api_egix",
  ACCOUNT_LINEAR_SOLV: "lin_api_solv",
  SERVICE_LINEAR_MERGED: "true",
  SERVICE_LINEAR_EXTRA_TOOLS: "true",
}

interface GraphqlCall {
  query: string
  variables: Record<string, unknown>
}

const graphqlCalls = (seen: SeenRequest[]) =>
  seen
    .filter((s) => s.url.href === "https://api.linear.app/graphql")
    .map((s) => ({ ...(JSON.parse(s.body) as GraphqlCall), seen: s }))

/** Linear's MCP lists two tools; its GraphQL API answers by operation name. */
function linearUpstream(answers: Record<string, unknown> = {}) {
  return ({ url, body }: SeenRequest) => {
    if (url.hostname === "mcp.linear.app") {
      const message = JSON.parse(body) as { id: number }
      return Response.json({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: [
            { name: "list_issues", description: "Linear's own" },
            { name: "delete_milestone", description: "Linear's own, shadowed" },
          ],
        },
      })
    }
    const { query } = JSON.parse(body) as GraphqlCall
    const operation = /^\s*(?:query|mutation) (\w+)/.exec(query)?.[1] ?? ""
    const answer = answers[operation]
    if (answer instanceof Response) return answer
    return Response.json(
      answer === undefined
        ? { errors: [{ message: `unexpected ${operation}` }] }
        : { data: answer }
    )
  }
}

async function callTool(
  call: ReturnType<typeof gatewayWith>["call"],
  name: string,
  args: Record<string, unknown>
) {
  const response = await call(LINEAR, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LAPTOP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    result: { isError?: boolean; content: { text: string }[] }
  }
  return { text: body.result.content[0]!.text, isError: body.result.isError }
}

describe("Linear's extra tools", () => {
  it("lists them after list_workspaces, covering Linear's tools of the same name", async () => {
    const { call } = gatewayWith(linearUpstream(), LINEAR_VARS)
    const response = await call(LINEAR, {
      method: "POST",
      headers: { Authorization: `Bearer ${LAPTOP_TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    const { result } = (await response.json()) as {
      result: {
        tools: {
          name: string
          description: string
          inputSchema: { required: string[] }
        }[]
      }
    }
    const names = result.tools.map((t) => t.name)
    expect(names).toEqual([
      "list_workspaces",
      "delete_milestone",
      "reorder_milestone",
      "assign_issues_to_milestone",
      "archive_project",
      "unarchive_project",
      "archive_initiative",
      "unarchive_initiative",
      "list_initiative_projects",
      "link_project_to_initiative",
      "unlink_project_from_initiative",
      "list_issues",
    ])
    const deleteMilestone = result.tools[1]!
    expect(deleteMilestone.description).toContain("Permanently delete")
    expect(deleteMilestone.inputSchema.required).toEqual([
      "workspace",
      "milestoneId",
    ])
  })

  it("leaves them out when not switched on", async () => {
    const { call } = gatewayWith(linearUpstream(), {
      ...LINEAR_VARS,
      SERVICE_LINEAR_EXTRA_TOOLS: undefined,
    })
    const response = await call(LINEAR, {
      method: "POST",
      headers: { Authorization: `Bearer ${LAPTOP_TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    const { result } = (await response.json()) as {
      result: { tools: { name: string; description: string }[] }
    }
    expect(result.tools.map((t) => t.name)).toEqual([
      "list_workspaces",
      "delete_milestone",
      "list_issues",
    ])
    expect(result.tools[1]?.description).toBe("Linear's own, shadowed")
  })

  it("archives with the workspace's own key, reading the name first", async () => {
    const { call, seen } = gatewayWith(
      linearUpstream({
        Read: { project: { name: "Website" } },
        Archive: { projectArchive: { success: true } },
      }),
      LINEAR_VARS
    )
    const result = await callTool(call, "archive_project", {
      workspace: "solv",
      projectId: "p-1",
    })

    expect(result.isError).toBeUndefined()
    expect(result.text).toBe(
      "Project **Website** archived (id: `p-1`). Restore with unarchive_project."
    )
    const calls = graphqlCalls(seen)
    expect(calls.map((c) => c.query.match(/(project\w*)\(/)?.[1])).toEqual([
      "project",
      "projectArchive",
    ])
    expect(calls[0]?.variables).toEqual({ id: "p-1" })
    expect(calls[0]?.seen.headers.get("Authorization")).toBe("lin_api_solv")
  })

  it("reports how many issues a deleted milestone leaves behind", async () => {
    const { call, seen } = gatewayWith(
      linearUpstream({
        Milestone: {
          projectMilestone: {
            name: "Beta",
            issues: {
              nodes: Array.from({ length: 250 }, (_, i) => ({ id: `i${i}` })),
              pageInfo: { hasNextPage: true },
            },
          },
        },
        DeleteMilestone: { projectMilestoneDelete: { success: true } },
      }),
      LINEAR_VARS
    )
    const result = await callTool(call, "delete_milestone", {
      workspace: "egix",
      milestoneId: "m-1",
    })
    expect(result.text).toContain("Milestone **Beta** deleted")
    expect(result.text).toContain("250+ issue(s)")
    expect(graphqlCalls(seen)).toHaveLength(2)
  })

  it("assigns issues in one batch, or clears their milestone", async () => {
    const { call, seen } = gatewayWith(
      linearUpstream({
        AssignMilestone: {
          issueBatchUpdate: {
            success: true,
            issues: [{ identifier: "EGX-1", title: "First" }],
          },
        },
      }),
      LINEAR_VARS
    )
    const result = await callTool(call, "assign_issues_to_milestone", {
      workspace: "egix",
      issueIds: ["u-1"],
    })
    expect(result.text).toContain("1 issue(s) assigned to no milestone")
    expect(result.text).toContain("**EGX-1** First")
    expect(graphqlCalls(seen)[0]?.variables).toEqual({
      ids: ["u-1"],
      input: { projectMilestoneId: null },
    })
  })

  it("matches an initiative's projects to their link ids across pages", async () => {
    let page = 0
    const { call } = gatewayWith((request) => {
      const { query } = JSON.parse(request.body) as GraphqlCall
      if (query.includes("query Links")) {
        page++
        return Response.json({
          data: {
            initiativeToProjects: {
              nodes:
                page === 1
                  ? [
                      {
                        id: "l-other",
                        initiative: { id: "other" },
                        project: { id: "p-1" },
                      },
                    ]
                  : [
                      {
                        id: "l-1",
                        initiative: { id: "i-1" },
                        project: { id: "p-1" },
                      },
                    ],
              pageInfo: {
                hasNextPage: page === 1,
                endCursor: page === 1 ? "c1" : null,
              },
            },
          },
        })
      }
      return linearUpstream({
        InitiativeProjects: {
          initiative: {
            projects: {
              nodes: [
                {
                  id: "p-1",
                  name: "Website",
                  state: "started",
                  targetDate: "2026-12-01",
                },
              ],
            },
          },
        },
      })(request)
    }, LINEAR_VARS)

    const result = await callTool(call, "list_initiative_projects", {
      workspace: "egix",
      initiativeId: "i-1",
    })
    expect(result.text).toContain("**Website** [started] | Due: 2026-12-01")
    expect(result.text).toContain("link id: `l-1`")
    expect(page).toBe(2)
  })

  it("passes Linear's GraphQL errors to the model", async () => {
    const { call } = gatewayWith(linearUpstream(), LINEAR_VARS)
    const result = await callTool(call, "unlink_project_from_initiative", {
      workspace: "egix",
      linkId: "l-1",
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain("unexpected Unlink")
  })

  it("survives an API answer that is not JSON", async () => {
    const { call } = gatewayWith(
      linearUpstream({ Unlink: new Response("<html>", { status: 503 }) }),
      LINEAR_VARS
    )
    const result = await callTool(call, "unlink_project_from_initiative", {
      workspace: "egix",
      linkId: "l-1",
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain("503")
  })

  it("checks arguments before calling Linear", async () => {
    const { call, seen } = gatewayWith(linearUpstream(), LINEAR_VARS)
    const result = await callTool(call, "reorder_milestone", {
      workspace: "egix",
      milestoneId: "m-1",
      sortOrder: "first",
    })
    expect(result.isError).toBe(true)
    expect(result.text).toContain("`sortOrder` must be a number")
    expect(seen).toHaveLength(0)
  })
})
