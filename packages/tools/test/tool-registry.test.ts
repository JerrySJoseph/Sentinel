import { ToolRegistry, ToolRegistryError, ToolNotFoundError, type Tool } from '../src';
import { z } from 'zod';

describe('ToolRegistry', () => {
  it('registers and gets tools by name', () => {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: 't',
      description: 'test',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => 'ok',
    };

    registry.register(tool);

    expect(registry.has('t')).toBe(true);
    expect(registry.get('t')).toBe(tool);
  });

  it('throws on duplicate registration', () => {
    const registry = new ToolRegistry();
    const tool: Tool = {
      name: 't',
      description: 'test',
      risk: 'safe',
      argsSchema: z.object({}).strict(),
      execute: async () => 'ok',
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow(ToolRegistryError);
  });

  it('throws ToolNotFoundError for missing tool', () => {
    const registry = new ToolRegistry();
    expect(() => registry.get('missing')).toThrow(ToolNotFoundError);
  });
});

