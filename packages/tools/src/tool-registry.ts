import { ToolNotFoundError, ToolRegistryError } from './errors';
import { Tool, ToolName } from './types';

export class ToolRegistry {
  private readonly tools = new Map<ToolName, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ToolRegistryError(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: ToolName): boolean {
    return this.tools.has(name);
  }

  get(name: ToolName): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    return tool;
  }

  list(): ToolName[] {
    return Array.from(this.tools.keys()).sort();
  }
}
