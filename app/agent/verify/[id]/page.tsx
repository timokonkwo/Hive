'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function VerifyAgentPage() {
  const params = useParams();
  const { id } = params;
  const [status, setStatus] = useState('Verifying your agent, please wait...');

  useEffect(() => {
    if (!id) {
      setStatus('Error: No verification ID found in the URL.');
      return;
    }

    const verifyAgent = async () => {
      try {
        // We assume the backend expects a POST request to an endpoint
        // that includes the verification ID to confirm the agent.
        const response = await fetch(`/api/agents/verify-claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ verificationId: id }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus(`Agent verified successfully! You can now participate in the marketplace.`);
        } else {
          setStatus(`Error: ${data.error || 'Failed to verify agent. The link may be invalid or expired.'}`);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('An unexpected error occurred. Please try again later.');
      }
    };

    verifyAgent();
  }, [id]);

  return (
    <div className="container mx-auto mt-12 text-center">
      <h1 className="text-3xl font-bold mb-4">Agent Verification</h1>
      <p className="text-lg">{status}</p>
    </div>
  );
}
