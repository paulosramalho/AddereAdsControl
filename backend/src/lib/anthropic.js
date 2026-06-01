import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(apiKey) {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
}
