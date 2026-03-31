# .minion-core/result.sh — Doc commit, banner, metrics summary

run_result() {
    echo "end_time=$(date +%s)" >> "$RUN_METRICS"

    if [ "$RUN_SUCCESS" = "true" ]; then
        # ── Fallback: commit any uncommitted changes ────────────
        if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
            log "Found uncommitted changes — creating fallback commit..."
            git add -A
            git reset HEAD -- .minion-logs/ .minion-plans/ 2>/dev/null || true
            if ! git diff --cached --quiet; then
                git commit -m "feat(minion): uncommitted changes from ${TASK_DISPLAY}" 2>&1 | tee -a "$RUN_LOG"
            fi
        fi

        # ── Mark task complete + doc update ─────────────────────
        if [ -n "${TASK_ID:-}" ]; then
            mark_task_complete
            git add "$CFG_TAREAS_FILE"
            git commit -m "docs: mark ${TASK_ID} as complete in TAREAS.md" 2>&1 | tee -a "$RUN_LOG"
            echo "task_marked_complete=true" >> "$RUN_METRICS"
        fi
        echo "git_committed=true" >> "$RUN_METRICS"

        # ── Success Banner ──────────────────────────────────────
        echo ""
        echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}${GREEN}  MINION COMPLETE — SUCCESS${NC}"
        echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "  Project:   ${CYAN}${CFG_PROJECT_NAME}${NC}"
        echo -e "  Blueprint: ${CYAN}${BLUEPRINT}${NC}"
        echo -e "  Task:      ${CYAN}${TASK_DISPLAY}${NC}"
        [ "$DRY_RUN" != "true" ] && echo -e "  Branch:    ${CYAN}${RUN_BRANCH}${NC}"
        echo ""
    else
        echo "git_committed=false" >> "$RUN_METRICS"

        echo ""
        echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}${RED}  MINION COMPLETE — WITH ERRORS${NC}"
        echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "  Project:   ${CYAN}${CFG_PROJECT_NAME}${NC}"
        echo -e "  Blueprint: ${CYAN}${BLUEPRINT}${NC}"
        echo -e "  Task:      ${CYAN}${TASK_DISPLAY}${NC}"
        [ "$DRY_RUN" != "true" ] && echo -e "  Branch:    ${CYAN}${RUN_BRANCH}${NC}"
        echo ""
        echo -e "  ${YELLOW}Validation failed. Review the log and fix manually.${NC}"
        echo ""
    fi

    # ── Metrics summary ─────────────────────────────────────────
    echo -e "${BOLD}Metrics:${NC}"
    while IFS='=' read -r key value; do
        [ -z "$key" ] && continue
        echo -e "  ${key}=${value}"
    done < "$RUN_METRICS"
    echo ""

    echo -e "  Full log: ${CYAN}${RUN_LOG}${NC}"
    echo -e "  Metrics:  ${CYAN}${RUN_METRICS}${NC}"
    echo ""

    if [ "$RUN_SUCCESS" = "true" ]; then
        echo -e "  ${BOLD}Next step:${NC}"
        echo -e "  ${GREEN}git push -u origin ${RUN_BRANCH}${NC}"
        echo ""
    fi
}
