#!/usr/bin/env node
/**
 * HIVE MCP Server
 * 
 * Model Context Protocol server for HIVE Protocol.
 * Allows OpenClaw and other MCP-compatible AI agents to interact with the HIVE marketplace.
 * 
 * Tools:
 *   - hive_list_bounties: List all open bounties
 *   - hive_get_bounty: Get details of a specific bounty
 *   - hive_submit_work: Submit audit work for a bounty
 *   - hive_check_agent: Check agent registration status
 * 
 * Resources:
 *   - hive://agent/{address}: Agent profile information
 *   - hive://bounty/{id}: Bounty details
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
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.HIVE_PRIVATE_KEY as `0x${string}` | undefined;
const RPC_URL = process.env.HIVE_RPC_URL || "https://sepolia.base.org";
const CONTRACT_ADDRESS = (process.env.HIVE_CONTRACT_ADDRESS || "0x5F98d0FAf4aC81260aA0E32b4CBD591d1910e167") as `0x${string}`;

// Contract ABI (minimal)
const ABI = [
  {
    name: "getBounty",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "_bountyId" }],
    outputs: [
      { type: "address", name: "client" },
      { type: "uint256", name: "amount" },
      { type: "string", name: "codeUri" },
      { type: "bool", name: "isOpen" },
      { type: "address", name: "assignedAgent" },
      { type: "string", name: "reportUri" }
    ]
  },
  {
    name: "bountyCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "agents",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { type: "string", name: "name" },
      { type: "string", name: "bio" },
      { type: "uint256", name: "reputation" },
      { type: "bool", name: "isActive" },
      { type: "uint256", name: "stakedAmount" }
    ]
  },
  {
    name: "submitWork",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "_bountyId" },
      { type: "string", name: "_reportUri" }
    ],
    outputs: []
  }
] as const;

// Create clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL)
});

const account = PRIVATE_KEY ? privateKeyToAccount(PRIVATE_KEY) : undefined;
const walletClient = account ? createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL)
}) : undefined;

// Initialize MCP Server
const server = new Server(
  {
    name: "hive-mcp-server",
    version: "1.0.0",
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
        name: "hive_list_bounties",
        description: "List all open bounties on the HIVE marketplace. Returns bounty IDs, rewards, and code URIs.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "hive_get_bounty",
        description: "Get detailed information about a specific bounty by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            bountyId: {
              type: "number",
              description: "The ID of the bounty to retrieve"
            }
          },
          required: ["bountyId"]
        }
      },
      {
        name: "hive_submit_work",
        description: "Submit audit work for a bounty. Requires a registered agent wallet.",
        inputSchema: {
          type: "object",
          properties: {
            bountyId: {
              type: "number",
              description: "The ID of the bounty to submit work for"
            },
            reportUri: {
              type: "string",
              description: "IPFS URI of the audit report"
            }
          },
          required: ["bountyId", "reportUri"]
        }
      },
      {
        name: "hive_check_agent",
        description: "Check if an address is a registered HIVE agent.",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "The wallet address to check"
            }
          },
          required: ["address"]
        }
      },
      {
        name: "hive_upload_deliverable",
        description: "Upload a locally generated file (PDF, ZIP, DOCX) directly to the Hive platform. Returns the public URL to be used in the submit work tool.",
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

  if (name === "hive_list_bounties") {
    try {
      const bountyCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "bountyCounter"
      });

      const bounties = [];
      for (let i = 1n; i <= bountyCount; i++) {
        const bounty = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "getBounty",
          args: [i]
        });

        if (bounty[3]) { // isOpen
          bounties.push({
            id: i.toString(),
            reward: formatEther(bounty[1]) + " ETH",
            codeUri: bounty[2],
            client: bounty[0]
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: bounties.length > 0
              ? `Found ${bounties.length} open bounties:\n\n${bounties.map(b => 
                  `📋 Bounty #${b.id}\n   💰 Reward: ${b.reward}\n   🔗 Code: ${b.codeUri}`
                ).join("\n\n")}`
              : "No open bounties found."
          }
        ]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_get_bounty") {
    try {
      const bountyId = BigInt((args as any).bountyId);
      const bounty = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getBounty",
        args: [bountyId]
      });

      return {
        content: [
          {
            type: "text",
            text: `Bounty #${bountyId}:\n` +
              `  Client: ${bounty[0]}\n` +
              `  Reward: ${formatEther(bounty[1])} ETH\n` +
              `  Code URI: ${bounty[2]}\n` +
              `  Status: ${bounty[3] ? "Open" : "Closed"}\n` +
              `  Assigned Agent: ${bounty[4] === "0x0000000000000000000000000000000000000000" ? "None" : bounty[4]}`
          }
        ]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_submit_work") {
    if (!walletClient || !account) {
      return {
        content: [{ type: "text", text: "Error: HIVE_PRIVATE_KEY not configured. Cannot submit work." }]
      };
    }

    try {
      const bountyId = BigInt((args as any).bountyId);
      const reportUri = (args as any).reportUri as string;

      const { request: txRequest } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "submitWork",
        args: [bountyId, reportUri],
        account
      });

      const hash = await walletClient.writeContract(txRequest);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [
          {
            type: "text",
            text: receipt.status === "success"
              ? `✅ Successfully submitted work for Bounty #${bountyId}!\nTransaction: ${hash}`
              : `❌ Transaction reverted.`
          }
        ]
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }

  if (name === "hive_check_agent") {
    try {
      const address = (args as any).address as `0x${string}`;
      const agent = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "agents",
        args: [address]
      });

      if (!agent[3]) {
        return { content: [{ type: "text", text: `Address ${address} is NOT a registered HIVE agent.` }] };
      }

      return {
        content: [
          {
            type: "text",
            text: `🤖 Agent: ${agent[0]}\n` +
              `📝 Bio: ${agent[1]}\n` +
              `⭐ Reputation: ${agent[2].toString()}\n` +
              `💎 Staked: ${formatEther(agent[4])} ETH`
          }
        ]
      };
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

      // Read file into a Blob-like structure to send as FormData
      const fileBuffer = fs.readFileSync(absolutePath);
      const filename = path.basename(absolutePath);
      
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('file', blob, filename);

      const API_URL = process.env.HIVE_BASE_URL || "https://hive.luxenlabs.com";
      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
      }

      const data = (await response.json()) as any;
      return {
        content: [
          {
            type: "text",
            text: `✅ File successfully uploaded to Hive!\n\nURL: ${data.url}\n\nPlease use this URL as the reportUri when calling hive_submit_work or deliver.`
          }
        ]
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
            contractAddress: CONTRACT_ADDRESS,
            rpcUrl: RPC_URL,
            agentConfigured: !!account,
            agentAddress: account?.address || null
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
