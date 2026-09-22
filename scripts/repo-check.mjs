#!/usr/bin/env node
import { run } from './repo-kit/cli.mjs'

process.exitCode = await run(process.argv.slice(2), process.cwd())
