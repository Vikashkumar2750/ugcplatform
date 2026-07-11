
/**
 * Utility for making batch requests to Meta Graph API.
 * Meta allows up to 50 requests per batch.
 */

export interface MetaBatchRequest {
  method: "GET" | "POST" | "DELETE" | "PUT";
  relative_url: string;
  body?: string;
  name?: string;
  omit_response_on_success?: boolean;
}

export interface MetaBatchResponse {
  code: number;
  headers: { name: string; value: string }[];
  body: string; // JSON string
}

export async function executeMetaBatch(
  accessToken: string,
  requests: MetaBatchRequest[]
): Promise<MetaBatchResponse[]> {
  if (requests.length === 0) return [];
  
  // Chunk requests into batches of 50
  const results: MetaBatchResponse[] = [];
  
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50);
    
    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("batch", JSON.stringify(chunk));

    const response = await fetch("https://graph.facebook.com/v21.0", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Meta batch API failed: ${err}`);
    }

    const chunkResults: MetaBatchResponse[] = await response.json();
    results.push(...chunkResults);
  }

  return results;
}
