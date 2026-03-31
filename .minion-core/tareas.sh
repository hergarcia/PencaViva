# .minion-core/tareas.sh — TAREAS.md parser + task state management

# ── Task ID detection ──────────────────────────────────
# Returns 0 if $TASK matches F{digit}-{digits} pattern, sets TASK_ID.
# Returns 1 otherwise (free-form fallback).
parse_task_id() {
    if [[ "$TASK" =~ ^F([0-9])-([0-9]{2})$ ]]; then
        TASK_ID="$TASK"
        TASK_PHASE="${BASH_REMATCH[1]}"
        TASK_NUMBER="${BASH_REMATCH[2]}"
        return 0
    fi
    TASK_ID=""
    TASK_PHASE=""
    TASK_NUMBER=""
    return 1
}

# ── Read task from TAREAS.md ──────────────────────────
# Populates TASK_TITLE, TASK_DESCRIPTION, TASK_DEPENDENCIES, TASK_EFFORT, TASK_STATUS
read_task_from_tareas() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"

    if [ ! -f "$tareas_file" ]; then
        echo -e "${RED}Error: $CFG_TAREAS_FILE not found at $tareas_file${NC}" >&2
        return 1
    fi

    # Find the line with the task ID (e.g., "- [ ] **F2-03** ...")
    local task_line
    task_line=$(grep -n "\*\*${TASK_ID}\*\*" "$tareas_file" | head -1)

    if [ -z "$task_line" ]; then
        echo -e "${RED}Error: Task ${TASK_ID} not found in $CFG_TAREAS_FILE${NC}" >&2
        return 1
    fi

    local line_num
    line_num=$(echo "$task_line" | cut -d: -f1)
    local line_content
    line_content=$(echo "$task_line" | cut -d: -f2-)

    # Extract status: [ ], [~], [x], [-]
    TASK_STATUS=$(echo "$line_content" | grep -oE '\[([ ~x-])\]' | head -1 | tr -d '[]')

    # Extract title: everything after **F2-03** up to the effort estimate or end of line
    TASK_TITLE=$(echo "$line_content" | sed -E 's/.*\*\*F[0-9]-[0-9]+\*\*[[:space:]]*//' | sed -E 's/\([0-9]+h\).*//' | sed 's/[[:space:]]*$//')

    # Extract effort: (Nh) pattern
    TASK_EFFORT=$(echo "$line_content" | grep -oE '\([0-9]+h\)' | head -1 | tr -d '()')

    # Extract description: indented lines following the task line until next task or section
    local desc_start=$((line_num + 1))
    TASK_DESCRIPTION=$(awk -v start="$desc_start" '
        NR >= start {
            if (/^- \[/ || /^### / || /^## /) exit
            if (/^[[:space:]]/) print
        }
    ' "$tareas_file")

    # Extract dependencies: lines matching "Dependencies:" or "Depends on:" in description
    TASK_DEPENDENCIES=$(echo "$TASK_DESCRIPTION" | grep -iE '(dependenc|depends on|requires):' | sed -E 's/.*(F[0-9]-[0-9]+)/\1/g' | grep -oE 'F[0-9]-[0-9]+' | tr '\n' ' ')

    log "Task loaded: ${TASK_ID} — ${TASK_TITLE} (${TASK_EFFORT:-?h}, status=${TASK_STATUS})"
}

# ── Check dependencies ─────────────────────────────────
check_dependencies() {
    if [ -z "$TASK_DEPENDENCIES" ]; then
        log "No dependencies to check"
        return 0
    fi

    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    local failed=false

    for dep in $TASK_DEPENDENCIES; do
        local dep_status
        dep_status=$(grep "\*\*${dep}\*\*" "$tareas_file" | grep -oE '\[([ ~x-])\]' | head -1 | tr -d '[]')
        if [ "$dep_status" != "x" ]; then
            log "${RED}Dependency ${dep} is not completed (status: [${dep_status:-?}])${NC}"
            failed=true
        fi
    done

    if [ "$failed" = "true" ]; then
        echo -e "${RED}Error: Not all dependencies are completed. Cannot start ${TASK_ID}.${NC}" >&2
        return 1
    fi

    log "All dependencies satisfied"
}

# ── Mark task in-progress ──────────────────────────────
mark_task_in_progress() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    sed -i '' "s/\- \[ \] \*\*${TASK_ID}\*\*/- [~] **${TASK_ID}**/" "$tareas_file"
    git add "$tareas_file"
    git commit -m "chore: mark ${TASK_ID} as in-progress"
    log "Marked ${TASK_ID} as [~] in-progress"
}

# ── Mark task complete ─────────────────────────────────
mark_task_complete() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    sed -i '' "s/\- \[~\] \*\*${TASK_ID}\*\*/- [x] **${TASK_ID}**/" "$tareas_file"
    log "Marked ${TASK_ID} as [x] complete"
}

# ── Derive branch name ─────────────────────────────────
derive_branch_name() {
    # Slugify title: lowercase, replace spaces/special chars with hyphens, trim
    local slug
    slug=$(echo "$TASK_TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-|-$//g' | cut -c1-40)
    RUN_ID="${TASK_ID}-${slug}"
    RUN_BRANCH="${CFG_BRANCH_PREFIX}${RUN_ID}"
}

# ── Build task context for agent prompts ───────────────
build_task_context() {
    local context=""
    context="## Task: ${TASK_ID} — ${TASK_TITLE}"
    context="${context}
Effort: ${TASK_EFFORT:-unknown}"

    if [ -n "$TASK_DESCRIPTION" ]; then
        context="${context}

## Task Description (from TAREAS.md)
${TASK_DESCRIPTION}"
    fi

    if [ -n "$TASK_DEPENDENCIES" ]; then
        context="${context}

## Dependencies (already implemented)
${TASK_DEPENDENCIES}"
    fi

    # Try to find relevant section in PLAN_MAESTRO.md
    local plan_file="$SCRIPT_DIR/$CFG_PLAN_MAESTRO_FILE"
    if [ -f "$plan_file" ]; then
        local plan_section
        plan_section=$(awk -v id="$TASK_ID" '
            $0 ~ id { found=1 }
            found && /^##/ && !first { first=1; print; next }
            found && first && /^##/ { exit }
            found && first { print }
        ' "$plan_file")
        if [ -n "$plan_section" ]; then
            context="${context}

## Relevant Architecture (from PLAN_MAESTRO.md)
${plan_section}"
        fi
    fi

    TASK_CONTEXT="$context"
}

# ── Load task (main entry point) ───────────────────────
# Called from minion.sh after config is loaded.
# Sets TASK_CONTEXT for blueprint prompts.
load_task() {
    TASK_CONTEXT=""
    if parse_task_id; then
        read_task_from_tareas || return 1
        check_dependencies || return 1
        derive_branch_name
        build_task_context
        # Override TASK with the full title for display
        TASK_DISPLAY="${TASK_ID} — ${TASK_TITLE}"
    else
        TASK_DISPLAY="$TASK"
        TASK_CONTEXT="## Task
${TASK}"
    fi
}
