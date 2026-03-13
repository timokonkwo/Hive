import { createPublicClient, createWalletClient, http, parseAbiItem, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;

if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("Missing PRIVATE_KEY or CONTRACT_ADDRESS in .env");
    process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
});

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
});

console.log(`Starting HIVE Agent...`);
console.log(`Address: ${account.address}`);
console.log(`Monitoring Contract: ${CONTRACT_ADDRESS}`);

// ABI for events and functions
const ABI = [
    parseAbiItem('event BountyCreated(uint256 indexed bountyId, address indexed client, uint256 amount, string codeUri)'),
    parseAbiItem('function submitWork(uint256 _bountyId, string memory _reportUri) external')
];

async function main() {
    console.log("Listening for new bounties...");

    // Watch for BountyCreated events
    publicClient.watchEvent({
        address: CONTRACT_ADDRESS,
        events: [ABI[0]],
        onLogs: async (logs) => {
            for (const log of logs) {
                const { args } = log as any;
                const bountyId = args.bountyId;
                const client = args.client;
                const amount = args.amount;
                const codeUri = args.codeUri;

                console.log(`\n[NEW BOUNTY DETECTED]`);
                console.log(`ID: ${bountyId}`);
                console.log(`Client: ${client}`);
                console.log(`Amount: ${formatEther(amount)} ETH`);
                console.log(`Code URI: ${codeUri}`);

                await processBounty(bountyId, codeUri);
            }
        }
    });

}

async function processBounty(bountyId: bigint, codeUri: string) {
    console.log(`\n[ANALYZING BOUNTY #${bountyId}]`);
    console.log(`Reading code from: ${codeUri}`);

    // Simulate analysis delay
    console.log("Running AI Analysis...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // In a real agent, you would fetch the codeUri, run LLM analysis, and generate a report.
    // Here we generate a mock report.
    const mockReportUri = `ipfs://QmMockReportHash/${bountyId}`;
    console.log(`Analysis complete. Report generated: ${mockReportUri}`);

    console.log(`Submitting work for Bounty #${bountyId}...`);

    try {
        const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'submitWork',
            args: [bountyId, mockReportUri],
            account
        });
        const hash = await walletClient.writeContract(request);

        console.log(`Transaction sent! Hash: ${hash}`);
        
        console.log("Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            console.log(`[SUCCESS] Work submitted for Bounty #${bountyId}`);
        } else {
            console.error(`[FAILED] Transaction reverted.`);
        }

    } catch (error: any) {
        if (error.message.includes("Must be a registered agent")) {
            console.error("[ERROR] You are not a registered agent. Please register on the HIVE dashboard first.");
        } else if (error.message.includes("Insufficient stake")) {
            console.error("[ERROR] Insufficient stake.");
        } else {
            console.error("[ERROR] Submission failed:", error.message || error);
        }
    }
}

main().catch(console.error);
