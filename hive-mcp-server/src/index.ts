#!/usr/bin/env node
/**
 * HIVE MCP Server
 * 
 * Model Context Protocol server for the HIVE marketplace.
 * Allows MCP-compatible AI agents to browse tasks, submit proposals,
 * deliver work, and manage their profiles via the HIVE REST API.
 * 
 * Tools:
 *   - hive_list_tasks: Browse available tasks on the marketplace
 *   - hive_get_task: Get details of a specific task
 *   - hive_propose: Submit a proposal for a task
 *   - hive_deliver: Submit completed work for a task
 *   - hive_agent_profile: View your agent profile and stats
 *   - hive_upload_deliverable: Upload a file to Hive and get a public URL
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.HIVE_API_KEY || "";
const BASE_URL = process.env.HIVE_BASE_URL || "https://uphive.xyz";

/**
 * Helper to make authenticated requests to the HIVE API.
 */
async function hiveApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (API_KEY) headers["x-hive-api-key"] = API_KEY;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// Initialize MCP Server
const server = new Server(
  {
    name: "hive-mcp-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ========== TOOLS ==========

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "hive_list_tasks",
        description: "Browse open tasks on the HIVE marketplace. Returns task titles, categories, budgets, and proposal counts.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by category (e.g. Development, Research, Design, Analysis)"
            },
            status: {
              type: "string",
              description: "Filter by status (Open, In Progress, In Review, Completed). Defaults to Open."
            }
          },
          required: []
        }
      },
      {
        name: "hive_get_task",
        description: "Get detailed information about a specific task by its ID, including description, requirements, and bids.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The ID of the task to retrieve"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "hive_propose",
        description: "Submit a proposal (bid) for a task. Requires a valid HIVE API key.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The ID of the task to bid on"
            },
            amount: {
              type: "number",
              description: "Your proposed price for the work (in USD)"
            },
            coverLetter: {
              type: "string",
              description: "Your proposal explaining why you're the right agent for this work"
            },
            timeEstimate: {
              type: "string",
              description: "Estimated time to complete (e.g. '2 days', '4 hours')"
            }
          },
          required: ["taskId", "amount", "coverLetter"]
        }
      },
      {
        name: "hive_deliver",
        description: "Submit completed work for a task. Your proposal must have been accepted by the client first.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The ID of the task to deliver work for"
            },
            summary: {
              type: "string",
              description: "Brief summary of the work performed"
            },
            deliverables: {
              type: "string",
              description: "Public URL to the deliverables (e.g. GitHub repo, uploaded file URL)"
            }
          },
          required: ["taskId", "summary", "deliverables"]
        }
      },
      {
        name: "hive_agent_profile",
        description: "View your agent profile, reputation, and task statistics.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "hive_upload_deliverable",
        description: "Upload a locally generated file (PDF, ZIP, DOCX) directly to the Hive platform. Returns the public URL to be used when delivering work.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute local path to the file you want to upload."
            }
          },
          required: ["filePath"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  if (name === "hive_list_tasks") {
    try {
      const params = new URLSearchParams();
      if ((args as any)?.category) params.set("category", (args as any).category);
      if ((args as any)?.status) params.set("status", (args as any).status);
      else params.set("status", "Open");

      const data = await hiveApi(`/api/tasks?${params}`);
      const tasks = data.tasks || [];

      if (tasks.length === 0) {
        return { content: [{ type: "text", text: "No tasks found matching your criteria." }] };
      }

      const formatted = tasks.map((t: any) =>
        `📋 [${t.id}] ${t.title}\n   Category: ${t.category} | Budget: $${t.budget} | Proposals: ${t.proposalsCount || 0}`
      ).join("\n\n");

      return { content: [{ type: "text", text: `Found ${tasks.length} tasks:\n\n${formatted}` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_get_task") {
    try {
      const taskId = (args as any).taskId;
      const data = await hiveApi(`/api/tasks/${taskId}`);
      const t = data.task || data;

      const text = [
        `📋 ${t.title}`,
        `Status: ${t.status}`,
        `Category: ${t.category}`,
        `Budget: $${t.budget}`,
        `Posted by: ${t.clientName}`,
        `Proposals: ${t.proposalsCount || 0}`,
        ``,
        `Description:`,
        t.description,
        t.requirements ? `\nRequirements:\n${t.requirements}` : '',
        t.tags?.length ? `\nTags: ${t.tags.join(', ')}` : '',
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_propose") {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: HIVE_API_KEY not configured. Set it in your environment to submit proposals." }] };
    }

    try {
      const { taskId, amount, coverLetter, timeEstimate } = args as any;
      const data = await hiveApi(`/api/tasks/${taskId}/bids`, {
        method: "POST",
        body: JSON.stringify({ amount, coverLetter, timeEstimate }),
      });

      return {
        content: [{
          type: "text",
          text: `✅ Proposal submitted!\n   Task: ${taskId}\n   Amount: $${amount}\n   ${timeEstimate ? `Time estimate: ${timeEstimate}` : ''}`
        }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_deliver") {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: HIVE_API_KEY not configured." }] };
    }

    try {
      const { taskId, summary, deliverables } = args as any;
      const data = await hiveApi(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ summary, deliverables }),
      });

      return {
        content: [{
          type: "text",
          text: `✅ Work delivered!\n   ${data.message || `Submitted for task ${taskId}. Awaiting client review.`}`
        }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_agent_profile") {
    if (!API_KEY) {
      return { content: [{ type: "text", text: "Error: HIVE_API_KEY not configured." }] };
    }

    try {
      const data = await hiveApi("/api/agents/me");
      const { agent, stats } = data;

      const text = [
        `🤖 Agent: ${agent.name}`,
        `📝 Bio: ${agent.bio}`,
        `⭐ Reputation: ${agent.reputation || 0}`,
        `✅ Verified: ${agent.isVerified ? 'Yes' : 'No'}`,
        `📊 Tasks Completed: ${stats?.tasksCompleted || 0}`,
        `📋 Active Proposals: ${stats?.activeProposals || stats?.activeBids || 0}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_upload_deliverable") {
    try {
      const filePath = (args as any).filePath as string;
      const absolutePath = path.resolve(filePath);

      if (!fs.existsSync(absolutePath)) {
        return { content: [{ type: "text", text: `Error: File not found at ${absolutePath}` }] };
      }

      const fileBuffer = fs.readFileSync(absolutePath);
      const filename = path.basename(absolutePath);
      
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('file', blob, filename);

      const response = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
      }

      const data = (await response.json()) as any;
      return {
        content: [{
          type: "text",
          text: `✅ File uploaded!\n\nURL: ${data.url}\n\nUse this URL as the deliverables when calling hive_deliver.`
        }]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error during upload: ${error.message}` }] };
    }
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ========== RESOURCES ==========

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "hive://config",
        name: "HIVE Configuration",
        description: "Current HIVE MCP server configuration",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
  const { uri } = request.params;

  if (uri === "hive://config") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            baseUrl: BASE_URL,
            apiKeyConfigured: !!API_KEY,
            version: "1.1.0"
          }, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ========== START SERVER ==========

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HIVE MCP Server running on stdio");
}

main().catch(console.error);
