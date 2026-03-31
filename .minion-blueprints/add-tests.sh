# .minion-blueprints/add-tests.sh — Add tests to existing modules
# Description: Add tests to existing modules

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Add tests for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Analyze the existing code of the indicated module/file
2. Identify use cases and edge cases to test
3. Write comprehensive tests following existing patterns
4. Do NOT modify production code
5. After completing tests:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "test(<scope>): add tests for <module>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
