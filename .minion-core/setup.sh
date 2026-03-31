# .minion-core/setup.sh — Branch creation + dependency install

run_setup() {
    if [ "$DRY_RUN" = "true" ]; then return; fi

    step "1. Setup"
    timer_start

    # Fetch latest base branch (tolerate offline)
    log "Fetching $CFG_BASE_BRANCH..."
    if ! git fetch origin "$CFG_BASE_BRANCH" 2>&1 | tee -a "$RUN_LOG"; then
        log "${YELLOW}Warning: git fetch failed (offline?). Using local $CFG_BASE_BRANCH.${NC}"
    fi

    # Check branch doesn't already exist
    if git show-ref --verify --quiet "refs/heads/$RUN_BRANCH" 2>/dev/null; then
        log "${RED}Error: Branch '$RUN_BRANCH' already exists. Delete it or use another name.${NC}"
        return 1
    fi

    log "Creating branch $RUN_BRANCH from $CFG_BASE_BRANCH..."
    if ! git checkout -b "$RUN_BRANCH" "$CFG_BASE_BRANCH" 2>&1 | tee -a "$RUN_LOG"; then
        log "${RED}Error: Could not create branch. Verify '$CFG_BASE_BRANCH' exists.${NC}"
        return 1
    fi

    # Mark task in-progress (on the new branch)
    if [ -n "$TASK_ID" ]; then
        mark_task_in_progress
    fi

    if [ -n "$CFG_CMD_INSTALL" ]; then
        log "Installing dependencies..."
        eval "$CFG_CMD_INSTALL" 2>&1 | tee -a "$RUN_LOG"
    fi

    timer_end "setup"
}
