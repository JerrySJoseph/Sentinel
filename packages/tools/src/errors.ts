import { ToolName } from './types';
import { JsonValue } from '@sentinel/contracts';

export class ToolNotFoundError extends Error {
  readonly toolName: ToolName;

  constructor(toolName: ToolName) {
    super(`Tool not found: ${toolName}`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
  }
}

export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolRegistryError';
  }
}

export class ToolPolicyError extends Error {
  readonly toolName: ToolName;

  constructor(toolName: ToolName, message: string) {
    super(message);
    this.name = 'ToolPolicyError';
    this.toolName = toolName;
  }
}

/**
 * Represents a structured, user-facing tool error (e.g. invalid input).
 * This is distinct from internal failures.
 */
export class ToolUserError extends Error {
  readonly code: string;
  readonly details?: JsonValue;

  constructor(code: string, message: string, details?: JsonValue) {
    super(message);
    this.name = 'ToolUserError';
    this.code = code;
    this.details = details;
  }
}
