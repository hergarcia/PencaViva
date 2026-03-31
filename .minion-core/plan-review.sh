# .minion-core/plan-review.sh — Iterative plan + review loop

run_plan_review() {
    local iteration=0
    local plan_approved=false
    local _PLAN_PROMPT_OVERRIDE=""
    local _ORIGINAL_PLAN_PROMPT=""
    local prev_plan_hash=""
    local prev_review_hash=""
    _ORIGINAL_PLAN_PROMPT=$(plan_prompt)

    while [ $iteration -lt $CFG_MAX_PLAN_ITERATIONS ]; do
        iteration=$((iteration + 1))
        step "2.$iteration Plan (iteration $iteration/$CFG_MAX_PLAN_ITERATIONS)"

        # ── Generate plan ───────────────────────────────────────
        timer_start
        local plan_prompt_text
        if [ -n "$_PLAN_PROMPT_OVERRIDE" ]; then
            plan_prompt_text="$_PLAN_PROMPT_OVERRIDE"
        else
            plan_prompt_text=$(plan_prompt)
        fi

        log "Generating plan..."
        if ! run_agent "$plan_prompt_text" "$CFG_PLAN_MODEL" "$CFG_PLAN_EFFORT" "$CFG_PLAN_TOOLS" "$CFG_MAX_TURNS_PLAN" "$RUN_PLAN_FILE"; then
            log "ERROR: Planner failed"
            return 1
        fi

        timer_end "plan_iteration_${iteration}"

        # ── Guard: plan must have content ──────────────────────
        if [ ! -s "$RUN_PLAN_FILE" ]; then
            log "${RED}ERROR: Planner produced an empty plan.${NC}"
            echo "plan_empty_at_iteration=${iteration}" >> "$RUN_METRICS"
            return 1
        fi

        # ── Detect stalled planner (identical plan to previous) ──
        local current_plan_hash
        current_plan_hash=$(compute_hash < "$RUN_PLAN_FILE")
        if [ -n "$prev_plan_hash" ] && [ "$current_plan_hash" = "$prev_plan_hash" ]; then
            log "${YELLOW}Identical plan to previous — planner made no progress.${NC}"
            echo "plan_stalled_at_iteration=${iteration}" >> "$RUN_METRICS"
            if [ $iteration -lt $CFG_MAX_PLAN_ITERATIONS ]; then
                log "${YELLOW}Escalating planner to ${CFG_PLAN_ESCALATION_MODEL}.${NC}"
                CFG_PLAN_MODEL="$CFG_PLAN_ESCALATION_MODEL"
                CFG_PLAN_EFFORT="$CFG_PLAN_ESCALATION_EFFORT"
            fi
        fi
        prev_plan_hash="$current_plan_hash"

        # ── Review plan ─────────────────────────────────────────
        step "2.$iteration Review"
        timer_start

        local review_criteria_text=""
        if declare -f review_criteria > /dev/null 2>&1; then
            review_criteria_text=$(review_criteria)
        fi

        local review_prompt
        review_prompt=$(cat <<EOF
## Reviewer Task
Evaluate this implementation plan. Your job is to verify the plan
is complete, correct, and followable by a code agent.

## Plan to Review
$(cat "$RUN_PLAN_FILE")

## Original Task
${TASK_DISPLAY}

## Project Rules
${CFG_EFFECTIVE_RULES}

${review_criteria_text:+## Additional Criteria
$review_criteria_text
}
## Response Format
Respond with:
1. List of issues found (if any)
2. Concrete improvement suggestions
3. A final line with exact format: SCORE: N/10

Where N is a number from 1 to 10:
- 8-10: Plan approved, ready to execute
- 5-7: Needs improvements, iterate
- 1-4: Plan fundamentally incorrect
EOF
        )

        log "Reviewing plan..."
        if ! run_agent "$review_prompt" "$CFG_REVIEW_MODEL" "$CFG_REVIEW_EFFORT" "$CFG_REVIEW_TOOLS" "$CFG_MAX_TURNS_REVIEW" "$RUN_REVIEW_FILE"; then
            log "ERROR: Reviewer failed"
            return 1
        fi

        timer_end "review_iteration_${iteration}"

        # ── Parse score ──
        local score
        score=$(grep -ioE 'SCORE:[[:space:]]*[0-9]+([[:space:]]*/[[:space:]]*10)?' "$RUN_REVIEW_FILE" | tail -1 | grep -oE '[0-9]+' | head -1)
        score=$((10#${score:-0}))
        if [ "$score" -lt 1 ] || [ "$score" -gt 10 ]; then
            log "${YELLOW}Warning: Invalid or unparsed score ($score). Assuming 7.${NC}"
            score=7
        fi

        log "Score: $score/10 (minimum: $CFG_MIN_REVIEW_SCORE)"
        echo "plan_score_iter_${iteration}=${score}" >> "$RUN_METRICS"

        # ── Detect stalled reviewer ──
        local current_review_hash
        current_review_hash=$(compute_hash < "$RUN_REVIEW_FILE")
        if [ -n "$prev_review_hash" ] && [ "$current_review_hash" = "$prev_review_hash" ]; then
            log "${YELLOW}Identical review to previous — reviewer made no progress.${NC}"
            echo "review_stalled_at_iteration=${iteration}" >> "$RUN_METRICS"
            log "${YELLOW}Escalating reviewer to ${CFG_REVIEW_ESCALATION_MODEL}.${NC}"
            CFG_REVIEW_MODEL="$CFG_REVIEW_ESCALATION_MODEL"
            CFG_REVIEW_EFFORT="$CFG_REVIEW_ESCALATION_EFFORT"
        fi
        prev_review_hash="$current_review_hash"

        if [ "$score" -ge "$CFG_MIN_REVIEW_SCORE" ]; then
            plan_approved=true
            log "${GREEN}Plan approved at iteration $iteration${NC}"
            break
        fi

        if [ $iteration -lt $CFG_MAX_PLAN_ITERATIONS ]; then
            log "${YELLOW}Low score ($score). Iterating with feedback...${NC}"

            local feedback
            feedback=$(cat "$RUN_REVIEW_FILE")
            local refined_prompt
            refined_prompt=$(cat <<EOF
## Original Blueprint Instructions
${_ORIGINAL_PLAN_PROMPT}

## Previous Plan (needs improvements)
$(cat "$RUN_PLAN_FILE")

## Reviewer Feedback (score: $score/10)
${feedback}

## Instructions
Improve the plan based on the reviewer feedback.
Keep what works from the previous plan, fix the mentioned issues.
Follow the original blueprint instructions.

## Output Format
Structured markdown. Exact file paths and concrete names.
EOF
            )

            _PLAN_PROMPT_OVERRIDE="$refined_prompt"
        fi
    done

    echo "plan_iterations=${iteration}" >> "$RUN_METRICS"
    echo "plan_approved=${plan_approved}" >> "$RUN_METRICS"

    if [ "$plan_approved" = "true" ]; then
        save_plan_to_repo "true"
    else
        log "${YELLOW}Warning: Plan did not reach minimum score after $iteration iterations.${NC}"
        save_plan_to_repo "false"
        return 1
    fi
}

save_plan_to_repo() {
    local approved_status="${1:-unknown}"
    local plans_dir="$SCRIPT_DIR/.minion-plans"
    mkdir -p "$plans_dir"
    local plan_dest="$plans_dir/${RUN_ID}-plan.md"
    {
        echo "<!-- minion:blueprint=${BLUEPRINT} -->"
        echo "<!-- minion:task=${TASK_DISPLAY} -->"
        echo "<!-- minion:approved=${approved_status} -->"
        echo ""
        cat "$RUN_PLAN_FILE"
    } > "$plan_dest"
    log "Plan saved to: $plan_dest"
}

dry_run_exit() {
    local saved_plan="$SCRIPT_DIR/.minion-plans/${RUN_ID}-plan.md"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${GREEN}  DRY RUN COMPLETE${NC}"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Plan: ${CYAN}${saved_plan}${NC}"
    echo -e "  Log:  ${CYAN}${RUN_LOG}${NC}"
    echo ""
    echo -e "  ${BOLD}To execute:${NC}"
    echo -e "  ${GREEN}./minion.sh --from-plan ${saved_plan}${NC}"
    echo ""
    echo -e "  ${YELLOW}Note: execution will create a new branch from ${CFG_BASE_BRANCH}.${NC}"
    echo ""
    exit 0
}
