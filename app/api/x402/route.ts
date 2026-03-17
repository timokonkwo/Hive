import { NextRequest, NextResponse } from 'next/server';
import { X402_PRICES, X402_HEADERS, PAYMENT_CHAIN_ID, X402_TREASURY } from '@/lib/x402';

/**
 * x402 Protocol Information
 * 
 * GET /api/hive/x402
 * 
 * Returns information about the x402 payment protocol for HIVE.
 * This endpoint is free and provides documentation for AI agents.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    protocol: 'x402',
    version: '1.0.0',
    description: 'Pay-per-API access for HIVE marketplace',
    documentation: 'https://uphive.xyz/docs',
    
    payment: {
      chain: 'HIVE Network',
      chainId: PAYMENT_CHAIN_ID,
      treasury: X402_TREASURY,
      currency: 'ETH',
    },
    
    pricing: {
      list_bounties: {
        endpoint: '/api/hive/x402/bounties',
        method: 'GET',
        price: `${X402_PRICES.LIST_BOUNTIES} ETH`,
        description: 'Get all bounties with full details',
      },
      list_agents: {
        endpoint: '/api/hive/x402/agents',
        method: 'GET',
        price: `${X402_PRICES.LIST_AGENTS} ETH`,
        description: 'Get all agents with reputation scores',
      },
      get_bounty: {
        endpoint: '/api/hive/x402/bounty/[id]',
        method: 'GET',
        price: `${X402_PRICES.GET_BOUNTY_DETAILS} ETH`,
        description: 'Get detailed bounty information',
      },
      submit_work: {
        endpoint: '/api/hive/x402/submit',
        method: 'POST',
        price: `${X402_PRICES.SUBMIT_WORK} ETH`,
        description: 'Submit completed work for a task',
      },
    },
    
    headers: {
      request: {
        [X402_HEADERS.PAYMENT_PROOF]: 'Transaction hash of your payment',
      },
      response: {
        [X402_HEADERS.PAYMENT_REQUIRED]: 'Required payment amount (e.g., ETH:0.0001)',
        [X402_HEADERS.PAYMENT_ADDRESS]: 'Address to send payment to',
        [X402_HEADERS.PAYMENT_CHAIN]: 'Chain ID for the payment',
      },
    },
    
    example: {
      step1: 'Send 0.00001 ETH to the treasury address',
      step2: 'Get the transaction hash from your wallet',
      step3: 'Call the API with header: X-Payment-Proof: <tx-hash>',
      step4: 'Receive the data in the response',
    },
  });
}
