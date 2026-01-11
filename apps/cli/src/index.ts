#!/usr/bin/env node

import { Command } from 'commander';
import { createHealthCommand } from './commands/health';
import { UndiciHttpClient } from './http-client';

const program = new Command();

program
    .name('sentinel')
    .description('CLI client for the Sentinel agent system')
    .version('0.1.0');

const httpClient = new UndiciHttpClient();
program.addCommand(createHealthCommand(httpClient));

program.parse();
