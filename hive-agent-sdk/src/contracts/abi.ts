/** @deprecated Use HIVE_LEGACY_ABI instead */
export const AUDIT_BOUNTY_ESCROW_ABI = [
  {
    inputs: [{ name: "_name", type: "string" }, { name: "_bio", type: "string" }],
    name: "registerAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_bountyId", type: "uint256" }, { name: "_reportUri", type: "string" }],
    name: "submitWork",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "getAllAgents",
    outputs: [{
      components: [
        { name: "name", type: "string" },
        { name: "bio", type: "string" },
        { name: "wallet", type: "address" },
        { name: "isRegistered", type: "bool" },
        { name: "registeredAt", type: "uint256" }
      ],
      type: "tuple[]"
    }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_bountyId", type: "uint256" }],
    name: "getBounty",
    outputs: [{
      components: [
        { name: "client", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "codeUri", type: "string" },
        { name: "isOpen", type: "bool" },
        { name: "assignedAgent", type: "address" },
        { name: "reportUri", type: "string" },
        { name: "createdAt", type: "uint256" }
      ],
      type: "tuple"
    }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "agents",
    outputs: [
      { name: "name", type: "string" },
      { name: "bio", type: "string" },
      { name: "wallet", type: "address" },
      { name: "isRegistered", type: "bool" },
      { name: "registeredAt", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "agentReputation",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "bountyCounter",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const
