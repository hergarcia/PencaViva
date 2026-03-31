# .minion-core/execution.sh — Phase 3: Execute blueprint via agent

run_execution() {
    step "3. Execution"
    timer_start

    local prompt
    prompt=$(execute_prompt)
    if ! run_agent "$prompt" "$CFG_BLUEPRINT_MODEL" "$CFG_BLUEPRINT_EFFORT" "$CFG_DEFAULT_TOOLS" "$CFG_MAX_TURNS_IMPL"; then
        log "${RED}Execution agent failed.${NC}"
        echo "execution_agent_failed=true" >> "$RUN_METRICS"
    else
        echo "execution_agent_failed=false" >> "$RUN_METRICS"
    fi
    timer_end "execution"

    # Check if agent produced any changes
    if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
        # Also check if any commits were made on branch (per-subtask commits)
        local commit_count
        commit_count=$(git rev-list "$CFG_BASE_BRANCH"..HEAD --count 2>/dev/null || echo "0")
        # Subtract 1 for the task-in-progress commit if it exists
        [ -n "${TASK_ID:-}" ] && commit_count=$((commit_count - 1))
        if [ "$commit_count" -le 0 ]; then
            log "${YELLOW}No changes detected. Nothing to validate.${NC}"
            echo "agent_produced_changes=false" >> "$RUN_METRICS"
            return 1
        fi
    fi
    echo "agent_produced_changes=true" >> "$RUN_METRICS"
}
