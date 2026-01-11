import { Command } from 'commander';
import { createHealthCommand } from '../src/commands/health';
import { HttpClient } from '../src/http-client';

describe('Health Command', () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let command: Command;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;

    command = createHealthCommand(mockHttpClient);

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

  it('should call health endpoint with default host', async () => {
    const mockResponse = {
      statusCode: 200,
      body: { status: 'ok' },
    };

    mockHttpClient.get.mockResolvedValue(mockResponse);

    await command.parseAsync(['health'], { from: 'user' });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3000/health');
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockResponse.body, null, 2));
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should call health endpoint with custom host', async () => {
    const mockResponse = {
      statusCode: 200,
      body: { status: 'ok' },
    };

    mockHttpClient.get.mockResolvedValue(mockResponse);

    await command.parseAsync(['health', '--host', 'http://example.com:8080'], {
      from: 'user',
    });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://example.com:8080/health');
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockResponse.body, null, 2));
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle non-200 status codes', async () => {
    const mockResponse = {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    };

    mockHttpClient.get.mockResolvedValue(mockResponse);

    await command.parseAsync(['health'], { from: 'user' });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3000/health');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error: Received status code ${mockResponse.statusCode}`
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle HTTP errors', async () => {
    const error = new Error('Network error');
    mockHttpClient.get.mockRejectedValue(error);

    await command.parseAsync(['health'], { from: 'user' });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3000/health');
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error: ${error.message}`);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle ECONNREFUSED errors with user-friendly message', async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');
    mockHttpClient.get.mockRejectedValue(error);

    await command.parseAsync(['health'], { from: 'user' });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3000/health');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error: Cannot connect to http://localhost:3000. Is the server running?'
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle non-Error exceptions', async () => {
    const error = 'String error';
    mockHttpClient.get.mockRejectedValue(error);

    await command.parseAsync(['health'], { from: 'user' });

    expect(mockHttpClient.get).toHaveBeenCalledWith('http://localhost:3000/health');
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error: ${String(error)}`);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
