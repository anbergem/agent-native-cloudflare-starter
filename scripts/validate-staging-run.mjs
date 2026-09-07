#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";

import {
  validateCiRun,
  validateDeploymentManifest,
  validateRunId,
  validateStagingRun,
} from "./lib/deployment-validation.mjs";

const runId = validateRunId(process.env.STAGING_RUN_ID ?? "");
const repository = process.env.GITHUB_REPOSITORY ?? "";
const metadataPath = process.env.STAGING_RUN_JSON ?? "";
if (!repository || !metadataPath)
  throw new Error("GITHUB_REPOSITORY and STAGING_RUN_JSON are required");
const run = JSON.parse(readFileSync(metadataPath, "utf8"));
validateStagingRun(run, repository);
const manifest = validateDeploymentManifest(
  JSON.parse(readFileSync(process.env.DEPLOYMENT_MANIFEST ?? "", "utf8")),
  repository,
);
const ci = validateCiRun(
  JSON.parse(readFileSync(process.env.CI_RUN_JSON ?? "", "utf8")),
  repository,
  manifest.sha,
);
if (ci.id !== manifest.sourceCiRunId)
  throw new Error("deployment manifest names a different CI run");
const sha = manifest.sha;
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\nrun_id=${runId}\n`);
console.log(`validated staging run ${runId} at ${sha}`);
