import { Command } from 'commander';
import { createAskCommand } from '../src/commands/ask';
import { HttpClient } from '../src/http-client';

describe('Ask Command', () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let command: Command;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
    };

    command = createAskCommand(mockHttpClient);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should call /v1/chat and print sessionId + finalResponse', async () => {
    mockHttpClient.post.mockResolvedValue({
      statusCode: 200,
      body: {
        requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
        latencyMs: 10,
        finalResponse: 'hello back',
        toolCalls: [],
        toolResults: [],
        trace: {
          requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
          steps: [
            {
              id: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
              kind: 'final',
              name: 'stub',
              startedAt: '2026-01-11T00:00:00.000Z',
            },
          ],
        },
      },
    });

    await command.parseAsync(['hi'], { from: 'user' });

    expect(mockHttpClient.post).toHaveBeenCalledWith('http://localhost:3000/v1/chat', {
      message: 'hi',
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('sessionId: 3fa85f64-5717-4562-b3fc-2c963f66afa7');
    expect(consoleLogSpy).toHaveBeenCalledWith('hello back');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit 1 on non-200 responses', async () => {
    mockHttpClient.post.mockResolvedValue({
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    });

    await command.parseAsync(['hi'], { from: 'user' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Received status code 500');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 when server returns invalid response shape', async () => {
    mockHttpClient.post.mockResolvedValue({
      statusCode: 200,
      body: { sessionId: 'not-a-uuid' },
    });

    await command.parseAsync(['hi'], { from: 'user' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Invalid response shape from server');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
