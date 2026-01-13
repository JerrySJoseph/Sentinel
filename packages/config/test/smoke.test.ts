import { sentinelConfig } from '../src';

describe('@sentinel/config', () => {
  it('exports a config object', () => {
    expect(sentinelConfig).toEqual({ version: 1 });
  });
});

