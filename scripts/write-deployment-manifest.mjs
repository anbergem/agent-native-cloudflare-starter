#!/usr/bin/env node
import { writeFileSync } from "node:fs";

import { validateRunId } from "./lib/deployment-validation.mjs";

const sha = process.env.DEPLOY_SHA ?? "";
if (!/^[0-9a-f]{40}$/.test(sha))
  throw new Error("DEPLOY_SHA must be a full git SHA");
const sourceCiRunId = validateRunId(process.env.SOURCE_CI_RUN_ID ?? "");
const repository = process.env.GITHUB_REPOSITORY ?? "";
if (!repository) throw new Error("GITHUB_REPOSITORY is required");
writeFileSync(
  process.env.DEPLOYMENT_MANIFEST ?? "deployment-manifest.json",
  `${JSON.stringify({ repository, sha, sourceCiRunId }, null, 2)}\n`,
);
