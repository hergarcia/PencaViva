# .minion-core/validation.sh — Lint, typecheck, test loop with agent fix

run_validation() {
    local attempt=0
    local max_rounds=$((CFG_MAX_FIX_ATTEMPTS + 1))
    RUN_SUCCESS=false
    local check_log="$RUN_TEMP_DIR/check.log"
    local prev_error_hash=""

    while [ $attempt -lt $max_rounds ]; do
        attempt=$((attempt + 1))
        step "4.${attempt}a Check (deterministic) — attempt $attempt/$max_rounds"
        timer_start

        run_cmd_if_set "Format" "$CFG_CMD_FORMAT" || true

        local errors=""

        # Lint
        if [ -n "$CFG_CMD_LINT" ]; then
            log "-> Lint"
            if ! eval "$CFG_CMD_LINT" > "$check_log" 2>&1; then
                cat "$check_log" >> "$RUN_LOG"
                errors="${errors}LINT ERRORS:
$(tail -30 "$check_log" | strip_ansi)

"
                log "x Lint failed"
            else
                cat "$check_log" >> "$RUN_LOG"
            fi
        fi

        # Typecheck
        if [ -n "$CFG_CMD_TYPECHECK" ]; then
            log "-> Typecheck"
            if ! eval "$CFG_CMD_TYPECHECK" > "$check_log" 2>&1; then
                cat "$check_log" >> "$RUN_LOG"
                errors="${errors}TYPECHECK ERRORS:
$(tail -40 "$check_log" | strip_ansi)

"
                log "x Typecheck failed"
            else
                cat "$check_log" >> "$RUN_LOG"
            fi
        fi

        # Tests
        if [ -n "$CFG_CMD_TEST" ]; then
            log "-> Tests"
            if ! eval "$CFG_CMD_TEST" > "$check_log" 2>&1; then
                cat "$check_log" >> "$RUN_LOG"
                local test_summary
                test_summary=$(summarize_test_errors "$check_log")
                if [ -n "$test_summary" ]; then
                    errors="${errors}TEST FAILURES (summary):
${test_summary}

"
                else
                    errors="${errors}TEST FAILURES:
$(tail -40 "$check_log" | strip_ansi)

"
                fi
                log "x Tests failed"
            else
                cat "$check_log" >> "$RUN_LOG"
            fi
        fi

        timer_end "validation_attempt_${attempt}"

        if [ -z "$errors" ]; then
            RUN_SUCCESS=true
            break
        fi

        log "Errors found in attempt $attempt:"
        log "$errors"

        # ── Detect repeated errors ──
        local current_error_hash
        current_error_hash=$(echo "$errors" | compute_hash)

        if [ "$current_error_hash" = "$prev_error_hash" ]; then
            log "${YELLOW}Errors identical to previous attempt — fix had no effect.${NC}"
            echo "fix_stalled_at_attempt=${attempt}" >> "$RUN_METRICS"

            if [ $attempt -lt $max_rounds ]; then
                log "${YELLOW}Escalating to ${CFG_FIX_ESCALATION_MODEL} for next attempt.${NC}"
                CFG_FIX_MODEL="$CFG_FIX_ESCALATION_MODEL"
                CFG_FIX_EFFORT="$CFG_FIX_ESCALATION_EFFORT"
            fi
        fi
        prev_error_hash="$current_error_hash"

        if [ $attempt -lt $max_rounds ]; then
            step "4.${attempt}b Fix (agent) — model=$CFG_FIX_MODEL"
            timer_start

            local fix_prompt_text
            if declare -f fix_prompt > /dev/null 2>&1; then
                fix_prompt_text=$(fix_prompt "$errors")
            else
                fix_prompt_text="## Context
Project: ${CFG_PROJECT_NAME}
Original task: ${TASK_DISPLAY}

## Errors to Fix
\`\`\`
${errors}
\`\`\`

## Instructions
1. Read the test and implementation files mentioned in the errors.
2. Diagnose the root cause — do not attempt blind fixes.
3. Fix the implementation. Only modify tests if the test has a clear bug.
4. Run the failing tests to verify the fix before finishing.
5. Stage and commit your fixes: git commit -m \"fix: resolve validation errors\"

## Project Rules
${CFG_EFFECTIVE_RULES}"
            fi

            if ! run_agent "$fix_prompt_text" "$CFG_FIX_MODEL" "$CFG_FIX_EFFORT" "$CFG_FIX_TOOLS" "$CFG_MAX_TURNS_FIX"; then
                log "${YELLOW}Warning: Fix agent failed. Continuing to next attempt.${NC}"
            fi
            timer_end "fix_agent_attempt_${attempt}"
            run_cmd_if_set "Format post-fix" "$CFG_CMD_FORMAT" || true
        fi
    done

    echo "validation_attempts=${attempt}" >> "$RUN_METRICS"
    echo "validation_passed=${RUN_SUCCESS}" >> "$RUN_METRICS"
}
