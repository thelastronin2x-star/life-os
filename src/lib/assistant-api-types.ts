/** Shared between the client (assistant-client.ts, BubbleShell.tsx)
 *  and the server (api/assistant/route.ts) — the wire format for a single
 *  non-streaming turn, including raw Anthropic content blocks for the
 *  tool-use turns a scoped bubble replays back to the API. */

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface AssistantApiMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export type AssistantScopeParam = "global" | "calendar" | "health" | "work" | "student";

export interface AssistantApiRequest {
  messages: AssistantApiMessage[];
  context?: string;
  scope?: AssistantScopeParam;
  taskType?: string;
}

export interface AssistantApiResponse {
  text: string;
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[];
}
