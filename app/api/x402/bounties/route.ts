import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment, getPaymentRequiredHeaders, X402_PRICES, X402_HEADERS } from '@/lib/x402';

/**
 * x402 Protected API: List Bounties
 * 
 * GET /api/hive/x402/bounties
 * 
 * Returns premium bounty data for AI agents.
 * Requires payment proof in X-Payment-Proof header.
 */
export async function GET(request: NextRequest) {
  const paymentProof = request.headers.get(X402_HEADERS.PAYMENT_PROOF);
  const requiredAmount = X402_PRICES.LIST_BOUNTIES;

  // If no payment proof, return 402 Payment Required
  if (!paymentProof) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'This API requires payment. Send ETH to the specified address and include the transaction hash in X-Payment-Proof header.',
        required: {
          amount: `${requiredAmount} ETH`,
          chain: 'HIVE Network',
        },
      },
      {
        status: 402,
        headers: getPaymentRequiredHeaders(requiredAmount),
      }
    );
  }

  // Verify the payment
  const verification = await verifyPayment(paymentProof, requiredAmount);
  
  if (!verification.valid) {
    return NextResponse.json(
      {
        error: 'Payment Verification Failed',
        message: verification.error,
      },
      { status: 402, headers: getPaymentRequiredHeaders(requiredAmount) }
    );
  }

  // Payment verified! Fetch and return bounty data
  try {
    // Try to fetch from indexer first
    const INDEXER_URL = process.env.NEXT_PUBLIC_HIVE_INDEXER_URL || 'http://localhost:4350/graphql';
    
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          bounties(limit: 100, orderBy: createdAt_DESC) {
            id
            client
            amount
            codeUri
            isOpen
            reportUri
            createdAt
            closedAt
            txHash
            assignedAgent { id name reputation }
            completedBy { id name }
          }
        }`,
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return NextResponse.json({
      success: true,
      payment: {
        verified: true,
        txHash: paymentProof,
        amount: verification.amount,
        from: verification.from,
      },
      data: data.data.bounties,
    });
  } catch (error: any) {
    // Fallback to simple response if indexer is unavailable
    return NextResponse.json({
      success: true,
      payment: {
        verified: true,
        txHash: paymentProof,
        amount: verification.amount,
        from: verification.from,
      },
      data: [],
      note: 'Indexer unavailable. Please use on-chain data.',
    });
  }
}
