#!/usr/bin/env node

import argumentParser from './cli/argumentParser';
import { getVersion } from './cli/console';

const args = argumentParser._;

if (args.includes('version')) {
  getVersion();
  process.exit(0);
}
if (args.includes('help')) {
  console.log('Help page');
  process.exit(0);
}
