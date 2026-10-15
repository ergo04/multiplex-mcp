import type { UpstreamFetch } from "../proxy/passthrough"
import {
  optionalNumber,
  optionalString,
  requiredNumber,
  requiredString,
  stringList,
} from "./arguments"
import type { ExtraTool, ExtraTools } from "./extra-tools"

/**
 * What Linear's own MCP server can't do, over Linear's GraphQL API. Plain
 * fetch rather than @linear/sdk: the SDK is several megabytes, the free plan
 * caps a Worker at 3 MB, and its lazy relation getters cost a request each.
 */

const API = new URL("https://api.linear.app/graphql")

/** Linear caps connection page size at 250. */
const PAGE_SIZE = 250

async function graphql<T>(
  upstreamFetch: UpstreamFetch,
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await upstreamFetch(API, {
    method: "POST",
    // Personal API keys go bare; "Bearer" is for OAuth tokens.
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    redirect: "manual",
  })

  let body: { data?: T; errors?: { message?: string }[] }
  try {
    body = await response.json()
  } catch {
    throw new Error(`Linear's API answered ${response.status}`)
  }
  if (body.errors?.length)
    throw new Error(body.errors.map((error) => error.message).join("; "))
  if (!response.ok || !body.data)
    throw new Error(`Linear's API answered ${response.status}`)
  return body.data
}

function succeeded(payload: { success: boolean }, what: string): void {
  if (!payload.success) throw new Error(`${what} failed`)
}

const deleteMilestone: ExtraTool = {
  name: "delete_milestone",
  description:
    "Permanently delete a project milestone. Linear's own MCP cannot delete milestones. " +
    "The milestone's issues are not deleted: they stay in the project with no milestone assigned.",
  inputSchema: {
    type: "object",
    properties: {
      milestoneId: { type: "string", description: "Milestone ID to delete" },
    },
    required: ["milestoneId"],
  },
  // Name and issues are read first: the row is gone afterwards, and the number
  // of detached issues is the only sign of how much the deletion touched.
  async run(args, apiKey, upstreamFetch) {
    const id = requiredString(args, "milestoneId")
    const { projectMilestone } = await graphql<{
      projectMilestone: {
        name: string
        issues: { nodes: unknown[]; pageInfo: { hasNextPage: boolean } }
      } | null
    }>(
      upstreamFetch,
      apiKey,
      `
        query Milestone($id: String!, $first: Int!) {
          projectMilestone(id: $id) {
            name
            issues(first: $first) {
              nodes {
                id
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      `,
      { id, first: PAGE_SIZE }
    )
    if (!projectMilestone) throw new Error(`Milestone "${id}" not found`)

    const { projectMilestoneDelete } = await graphql<{
      projectMilestoneDelete: { success: boolean }
    }>(
      upstreamFetch,
      apiKey,
      `
        mutation DeleteMilestone($id: String!) {
          projectMilestoneDelete(id: $id) {
            success
          }
        }
      `,
      { id }
    )
    succeeded(projectMilestoneDelete, "Milestone deletion")

    const issues = projectMilestone.issues
    const detached = `${issues.nodes.length}${issues.pageInfo.hasNextPage ? "+" : ""}`
    return (
      `Milestone **${projectMilestone.name}** deleted (id: \`${id}\`).\n` +
      `${detached} issue(s) stayed in the project with no milestone assigned.`
    )
  },
}

const reorderMilestone: ExtraTool = {
  name: "reorder_milestone",
  description:
    "Change a milestone's position within its project. Linear's own `save_milestone` has no sortOrder parameter. " +
    "Read the neighbours' sortOrder from list_milestones and pass a value between them.",
  inputSchema: {
    type: "object",
    properties: {
      milestoneId: { type: "string", description: "Milestone ID" },
      sortOrder: {
        type: "number",
        description: "New position — lower sorts first",
      },
    },
    required: ["milestoneId", "sortOrder"],
  },
  async run(args, apiKey, upstreamFetch) {
    const id = requiredString(args, "milestoneId")
    const sortOrder = requiredNumber(args, "sortOrder")
    const { projectMilestoneUpdate } = await graphql<{
      projectMilestoneUpdate: {
        success: boolean
        projectMilestone: {
          name: string
          sortOrder: number
          project: { name: string } | null
        } | null
      }
    }>(
      upstreamFetch,
      apiKey,
      `
        mutation ReorderMilestone(
          $id: String!
          $input: ProjectMilestoneUpdateInput!
        ) {
          projectMilestoneUpdate(id: $id, input: $input) {
            success
            projectMilestone {
              name
              sortOrder
              project {
                name
              }
            }
          }
        }
      `,
      { id, input: { sortOrder } }
    )
    succeeded(projectMilestoneUpdate, "Milestone update")
    const milestone = projectMilestoneUpdate.projectMilestone
    if (!milestone) throw new Error("Milestone update returned no milestone")
    return `Milestone **${milestone.name}** moved to sortOrder ${milestone.sortOrder} in ${milestone.project?.name ?? "its project"}.`
  },
}

const assignIssuesToMilestone: ExtraTool = {
  name: "assign_issues_to_milestone",
  description:
    "Assign several issues to a project milestone in one call, or clear their milestone by omitting `milestoneId`. " +
    "Linear's own MCP only sets the milestone one issue at a time.",
  inputSchema: {
    type: "object",
    properties: {
      issueIds: {
        type: "array",
        items: { type: "string" },
        description: "Issue IDs to assign (max 50 per call)",
      },
      milestoneId: {
        type: "string",
        description:
          "Target milestone ID — omit to detach these issues from their milestone",
      },
    },
    required: ["issueIds"],
  },
  // Only scalar fields are read back: a batch is meant to stay one round trip.
  async run(args, apiKey, upstreamFetch) {
    const issueIds = stringList(args, "issueIds", 50)
    const milestoneId = optionalString(args, "milestoneId") ?? null

    const [{ issueBatchUpdate }, milestone] = await Promise.all([
      graphql<{
        issueBatchUpdate: {
          success: boolean
          issues: { identifier: string; title: string }[]
        }
      }>(
        upstreamFetch,
        apiKey,
        `
          mutation AssignMilestone($ids: [UUID!]!, $input: IssueUpdateInput!) {
            issueBatchUpdate(ids: $ids, input: $input) {
              success
              issues {
                identifier
                title
              }
            }
          }
        `,
        { ids: issueIds, input: { projectMilestoneId: milestoneId } }
      ),
      milestoneId
        ? graphql<{ projectMilestone: { name: string } | null }>(
            upstreamFetch,
            apiKey,
            `
              query MilestoneName($id: String!) {
                projectMilestone(id: $id) {
                  name
                }
              }
            `,
            { id: milestoneId }
          )
        : undefined,
    ])
    succeeded(issueBatchUpdate, "Batch milestone assignment")

    const target = milestoneId
      ? `milestone **${milestone?.projectMilestone?.name ?? milestoneId}**`
      : "no milestone"
    const lines = issueBatchUpdate.issues.map(
      (issue) => `- **${issue.identifier}** ${issue.title}`
    )
    return `## ${issueBatchUpdate.issues.length} issue(s) assigned to ${target}\n\n${lines.join("\n")}`
  },
}

type Archivable = "project" | "initiative"

// The archived row is no longer readable by id, so the name is read first and
// `success` trusted afterwards.
function archiveTool(entity: Archivable): ExtraTool {
  const title = entity === "project" ? "Project" : "Initiative"
  const key = `${entity}Id`
  return {
    name: `archive_${entity}`,
    description:
      entity === "project"
        ? "Archive a Linear project. Linear's own MCP cannot archive. Archived projects stay recoverable with unarchive_project."
        : "Archive a Linear initiative. Linear's own MCP cannot archive. Recoverable with unarchive_initiative.",
    inputSchema: {
      type: "object",
      properties: {
        [key]: { type: "string", description: `${title} ID to archive` },
      },
      required: [key],
    },
    async run(args, apiKey, upstreamFetch) {
      const id = requiredString(args, key)
      const read = await graphql<Record<string, { name: string } | null>>(
        upstreamFetch,
        apiKey,
        `query Read($id: String!) { ${entity}(id: $id) { name } }`,
        { id }
      )
      const name = read[entity]?.name
      if (!name) throw new Error(`${title} "${id}" not found`)

      const archived = await graphql<Record<string, { success: boolean }>>(
        upstreamFetch,
        apiKey,
        `mutation Archive($id: String!) { ${entity}Archive(id: $id) { success } }`,
        { id }
      )
      succeeded(archived[`${entity}Archive`]!, `${title} archive`)
      return `${title} **${name}** archived (id: \`${id}\`). Restore with unarchive_${entity}.`
    },
  }
}

// Restored, the entity is readable again, so the name comes from the payload.
function unarchiveTool(entity: Archivable): ExtraTool {
  const title = entity === "project" ? "Project" : "Initiative"
  const key = `${entity}Id`
  return {
    name: `unarchive_${entity}`,
    description: `Restore a previously archived Linear ${entity}.`,
    inputSchema: {
      type: "object",
      properties: {
        [key]: { type: "string", description: `${title} ID to restore` },
      },
      required: [key],
    },
    async run(args, apiKey, upstreamFetch) {
      const id = requiredString(args, key)
      const data = await graphql<
        Record<string, { success: boolean; entity: { name: string } | null }>
      >(
        upstreamFetch,
        apiKey,
        `mutation Unarchive($id: String!) {
          ${entity}Unarchive(id: $id) { success entity { name } }
        }`,
        { id }
      )
      const payload = data[`${entity}Unarchive`]!
      succeeded(payload, `${title} unarchive`)
      return `${title} **${payload.entity?.name ?? "(unknown)"}** restored (id: \`${id}\`)`
    },
  }
}

interface LinkPage {
  initiativeToProjects: {
    nodes: { id: string; initiative: { id: string }; project: { id: string } }[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

/**
 * `initiativeToProjects` takes no filter, so the link ids are collected
 * workspace-wide and matched on the initiative locally.
 */
async function linkIds(
  upstreamFetch: UpstreamFetch,
  apiKey: string,
  initiativeId: string
): Promise<Map<string, string>> {
  const byProject = new Map<string, string>()
  let after: string | null = null
  for (let page = 0; page < 20; page++) {
    const data: LinkPage = await graphql<LinkPage>(
      upstreamFetch,
      apiKey,
      `
        query Links($first: Int!, $after: String) {
          initiativeToProjects(first: $first, after: $after) {
            nodes {
              id
              initiative {
                id
              }
              project {
                id
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      { first: PAGE_SIZE, after }
    )
    for (const link of data.initiativeToProjects.nodes)
      if (link.initiative.id === initiativeId)
        byProject.set(link.project.id, link.id)
    const { hasNextPage, endCursor } = data.initiativeToProjects.pageInfo
    if (!hasNextPage || !endCursor) break
    after = endCursor
  }
  return byProject
}

const listInitiativeProjects: ExtraTool = {
  name: "list_initiative_projects",
  description:
    "List the projects linked to an initiative, with the link ID needed to unlink them. " +
    "Linear's own MCP exposes initiatives but not their project links.",
  inputSchema: {
    type: "object",
    properties: {
      initiativeId: { type: "string", description: "Initiative ID" },
    },
    required: ["initiativeId"],
  },
  async run(args, apiKey, upstreamFetch) {
    const id = requiredString(args, "initiativeId")
    const [{ initiative }, links] = await Promise.all([
      graphql<{
        initiative: {
          projects: {
            nodes: {
              id: string
              name: string
              state: string
              targetDate: string | null
            }[]
          }
        } | null
      }>(
        upstreamFetch,
        apiKey,
        `
          query InitiativeProjects($id: String!, $first: Int!) {
            initiative(id: $id) {
              projects(first: $first) {
                nodes {
                  id
                  name
                  state
                  targetDate
                }
              }
            }
          }
        `,
        { id, first: PAGE_SIZE }
      ),
      linkIds(upstreamFetch, apiKey, id),
    ])
    if (!initiative) throw new Error(`Initiative "${id}" not found`)

    const projects = initiative.projects.nodes
    if (projects.length === 0) return "No projects linked to this initiative."
    const lines = projects.map(
      (p) =>
        `- **${p.name}** [${p.state}]` +
        (p.targetDate ? ` | Due: ${p.targetDate}` : "") +
        `\n  project id: \`${p.id}\` | link id: \`${links.get(p.id) ?? ""}\``
    )
    return `## Linked projects (${projects.length})\n\n${lines.join("\n")}`
  },
}

const linkProjectToInitiative: ExtraTool = {
  name: "link_project_to_initiative",
  description:
    "Link a project to an initiative. Linear's own MCP cannot create these links.",
  inputSchema: {
    type: "object",
    properties: {
      initiativeId: { type: "string", description: "Initiative ID" },
      projectId: { type: "string", description: "Project ID to link" },
      sortOrder: {
        type: "number",
        description:
          "Position within the initiative (optional) — lower sorts first",
      },
    },
    required: ["initiativeId", "projectId"],
  },
  async run(args, apiKey, upstreamFetch) {
    const input = {
      initiativeId: requiredString(args, "initiativeId"),
      projectId: requiredString(args, "projectId"),
      sortOrder: optionalNumber(args, "sortOrder"),
    }
    const { initiativeToProjectCreate } = await graphql<{
      initiativeToProjectCreate: {
        success: boolean
        initiativeToProject: {
          id: string
          initiative: { name: string } | null
          project: { name: string } | null
        } | null
      }
    }>(
      upstreamFetch,
      apiKey,
      `
        mutation Link($input: InitiativeToProjectCreateInput!) {
          initiativeToProjectCreate(input: $input) {
            success
            initiativeToProject {
              id
              initiative {
                name
              }
              project {
                name
              }
            }
          }
        }
      `,
      { input }
    )
    succeeded(initiativeToProjectCreate, "Initiative-to-project link")
    const link = initiativeToProjectCreate.initiativeToProject
    if (!link) throw new Error("Initiative-to-project link returned no link")
    return (
      `Project **${link.project?.name ?? "Unknown"}** linked to initiative **${link.initiative?.name ?? "Unknown"}**\n` +
      `Link id: \`${link.id}\` (use it with unlink_project_from_initiative)`
    )
  },
}

const unlinkProjectFromInitiative: ExtraTool = {
  name: "unlink_project_from_initiative",
  description:
    "Remove a project from an initiative. Takes the link ID from list_initiative_projects, " +
    "not the project ID — Linear models the association as its own entity.",
  inputSchema: {
    type: "object",
    properties: {
      linkId: {
        type: "string",
        description: "Link ID from list_initiative_projects",
      },
    },
    required: ["linkId"],
  },
  async run(args, apiKey, upstreamFetch) {
    const id = requiredString(args, "linkId")
    const { initiativeToProjectDelete } = await graphql<{
      initiativeToProjectDelete: { success: boolean }
    }>(
      upstreamFetch,
      apiKey,
      `
        mutation Unlink($id: String!) {
          initiativeToProjectDelete(id: $id) {
            success
          }
        }
      `,
      { id }
    )
    succeeded(initiativeToProjectDelete, "Unlink")
    return `Link \`${id}\` removed.`
  },
}

export const linear: ExtraTools = {
  tools: [
    deleteMilestone,
    reorderMilestone,
    assignIssuesToMilestone,
    archiveTool("project"),
    unarchiveTool("project"),
    archiveTool("initiative"),
    unarchiveTool("initiative"),
    listInitiativeProjects,
    linkProjectToInitiative,
    unlinkProjectFromInitiative,
  ],
  instructions:
    "get_issue hides relations by default: pass `includeRelations: true` to see blocking/blocked-by/related/duplicate links.",
}
