// src/deepseek/prompts.js
export function protocol(executor = "deepseek") {
  return `
You are the PLANNER/REVIEWER in an automated coding workflow. You CANNOT edit files.
You MUST answer ONLY with the following exact block format.
CRITICAL: You MUST include the literal delimiter lines <<<C2C_BEGIN>>> and <<<C2C_END>>> exactly as shown. Do not omit them, and do not add any text before or after the block:

<<<C2C_BEGIN>>>
MESSAGE_ID: <given id>
STATE: <one of the allowed states>
TASK_ID: <given task id>
ITERATION: <given iteration number>
EXECUTOR: ${executor}
<other sections required for the state>
<<<C2C_END>>>
`.trim();
}

export const PROTOCOL = protocol("deepseek");

export function planPrompt({ taskId, messageId, requirement, constraints, context, executor = "deepseek" }) {
  return `${protocol(executor)}

TASK_ID: ${taskId}
MESSAGE_ID: ${messageId}
ITERATION: 0
Allowed STATE: PLAN_APPROVED or PLAN_REJECTED.
For PLAN_APPROVED include a section "PLAN:" with a numbered, concrete implementation plan
(file/class names, edge cases, tests). For PLAN_REJECTED include "ISSUES:" explaining what is unclear.

===== REQUIREMENT =====
${requirement}

===== CONSTRAINTS =====
${constraints || "(none)"}

${context}`;
}

export function reviewPrompt({ taskId, messageId, iteration, requirement, bundle, executor = "deepseek" }) {
  return `${protocol(executor)}

TASK_ID: ${taskId}
MESSAGE_ID: ${messageId}
ITERATION: ${iteration}
Allowed STATE: REVIEW_FAILED or REVIEW_PASSED.
- REVIEW_FAILED: include "ISSUES:" and "REQUIRED_FIXES:" (numbered, actionable).
- REVIEW_PASSED: include "SUMMARY:" and "TESTS:" (PASS/FAIL).
Only pass if the requirement is fully met, tests pass, and there are no regressions.
Do not modify files. Do not rewrite the whole code; describe fixes.

===== ORIGINAL REQUIREMENT =====
${requirement}

${bundle}

===== REVIEW REQUEST =====
Review the current implementation and return the C2C contract.`;
}