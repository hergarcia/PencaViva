# .minion-core/config.sh — Load config from .minion.yml

# Helper to read a yq path, return empty string if missing
cfg() {
    local path="$1"
    local val
    val=$(yq eval "$path // \"\"" "$CONFIG_FILE" 2>/dev/null)
    [ "$val" = "null" ] && val=""
    echo "$val"
}

# Helper with default: cfg_or <path> <default>
cfg_or() {
    local path="$1"
    local default="$2"
    local val
    val=$(cfg "$path")
    echo "${val:-$default}"
}

load_config() {
    local blueprint="$1"

    # Project
    CFG_PROJECT_NAME=$(cfg_or '.project.name' 'unknown-project')
    CFG_PROJECT_DESCRIPTION=$(cfg_or '.project.description' '')

    # Commands
    CFG_CMD_INSTALL=$(cfg_or '.commands.install' 'npm ci')
    CFG_CMD_LINT=$(cfg_or '.commands.lint' '')
    CFG_CMD_FORMAT=$(cfg_or '.commands.format' '')
    CFG_CMD_TYPECHECK=$(cfg_or '.commands.typecheck' '')
    CFG_CMD_TEST=$(cfg_or '.commands.test' '')

    # Agent settings
    CFG_MAX_FIX_ATTEMPTS=$(cfg_or '.agent.max_fix_attempts' '2')
    CFG_MAX_TURNS_IMPL=$(cfg_or '.agent.max_turns.implementation' '75')
    CFG_MAX_TURNS_PLAN=$(cfg_or '.agent.max_turns.plan' '15')
    CFG_MAX_TURNS_REVIEW=$(cfg_or '.agent.max_turns.review' '5')
    CFG_MAX_TURNS_FIX=$(cfg_or '.agent.max_turns.fix' '15')
    CFG_MAX_TURNS_CODE_REVIEW=$(cfg_or '.agent.max_turns.code_review' '5')
    CFG_MAX_TURNS_SECURITY=$(cfg_or '.agent.max_turns.security' '5')
    CFG_MIN_REVIEW_SCORE=$(cfg_or '.agent.min_review_score' '8')
    CFG_MAX_PLAN_ITERATIONS=$(cfg_or '.agent.max_plan_iterations' '3')
    CFG_MIN_CODE_REVIEW_SCORE=$(cfg_or '.agent.min_code_review_score' '7')

    # Tools
    CFG_DEFAULT_TOOLS=$(cfg_or '.agent.tools.default' 'Bash,Read,Write,Edit,Glob,Grep')
    CFG_PLAN_TOOLS=$(cfg_or '.agent.tools.plan' 'Read,Glob,Grep')
    CFG_REVIEW_TOOLS=$(cfg_or '.agent.tools.review' 'Read,Glob,Grep')
    CFG_FIX_TOOLS=$(cfg_or '.agent.tools.fix' 'Bash,Read,Write,Edit,Glob,Grep')
    CFG_CODE_REVIEW_TOOLS=$(cfg_or '.agent.tools.code_review' 'Read,Glob,Grep')
    CFG_SECURITY_TOOLS=$(cfg_or '.agent.tools.security' 'Read,Glob,Grep')

    # Blueprint-specific model/effort
    CFG_BLUEPRINT_MODEL=$(cfg_or ".blueprints.${blueprint}.model" 'sonnet')
    CFG_BLUEPRINT_EFFORT=$(cfg_or ".blueprints.${blueprint}.effort" 'high')
    CFG_PLAN_MODEL=$(cfg_or '.agent.plan_model' "$CFG_BLUEPRINT_MODEL")
    CFG_PLAN_EFFORT=$(cfg_or '.agent.plan_effort' "$CFG_BLUEPRINT_EFFORT")
    CFG_PLAN_ESCALATION_MODEL=$(cfg_or '.agent.plan_escalation_model' 'opus')
    CFG_PLAN_ESCALATION_EFFORT=$(cfg_or '.agent.plan_escalation_effort' 'high')
    CFG_FIX_MODEL=$(cfg_or '.agent.fix_model' 'sonnet')
    CFG_FIX_EFFORT=$(cfg_or '.agent.fix_effort' 'high')
    CFG_FIX_ESCALATION_MODEL=$(cfg_or '.agent.fix_escalation_model' 'opus')
    CFG_FIX_ESCALATION_EFFORT=$(cfg_or '.agent.fix_escalation_effort' 'high')
    CFG_REVIEW_MODEL=$(cfg_or '.agent.review_model' 'sonnet')
    CFG_REVIEW_EFFORT=$(cfg_or '.agent.review_effort' 'medium')
    CFG_REVIEW_ESCALATION_MODEL=$(cfg_or '.agent.review_escalation_model' 'opus')
    CFG_REVIEW_ESCALATION_EFFORT=$(cfg_or '.agent.review_escalation_effort' 'high')
    CFG_CODE_REVIEW_MODEL=$(cfg_or '.agent.code_review_model' 'sonnet')
    CFG_CODE_REVIEW_EFFORT=$(cfg_or '.agent.code_review_effort' 'medium')
    CFG_SECURITY_MODEL=$(cfg_or '.agent.security_model' 'sonnet')
    CFG_SECURITY_EFFORT=$(cfg_or '.agent.security_effort' 'medium')

    # Tareas
    CFG_TAREAS_FILE=$(cfg_or '.tareas.file' 'TAREAS.md')
    CFG_PLAN_MAESTRO_FILE=$(cfg_or '.tareas.plan_maestro' 'PLAN_MAESTRO.md')

    # Git
    CFG_BASE_BRANCH=$(cfg_or '.git.base_branch' 'develop')
    CFG_BRANCH_PREFIX=$(cfg_or '.git.prefix' 'minion/')

    # Context: global_rules + blueprint_rules
    CFG_GLOBAL_RULES=$(cfg '.context.global_rules')
    local blueprint_rules
    blueprint_rules=$(cfg ".context.blueprint_rules.${blueprint}")
    CFG_EFFECTIVE_RULES="$CFG_GLOBAL_RULES"
    if [ -n "$blueprint_rules" ]; then
        CFG_EFFECTIVE_RULES="${CFG_EFFECTIVE_RULES}
${blueprint_rules}"
    fi

    # Runtime variables
    # RUN_ID is set later by tareas.sh (task-aware) or here (fallback)
    if [ -z "${RUN_ID:-}" ]; then
        RUN_ID="${blueprint}-$(date +%Y%m%d-%H%M%S)"
    fi
    RUN_BRANCH="${CFG_BRANCH_PREFIX}${RUN_ID}"
    mkdir -p "$SCRIPT_DIR/.minion-logs"
    RUN_LOG="$SCRIPT_DIR/.minion-logs/${RUN_ID}.log"
    RUN_METRICS="$SCRIPT_DIR/.minion-logs/${RUN_ID}.metrics"
    touch "$RUN_LOG" "$RUN_METRICS"

    log "Config loaded: $CFG_PROJECT_NAME (blueprint=$blueprint)"
    echo "run_id=${RUN_ID}" >> "$RUN_METRICS"
    echo "blueprint=${blueprint}" >> "$RUN_METRICS"
    echo "start_time=$(date +%s)" >> "$RUN_METRICS"
}
