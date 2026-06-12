import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment automatically.
// This module must only ever be imported in server code (API routes).
export const anthropic = new Anthropic();

export const MODEL = "claude-sonnet-4-5";
