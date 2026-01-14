import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
  type CounterConfiguration,
  type HistogramConfiguration,
} from 'prom-client';

type LabelsHttp = { method: string; route: string; status_code: string };
type LabelsProvider = { provider: string };
type LabelsTool = { tool: string };
type LabelsError = { code: string; status_code: string };

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  private readonly httpRequestsTotal: Counter<keyof LabelsHttp>;
  private readonly httpRequestDurationSeconds: Histogram<keyof LabelsHttp>;

  private readonly agentTurnDurationSeconds: Histogram<string>;
  private readonly providerCallDurationSeconds: Histogram<keyof LabelsProvider>;
  private readonly toolExecutionDurationSeconds: Histogram<keyof LabelsTool>;

  private readonly errorsTotal: Counter<keyof LabelsError>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = this.makeCounter({
      name: 'sentinel_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDurationSeconds = this.makeHistogram({
      name: 'sentinel_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.agentTurnDurationSeconds = this.makeHistogram({
      name: 'sentinel_agent_turn_duration_seconds',
      help: 'Agent runTurn duration in seconds',
      labelNames: [],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    });

    this.providerCallDurationSeconds = this.makeHistogram({
      name: 'sentinel_provider_call_duration_seconds',
      help: 'Provider plan() call duration in seconds',
      labelNames: ['provider'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    });

    this.toolExecutionDurationSeconds = this.makeHistogram({
      name: 'sentinel_tool_execution_duration_seconds',
      help: 'Tool execute() call duration in seconds',
      labelNames: ['tool'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    this.errorsTotal = this.makeCounter({
      name: 'sentinel_errors_total',
      help: 'Total errors returned by the API',
      labelNames: ['code', 'status_code'],
    });
  }

  observeHttp(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    const labels: LabelsHttp = {
      method: input.method,
      route: input.route,
      status_code: String(input.statusCode),
    };
    this.httpRequestsTotal.inc(labels, 1);
    this.httpRequestDurationSeconds.observe(labels, input.durationSeconds);
  }

  observeAgentTurn(durationSeconds: number): void {
    this.agentTurnDurationSeconds.observe(durationSeconds);
  }

  observeProvider(provider: string, durationSeconds: number): void {
    this.providerCallDurationSeconds.observe({ provider }, durationSeconds);
  }

  observeTool(tool: string, durationSeconds: number): void {
    this.toolExecutionDurationSeconds.observe({ tool }, durationSeconds);
  }

  incError(input: { code: string; statusCode: number }): void {
    this.errorsTotal.inc({ code: input.code, status_code: String(input.statusCode) }, 1);
  }

  private makeCounter<T extends string>(cfg: CounterConfiguration<T>): Counter<T> {
    return new Counter<T>({ ...cfg, registers: [this.registry] });
  }

  private makeHistogram<T extends string>(cfg: HistogramConfiguration<T>): Histogram<T> {
    return new Histogram<T>({ ...cfg, registers: [this.registry] });
  }
}
