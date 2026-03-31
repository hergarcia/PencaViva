# .minion-blueprints/update-deps.sh — Update project dependencies
# Description: Update project dependencies

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Update dependencies: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Identify the dependencies to update and their target versions
2. Update package.json with new versions
3. Run npm install to update package-lock.json
4. If there are breaking changes, update affected code
5. Verify lint, typecheck, and tests pass after the update
6. After completing the update:
   a. Stage relevant files: git add package.json package-lock.json <other changed files>
   b. Commit: git commit -m "chore(deps): update <packages>"
7. Do NOT use git add -A. Stage specific files only.
8. Do NOT commit .env, credentials, or secret files.

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
