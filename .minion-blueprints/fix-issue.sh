# .minion-blueprints/fix-issue.sh — Diagnose and fix a bug
# Description: Diagnose and fix a bug with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Diagnose and create a fix plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Reproduce the issue mentally by analyzing the code
2. Identify root cause (not just the symptom)
3. Propose a concrete fix with files and lines to modify
4. Include tests covering the bug scenario (TDD: failing test first)
5. Identify if other locations share the same pattern

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown:
- Root cause
- Proposed fix (files, concrete changes)
- Tests to add
- Potential regressions
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Fix the bug following exactly this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step.
2. Start with the test that reproduces the bug (must fail).
3. Implement the fix so the test passes.
4. Verify existing tests are not broken.
5. After each fix unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "fix(<scope>): <description>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
