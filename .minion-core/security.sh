# .minion-core/security.sh — Post-execution security audit agent

run_security_check() {
    if [ "$SKIP_REVIEW" = "true" ]; then
        log "Skipping security check (--skip-review)"
        echo "security_check=skipped" >> "$RUN_METRICS"
        return 0
    fi

    step "6. Security Check"
    timer_start

    local diff
    diff=$(git diff "$CFG_BASE_BRANCH"...HEAD)

    if [ -z "$diff" ]; then
        log "No changes to audit"
        echo "security_check=no_changes" >> "$RUN_METRICS"
        timer_end "security_check"
        return 0
    fi

    local security_output="$RUN_TEMP_DIR/security.md"
    local security_prompt
    security_prompt=$(cat <<EOF
## Security Audit Task
Audit all changes on this branch for security vulnerabilities.
This is a React Native + Expo app using Supabase (PostgreSQL + RLS).

## Task Context
${TASK_DISPLAY}

## Diff to Audit
\`\`\`diff
${diff}
\`\`\`

## Security Checklist
1. **RLS Policy Gaps**: Are Supabase queries accessing data without proper RLS policies?
2. **Exposed Secrets**: Are API keys, tokens, or credentials hardcoded in source code?
3. **SQL Injection**: Are there raw SQL queries with unsanitized user input?
4. **Auth Guards**: Are sensitive operations protected by authentication checks?
5. **Service Role Key**: Is the Supabase service role key used in client-side code? (Must ONLY be in Edge Functions)
6. **XSS Vectors**: Are user inputs rendered without sanitization in components?
7. **Insecure Storage**: Are sensitive values stored in AsyncStorage instead of SecureStore?
8. **Permission Checks**: Are group membership checks enforced before data access?

## Response Format
List each finding with:
- Description of the vulnerability
- File and approximate location
- Suggested fix
- Severity: CRITICAL / HIGH / MEDIUM / LOW

End with a summary line in exact format: SEVERITY: <highest_level>
Where <highest_level> is one of: none, low, medium, high, critical

If no issues found, respond with: SEVERITY: none
EOF
    )

    log "Running security audit..."
    if ! run_agent "$security_prompt" "$CFG_SECURITY_MODEL" "$CFG_SECURITY_EFFORT" "$CFG_SECURITY_TOOLS" "$CFG_MAX_TURNS_SECURITY" "$security_output"; then
        log "${YELLOW}Warning: Security agent failed. Continuing.${NC}"
        echo "security_check=agent_failed" >> "$RUN_METRICS"
        timer_end "security_check"
        return 0
    fi

    # Parse severity
    local severity
    severity=$(grep -ioE 'SEVERITY:[[:space:]]*(none|low|medium|high|critical)' "$security_output" | tail -1 | awk -F: '{print $2}' | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    severity="${severity:-none}"

    log "Security audit result: $severity"
    echo "security_severity=${severity}" >> "$RUN_METRICS"

    # Log findings
    cat "$security_output" >> "$RUN_LOG"

    # Abort on critical
    if [ "$severity" = "critical" ]; then
        log "${RED}CRITICAL security vulnerability found. Aborting.${NC}"
        log "${RED}Review the findings in the log and fix manually.${NC}"
        echo "security_check=critical_abort" >> "$RUN_METRICS"
        RUN_SUCCESS=false
        timer_end "security_check"
        return 1
    fi

    if [ "$severity" = "high" ] || [ "$severity" = "medium" ]; then
        log "${YELLOW}Security warnings found (${severity}). Review the log before pushing.${NC}"
    fi

    timer_end "security_check"
}
