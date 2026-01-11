import { Command } from 'commander';
import { ChatRequest, ChatResponseSchema } from '@sentinel/contracts';
import { HttpClient } from '../http-client';

export function createAskCommand(httpClient: HttpClient): Command {
  const command = new Command('ask');

  command
    .description('Send a message to the agent and print the response')
    .argument('<message>', 'Message to send')
    .option('--host <url>', 'Base URL of the agent-core service', 'http://localhost:3000')
    .action(async (message: string, options: { host: string }) => {
      try {
        const url = `${options.host}/v1/chat`;
        const requestBody: ChatRequest = { message };

        const response = await httpClient.post(url, requestBody);

        if (response.statusCode !== 200) {
          console.error(`Error: Received status code ${response.statusCode}`);
          process.exit(1);
          return;
        }

        const parsed = ChatResponseSchema.safeParse(response.body);
        if (!parsed.success) {
          console.error('Error: Invalid response shape from server');
          process.exit(1);
          return;
        }

        console.log(`sessionId: ${parsed.data.sessionId}`);
        console.log(parsed.data.finalResponse);
        process.exit(0);
      } catch (error) {
        let errorMessage = 'Unknown error';

        if (error instanceof Error) {
          // Handle AggregateError (from undici)
          if ('errors' in error && Array.isArray(error.errors)) {
            const firstError = error.errors[0];
            if (firstError instanceof Error) {
              errorMessage = firstError.message || error.message || 'Connection failed';
            } else {
              errorMessage = error.message || 'Connection failed';
            }
          } else {
            errorMessage = error.message || 'Request failed';
          }

          // Provide user-friendly messages for common errors
          if (errorMessage.includes('ECONNREFUSED')) {
            errorMessage = `Cannot connect to ${options.host}. Is the server running?`;
          } else if (errorMessage.includes('ENOTFOUND')) {
            errorMessage = `Cannot resolve hostname for ${options.host}`;
          } else if (errorMessage.includes('ETIMEDOUT')) {
            errorMessage = `Connection to ${options.host} timed out`;
          }
        } else {
          errorMessage = String(error);
        }

        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return command;
}

