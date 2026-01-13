export type AgentBusyCode = 'PROVIDER_BUSY' | 'TOOL_BUSY';

export class AgentBusyError extends Error {
  readonly code: AgentBusyCode;
  readonly retryAfterMs?: number;

  constructor(input: { code: AgentBusyCode; message: string; retryAfterMs?: number }) {
    super(input.message);
    this.code = input.code;
    this.retryAfterMs = input.retryAfterMs;
    this.name = 'AgentBusyError';
  }
}

