#!/usr/bin/env node

import { parsedArgs } from "./lib/argumentParser";
import { getVersion } from "./lib/console";
const args = parsedArgs['_'];

if (args.includes('version')) {
    getVersion();
    process.exit(0);
} 
if (args.includes("help")) {
    console.log("Help page");
    process.exit(0);
}