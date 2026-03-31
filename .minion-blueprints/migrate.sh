# .minion-blueprints/migrate.sh — Migrate patterns or dependencies
# Description: Migrate patterns or dependencies

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Perform migration: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Identify all files affected by the migration
2. Make changes systematically and consistently
3. Verify existing tests still pass
4. Update imports, types, and references in all affected files
5. After each logical migration unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "refactor(<scope>): migrate <what>"
6. Do NOT use git add -A. Stage specific files only.
7. Do NOT commit .env, credentials, or secret files.

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
