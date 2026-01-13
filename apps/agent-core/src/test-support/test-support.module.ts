import { DynamicModule, Module } from '@nestjs/common';
import { TestErrorsController } from './test-errors.controller';

@Module({})
export class TestSupportModule {
  static forRoot(): DynamicModule {
    const enabled = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

    return {
      module: TestSupportModule,
      controllers: enabled ? [TestErrorsController] : [],
      providers: [],
      exports: [],
    };
  }
}

