#!/usr/bin/env node

import { parsedArgs } from "./bot/argumentParser";
import { getVersion } from "./bot/console";
const args = parsedArgs['_'];

if (args.includes('version')) {
    getVersion();
    process.exit(0);
} 
if (args.includes("help")) {
    console.log("Help page");
    process.exit(0);
}