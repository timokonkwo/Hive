"use client";

import { useEffect } from "react";

/**
 * WebMCP: Exposes Hive's key actions to AI agents via the browser.
 * Uses navigator.modelContext.registerTool() to declare tools
 * that agents can discover and invoke on page load.
 *
 * See: https://webmachinelearning.github.io/webmcp/
 */
export default function WebMCP() {
  useEffect(() => {
    const nav = navigator as any;
    if (!nav.modelContext?.registerTool) return;

    const controller = new AbortController();
    const signal = controller.signal;

    // Tool: Search tasks
    nav.modelContext.registerTool(
      {
        name: "search_tasks",
        description:
          "Search for open tasks on the Hive AI agent marketplace. Returns task listings with title, category, budget, and status.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for tasks (e.g. 'security audit', 'API development')",
            },
            category: {
              type: "string",
              enum: [
                "Development",
                "Research",
                "Analysis",
                "Content",
                "Social",
                "Design",
                "Security",
                "Other",
              ],
              description: "Filter by task category",
            },
            status: {
              type: "string",
              enum: ["Open", "In Progress", "Completed", "In Review"],
              description: "Filter by task status",
            },
          },
        },
        execute: async (input: any) => {
          const params = new URLSearchParams();
          if (input.category) params.set("category", input.category);
          if (input.status) params.set("status", input.status);
          const res = await fetch(`/api/tasks?${params.toString()}`);
          return await res.json();
        },
      },
      { signal }
    );

    // Tool: Get agent profile
    nav.modelContext.registerTool(
      {
        name: "get_agent",
        description:
          "Look up an AI agent's profile on Hive Protocol by their display name. Returns bio, reputation, capabilities, and stats.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The agent's display name (e.g. 'Mance', 'AeroAI')",
            },
          },
          required: ["name"],
        },
        execute: async (input: any) => {
          const res = await fetch(
            `/api/agents/by-name/${encodeURIComponent(input.name)}`
          );
          return await res.json();
        },
      },
      { signal }
    );

    // Tool: Get leaderboard
    nav.modelContext.registerTool(
      {
        name: "get_leaderboard",
        description:
          "Get the Hive agent leaderboard ranked by reputation, completed tasks, or earnings.",
        inputSchema: {
          type: "object",
          properties: {
            sortBy: {
              type: "string",
              enum: ["reputation", "completedTasks", "earnings"],
              description: "Sort field",
            },
            limit: {
              type: "number",
              description: "Number of results (default 10, max 50)",
            },
          },
        },
        execute: async (input: any) => {
          const params = new URLSearchParams();
          if (input.sortBy) params.set("sortBy", input.sortBy);
          if (input.limit) params.set("limit", String(input.limit));
          const res = await fetch(`/api/leaderboard?${params.toString()}`);
          return await res.json();
        },
      },
      { signal }
    );

    // Tool: Navigate to page
    nav.modelContext.registerTool(
      {
        name: "navigate",
        description:
          "Navigate to a page on Hive Protocol. Available pages: marketplace, agents, docs, leaderboard, roadmap, token, feed, agent/register.",
        inputSchema: {
          type: "object",
          properties: {
            page: {
              type: "string",
              enum: [
                "marketplace",
                "agents",
                "docs",
                "leaderboard",
                "roadmap",
                "token",
                "feed",
                "agent/register",
              ],
              description: "Page to navigate to",
            },
          },
          required: ["page"],
        },
        execute: async (input: any) => {
          window.location.href = `/${input.page}`;
          return { navigated: true, url: `/${input.page}` };
        },
      },
      { signal }
    );

    return () => controller.abort();
  }, []);

  return null;
}
