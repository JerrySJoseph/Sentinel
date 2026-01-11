import { ChatRequest, PlanOutput } from '@sentinel/contracts';

export type ProviderName = string;

export type PlanOptions = {
  requestId: string;
  sessionId?: string;
};

export type PlanInput = {
  request: ChatRequest;
  options: PlanOptions;
};

export interface LLMProvider {
  readonly name: ProviderName;
  plan(input: PlanInput): Promise<PlanOutput>;
}

