# .minion-core/review.sh — Post-execution code review agent

run_code_review() {
    if [ "$SKIP_REVIEW" = "true" ]; then
        log "Skipping code review (--skip-review)"
        echo "code_review=skipped" >> "$RUN_METRICS"
        return 0
    fi

    step "5. Code Review"
    timer_start

    local diff
    diff=$(git diff "$CFG_BASE_BRANCH"...HEAD)

    if [ -z "$diff" ]; then
        log "No changes to review"
        echo "code_review=no_changes" >> "$RUN_METRICS"
        timer_end "code_review"
        return 0
    fi

    local review_output="$RUN_TEMP_DIR/code_review.md"
    local review_prompt
    review_prompt=$(cat <<EOF
## Code Review Task
Review all changes on this branch against the base branch.

## Task Context
${TASK_DISPLAY}

## Diff to Review
\`\`\`diff
${diff}
\`\`\`

## Review Criteria
1. **Correctness**: Does the code fulfill the task requirements?
2. **Patterns**: Does it follow existing project conventions (read CLAUDE.md)?
3. **Edge cases**: Error handling, empty states, loading states, null checks
4. **Test coverage**: Are the important code paths tested?
5. **Security**: Any obvious security issues (exposed secrets, SQL injection, missing auth)?

## Project Rules
${CFG_EFFECTIVE_RULES}

## Response Format
1. List of issues found, categorized by severity (critical/high/medium/low)
2. List of positive aspects (good patterns followed)
3. A final line with exact format: SCORE: N/10

Where N is a number from 1 to 10:
- 8-10: Excellent, ship it
- 7: Acceptable, minor issues
- 5-6: Needs fixes before shipping
- 1-4: Significant problems
EOF
    )

    log "Running code review..."
    if ! run_agent "$review_prompt" "$CFG_CODE_REVIEW_MODEL" "$CFG_CODE_REVIEW_EFFORT" "$CFG_CODE_REVIEW_TOOLS" "$CFG_MAX_TURNS_CODE_REVIEW" "$review_output"; then
        log "${YELLOW}Warning: Code review agent failed. Continuing.${NC}"
        echo "code_review=agent_failed" >> "$RUN_METRICS"
        timer_end "code_review"
        return 0
    fi

    # Parse score
    local score
    score=$(grep -ioE 'SCORE:[[:space:]]*[0-9]+([[:space:]]*/[[:space:]]*10)?' "$review_output" | tail -1 | grep -oE '[0-9]+' | head -1)
    score=$((10#${score:-0}))
    if [ "$score" -lt 1 ] || [ "$score" -gt 10 ]; then
        score=7
    fi

    log "Code review score: $score/10 (minimum: $CFG_MIN_CODE_REVIEW_SCORE)"
    echo "code_review_score=${score}" >> "$RUN_METRICS"

    # Log review content
    cat "$review_output" >> "$RUN_LOG"

    # If score is low, run one fix round
    if [ "$score" -lt "$CFG_MIN_CODE_REVIEW_SCORE" ]; then
        log "${YELLOW}Code review score below threshold. Running fix round...${NC}"
        local fix_prompt
        fix_prompt="## Code Review Fix
The code review found issues that need to be addressed.

## Review Findings
$(cat "$review_output")

## Instructions
1. Address the critical and high severity issues identified in the review.
2. Do not change code that the review marked as positive.
3. Stage and commit your fixes: git commit -m \"fix: address code review findings\"

## Project Rules
${CFG_EFFECTIVE_RULES}"

        if ! run_agent "$fix_prompt" "$CFG_FIX_MODEL" "$CFG_FIX_EFFORT" "$CFG_FIX_TOOLS" "$CFG_MAX_TURNS_FIX"; then
            log "${YELLOW}Warning: Code review fix agent failed.${NC}"
        fi
        echo "code_review_fix_applied=true" >> "$RUN_METRICS"
    fi

    timer_end "code_review"
}
