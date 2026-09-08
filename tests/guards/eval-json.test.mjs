import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

// Every provider credential the framework's own deploy-credential list names,
// removed from the child environment so this test can never reach a paid API
// and can never be billed to whoever runs `pnpm test:guards`. With none of them
// set, `resolveEngine` refuses before any request is made, which is what the
// "No LLM provider is connected" assertion below proves.
const PROVIDER_KEYS = [
  "ANTHROPIC_API_KEY",
  "BUILDER_GATEWAY_SPACE_ID",
  "BUILDER_GATEWAY_TOKEN",
  "BUILDER_PRIVATE_KEY",
  "BUILDER_PUBLIC_KEY",
  "COHERE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "OLLAMA_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENROUTER_API_KEY",
];

function runModelEvals() {
  const env = { ...process.env, RUN_MODEL_EVALS: "1" };
  for (const key of PROVIDER_KEYS) delete env[key];
  const result = spawnSync("node", ["scripts/run-evals.mjs", "--json"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

// `RUN_MODEL_EVALS=1 node scripts/run-evals.mjs --json > eval-evidence.json` is
// the documented way to capture release evidence, so stdout has to be exactly
// one JSON document. The preparation steps used to print "applied 0001_init.sql"
// to stdout, which put two bare words ahead of the document and made the
// artifact unparseable (DISCREPANCIES.md, 2026-09-08).
test("a model-backed --json run writes only JSON to stdout", () => {
  const result = runModelEvals();

  let report;
  assert.doesNotThrow(
    () => {
      report = JSON.parse(result.stdout);
    },
    `stdout is not a single JSON document:\n${result.stdout.slice(0, 400)}`,
  );

  assert.equal(report.report.total, 5, "all five evals ran");
  assert.equal(report.report.skipped, 0, "RUN_MODEL_EVALS=1 skips nothing");

  // The preparation output still has to be visible, just on the other stream.
  assert.match(result.stderr, /applied 0001_init\.sql/);
  assert.doesNotMatch(result.stdout, /applied 0001_init\.sql/);

  // No provider was reachable, so nothing here was a paid request.
  for (const entry of report.report.results) {
    assert.match(String(entry.error), /No LLM provider is connected/);
  }
});
