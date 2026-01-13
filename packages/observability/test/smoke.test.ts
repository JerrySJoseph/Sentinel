import type { RequestContext } from '../src';

describe('@sentinel/observability', () => {
  it('exports types', () => {
    const ctx: RequestContext = { requestId: 'req-1', sessionId: 'sess-1' };
    expect(ctx.requestId).toBe('req-1');
  });
});

