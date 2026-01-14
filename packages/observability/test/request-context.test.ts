import { getRequestContext, runWithRequestContext, setRequestContext } from '../src';

describe('request context (AsyncLocalStorage)', () => {
  it('propagates across async boundaries (microtasks + timers)', async () => {
    await runWithRequestContext(
      { requestId: 'req-1', sessionId: 'sess-1', traceId: 'trace-1', spanId: 'span-1' },
      async () => {
        expect(getRequestContext()).toEqual(
          expect.objectContaining({ requestId: 'req-1', sessionId: 'sess-1' })
        );

        await Promise.resolve();
        expect(getRequestContext()?.requestId).toBe('req-1');

        await new Promise<void>(resolve =>
          setTimeout(() => {
            expect(getRequestContext()?.traceId).toBe('trace-1');
            resolve();
          }, 0)
        );
      }
    );
  });

  it('supports updating the context within a request', async () => {
    await runWithRequestContext({ requestId: 'req-2' }, async () => {
      expect(getRequestContext()).toEqual({ requestId: 'req-2' });
      setRequestContext({ sessionId: 'sess-2' });
      await Promise.resolve();
      expect(getRequestContext()).toEqual({ requestId: 'req-2', sessionId: 'sess-2' });
    });
  });
});
