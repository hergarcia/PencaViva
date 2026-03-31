# .minion-blueprints/implement.sh — Implement a new feature
# Description: Implement a new feature with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Create a detailed implementation plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Read CLAUDE.md for project conventions
2. Search for similar existing code as pattern reference
3. Identify files to create/modify (exact paths)
4. Plan step by step: tests first (TDD), then implementation
5. Each step should result in a committable unit
6. Identify potential risks or design decisions

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown with exact file paths and concrete names.
Each step should be a logical commit unit.
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Implement exactly according to this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step. Do not deviate.
2. Start with tests (TDD): write failing test, then implement to pass.
3. After completing each logical subtask:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "<type>(<scope>): <description>"
   d. Continue to next subtask
4. Do NOT use git add -A. Stage specific files only.
5. Do NOT commit .env, credentials, or secret files.
6. Ensure all files mentioned in the plan are created/modified.

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
