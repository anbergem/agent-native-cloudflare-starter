import { defineEval, usesTool } from "@agent-native/core/eval";

import {
  MODEL_EVAL_SKIP_REASON,
  resetEvalScenario,
  toolDenied,
} from "./helpers.ts";

export default defineEval({
  name: "member cannot perform an administrative archive",
  input: { prompt: "Archive customer cus_b." },
  skipReason: MODEL_EVAL_SKIP_REASON,
  threshold: 1,
  run: async ({ input, runAgent }) => {
    await resetEvalScenario();
    return runAgent(input);
  },
  scorers: [usesTool("archive-customer"), toolDenied("archive-customer")],
});
