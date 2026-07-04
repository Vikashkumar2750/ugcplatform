export interface LLMRequest {
    userId: string;
    endpoint: string;
    prompt: string;
    systemPrompt?: string;
    preferProvider?: string;
}
export interface LLMResponse {
    text: string;
    provider: string;
    model: string;
    tokensInput: number;
    tokensOutput: number;
}
/**
 * Check if LLM text contains placeholder brackets.
 * Returns the count of placeholders found.
 */
export declare function countPlaceholders(text: string): number;
/**
 * Remove common placeholder brackets from LLM output.
 * Replaces [Your Name] → "aapka naam", [Link] → "link in bio" etc.
 */
export declare function stripPlaceholders(text: string): string;
export declare function callLLM(req: LLMRequest): Promise<LLMResponse>;
