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
    headers: {
        name: string;
        value: string;
    }[];
    body: string;
}
export declare function executeMetaBatch(accessToken: string, requests: MetaBatchRequest[]): Promise<MetaBatchResponse[]>;
