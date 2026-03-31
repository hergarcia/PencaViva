# .minion-core/agent.sh — Wrapper for claude -p

run_agent() {
    local prompt="$1"
    local model="${2:-$CFG_BLUEPRINT_MODEL}"
    local effort="${3:-$CFG_BLUEPRINT_EFFORT}"
    local tools="${4:-$CFG_DEFAULT_TOOLS}"
    local max_turns="${5:-$CFG_MAX_TURNS_IMPL}"
    local output_file="${6:-}"

    log "Agent: model=$model effort=$effort max_turns=$max_turns"

    local agent_output="$RUN_TEMP_DIR/agent_output.log"
    local agent_stderr="$RUN_TEMP_DIR/agent_stderr.log"
    claude -p "$prompt" \
        --model "$model" \
        --effort "$effort" \
        --max-turns "$max_turns" \
        --allowedTools "$tools" \
        > "$agent_output" 2>"$agent_stderr"
    local exit_code=$?

    cat "$agent_output" >> "$RUN_LOG"
    if [ -s "$agent_stderr" ]; then
        cat "$agent_stderr" >> "$RUN_LOG"
    fi

    if [ -n "$output_file" ]; then
        cp "$agent_output" "$output_file"
    else
        cat "$agent_output"
    fi

    # Detect max_turns even when claude returns exit 0
    if [ -s "$agent_stderr" ] && grep -q "Reached max turns" "$agent_stderr"; then
        log "${YELLOW}Warning: Agent reached max_turns ($max_turns).${NC}"
        echo "agent_max_turns_hit=true" >> "$RUN_METRICS"
        return 1
    fi

    if [ $exit_code -ne 0 ]; then
        log "ERROR: claude -p failed with code $exit_code"
        return $exit_code
    fi
}
