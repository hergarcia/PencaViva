# .minion-blueprints/refactor.sh — Refactor existing code
# Description: Refactor existing code with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Create a refactoring plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Analyze the current code to be refactored
2. Identify invariants that MUST be maintained (contracts, interfaces, behavior)
3. Propose the new structure with files and concrete changes
4. Define safe refactoring steps (each step leaves code functional)
5. Identify existing tests that validate current behavior
6. If tests are missing, add them first (to ensure refactor doesn't break anything)

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown:
- Current state (what and why to refactor)
- Invariants to maintain
- Step-by-step plan (each step is safe)
- Tests to add/modify
- Files to create/modify/delete (exact paths)
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Refactor following exactly this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step. Each step must leave code functional.
2. If the plan includes new tests, write them first.
3. Perform the refactoring while maintaining invariants.
4. Verify existing tests still pass after each change.
5. Do not change behavior — only structure.
6. After each refactoring unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "refactor(<scope>): <description>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
