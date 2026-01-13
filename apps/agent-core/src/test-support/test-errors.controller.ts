import { Controller, Get } from '@nestjs/common';
import { ProviderNotFoundError } from '@sentinel/providers';
import { ToolNotFoundError } from '@sentinel/tools';

/**
 * Test-only endpoints used to validate error normalization.
 * Not registered unless running under Jest (see TestSupportModule).
 */
@Controller('__test__/errors')
export class TestErrorsController {
  @Get('provider')
  throwProviderError(): void {
    throw new ProviderNotFoundError('missing-provider');
  }

  @Get('tool')
  throwToolError(): void {
    throw new ToolNotFoundError('missing_tool');
  }

  @Get('internal')
  throwInternal(): void {
    throw new Error('boom');
  }
}

