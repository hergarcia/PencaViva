# .minion-core/loader.sh — Load and validate blueprint

KNOWN_FUNCTIONS="plan_prompt execute_prompt fix_prompt review_criteria"

load_blueprint() {
    local blueprint="$1"
    local bp_file="$BLUEPRINTS_DIR/${blueprint}.sh"

    if [ ! -f "$bp_file" ]; then
        echo -e "${RED}Error: Blueprint '$blueprint' not found.${NC}" >&2
        echo "Expected file: $bp_file" >&2
        echo "Use --list to see available blueprints." >&2
        exit 1
    fi

    local funcs_before
    funcs_before=$(declare -F | sed 's/declare -f //' | sort)

    log "Loading blueprint: $bp_file"
    source "$bp_file"

    if [ -z "${BLUEPRINT_TYPE:-}" ]; then
        echo -e "${RED}Error: Blueprint '$blueprint' does not define BLUEPRINT_TYPE.${NC}" >&2
        exit 1
    fi

    if [ "$BLUEPRINT_TYPE" != "plan" ] && [ "$BLUEPRINT_TYPE" != "direct" ]; then
        echo -e "${RED}Error: BLUEPRINT_TYPE must be 'plan' or 'direct', got '$BLUEPRINT_TYPE'.${NC}" >&2
        exit 1
    fi

    if ! declare -f execute_prompt > /dev/null 2>&1; then
        echo -e "${RED}Error: Blueprint '$blueprint' does not define execute_prompt().${NC}" >&2
        exit 1
    fi

    if [ "$BLUEPRINT_TYPE" = "plan" ]; then
        if ! declare -f plan_prompt > /dev/null 2>&1; then
            echo -e "${RED}Error: Plan blueprint requires plan_prompt(), but '$blueprint' does not define it.${NC}" >&2
            exit 1
        fi
    fi

    local funcs_after
    funcs_after=$(declare -F | sed 's/declare -f //' | sort)
    local new_funcs
    new_funcs=$(comm -13 <(echo "$funcs_before") <(echo "$funcs_after"))

    for func in $new_funcs; do
        local is_known=false
        for known in $KNOWN_FUNCTIONS; do
            if [ "$func" = "$known" ]; then
                is_known=true
                break
            fi
        done
        if [ "$is_known" = "false" ]; then
            echo -e "${YELLOW}Warning: Unknown function '$func' in blueprint '$blueprint'. Possible typo?${NC}" >&2
        fi
    done

    log "Blueprint validated: type=$BLUEPRINT_TYPE"
}
