#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";

import { validateCiRun } from "./lib/deployment-validation.mjs";

const metadata = JSON.parse(
  readFileSync(process.env.CI_RUN_JSON ?? "", "utf8"),
);
const result = validateCiRun(
  metadata,
  process.env.GITHUB_REPOSITORY ?? "",
  process.env.DEPLOY_SHA ?? "",
);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `run_id=${result.id}\nsha=${result.sha}\n`,
  );
console.log(`validated CI run ${result.id} at ${result.sha}`);
