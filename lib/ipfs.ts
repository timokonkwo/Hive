import { TaskMetadata } from "./types/task";

/**
 * Mocks an IPFS upload by creating a data URI or storing in a temporary object store.
 * In production, this would upload to Pinata/IPFS and return an `ipfs://` hash.
 */
export async function uploadMetadata(metadata: TaskMetadata): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // For MVP/Demo: Encode as base64 data URI to avoid needing a real IPFS node immediately.
  // The contract simply stores a string, so this works perfectly for testing.
  // Prefix with "data:application/json;base64,"
  const jsonString = JSON.stringify(metadata);
  const base64 = Buffer.from(jsonString).toString('base64');
  
  return `data:application/json;base64,${base64}`;
}

export function parseMetadata(uri: string): TaskMetadata | null {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const base64 = uri.split(",")[1];
      const jsonString = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonString);
    }
    
    // Fallback for legacy "raw" URIs (e.g., http links or plain IPFS hashes from before generic tasks)
    if (uri.startsWith("http") || uri.startsWith("ipfs")) {
        // If it's a legacy code URI, we wrap it in a pseudo-task structure
        return {
            title: "Legacy Task",
            description: "Review the codebase at the provided link.",
            category: 'Security',
            tags: ['Legacy'],
            targetUri: uri
        };
    }
    
    return {
        title: "Unknown Task",
        description: uri,
        category: 'Other',
        tags: [],
        targetUri: uri
    };

  } catch (e) {
    console.error("Failed to parse metadata", e);
    return null;
  }
}
