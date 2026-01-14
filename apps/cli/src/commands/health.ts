import { Command } from 'commander';
import { HttpClient } from '../http-client';

export function createHealthCommand(httpClient: HttpClient): Command {
  const command = new Command('health');

  command
    .description('Check the health status of the agent-core service')
    .option('--host <url>', 'Base URL of the agent-core service', 'http://localhost:3000')
    .action(async (options: { host: string }) => {
      try {
        const url = `${options.host}/health`;
        const response = await httpClient.get(url);

        if (response.statusCode === 200) {
          console.log(JSON.stringify(response.body, null, 2));
          process.exit(0);
        } else {
          console.error(`Error: Received status code ${response.statusCode}`);
          process.exit(1);
        }
      } catch (error) {
        let errorMessage = 'Unknown error';

        if (error instanceof Error) {
          // Handle AggregateError (from undici)
          const aggErrors = (error as { errors?: unknown }).errors;
          if (Array.isArray(aggErrors)) {
            const errors = aggErrors as unknown[];
            const firstError = errors[0];
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
