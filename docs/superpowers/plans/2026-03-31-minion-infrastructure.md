# Minion Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent shell orchestration system that automates PencaViva's development workflow, forked from casmer-mobile's Minion Runner v4.

**Architecture:** Shell scripts orchestrate `claude -p` CLI calls through a 7-phase pipeline (setup, plan+review, execute, validate, code review, security, result). Configuration lives in `.minion.yml` (YAML parsed by `yq`). Blueprints define task-specific prompt templates. A new `tareas.sh` module integrates with TAREAS.md for task state management.

**Tech Stack:** Bash 5+, `yq` (YAML parser), `claude` CLI (Claude Code), `gh` (GitHub CLI), `git`

**Spec:** `docs/superpowers/specs/2026-03-31-minion-infrastructure-design.md`

---

## File Structure

```
Files to create:
  .minion.yml                          # Project configuration
  minion.sh                            # Entry point orchestrator
  .minion-core/helpers.sh              # Colors, logging, timing, utilities
  .minion-core/cleanup.sh              # Temp dir + EXIT trap
  .minion-core/config.sh               # .minion.yml loader via yq
  .minion-core/loader.sh               # Blueprint validator
  .minion-core/agent.sh                # claude -p wrapper
  .minion-core/setup.sh                # Branch creation + npm ci
  .minion-core/plan-review.sh          # Iterative plan + review loop
  .minion-core/validation.sh           # Lint/typecheck/test + fix loop
  .minion-core/tareas.sh               # TAREAS.md parser + task state
  .minion-core/review.sh               # Code review agent phase
  .minion-core/security.sh             # Security audit agent phase
  .minion-core/result.sh               # Doc commit + banner + metrics
  .minion-blueprints/_template.sh      # Contract documentation
  .minion-blueprints/implement.sh      # Plan-based: feature implementation
  .minion-blueprints/fix-issue.sh      # Plan-based: bug diagnosis + fix
  .minion-blueprints/refactor.sh       # Plan-based: safe refactoring
  .minion-blueprints/add-tests.sh      # Direct: add tests
  .minion-blueprints/migrate.sh        # Direct: pattern/dep migration
  .minion-blueprints/update-deps.sh    # Direct: dependency updates

Files to modify:
  .gitignore                           # Add .minion-logs/ and .minion-plans/
```

---

### Task 1: Core Utilities — helpers.sh + cleanup.sh

**Files:**
- Create: `.minion-core/helpers.sh`
- Create: `.minion-core/cleanup.sh`

These are the foundation modules that all other modules depend on. Forked from casmer with English messages.

- [ ] **Step 1: Create `.minion-core/` directory**

```bash
mkdir -p .minion-core
```

- [ ] **Step 2: Write `.minion-core/helpers.sh`**

```bash
# .minion-core/helpers.sh — Colors, logging, timing, utilities

# ── Colors ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Logging ─────────────────────────────────────────
TIMER_START=0

log() {
    local msg="$1"
    local timestamp
    timestamp=$(date '+%H:%M:%S')
    echo -e "${BLUE}[${timestamp}]${NC} $msg"
    echo "[${timestamp}] $msg" >> "${RUN_LOG:-/dev/null}" 2>/dev/null || true
}

step() {
    local title="$1"
    echo ""
    echo -e "${BOLD}${PURPLE}━━━ $title ━━━${NC}"
    echo ""
    echo "━━━ $title ━━━" >> "${RUN_LOG:-/dev/null}" 2>/dev/null || true
}

timer_start() {
    TIMER_START=$(date +%s)
}

timer_end() {
    local label="$1"
    local end
    end=$(date +%s)
    local elapsed=$((end - TIMER_START))
    local mins=$((elapsed / 60))
    local secs=$((elapsed % 60))
    log "Time ($label): ${mins}m ${secs}s"
    echo "time_${label}=${elapsed}s" >> "${RUN_METRICS:-/dev/null}" 2>/dev/null || true
}

run_cmd_if_set() {
    local label="$1"
    local cmd="$2"
    if [ -n "$cmd" ]; then
        log "-> $label"
        eval "$cmd"
    fi
}

# Portable MD5 hash (works on Linux md5sum and macOS md5)
compute_hash() {
    if command -v md5sum >/dev/null 2>&1; then
        md5sum | cut -d' ' -f1
    else
        md5 -q
    fi
}

# Strip ANSI escape codes from text
strip_ansi() {
    sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'
}

# Extract a compact Jest error summary: failing test names + error messages,
# without the full rendered component trees that waste agent tokens.
summarize_test_errors() {
    local raw_log="$1"
    strip_ansi < "$raw_log" | awk '
    /^FAIL / { print; next }
    /●.*›/ && !/● Console/ { print; in_error=1; skip_tree=0; next }
    /● Console/ { next }

    in_error && /Unable to find|Expected:|Received:|expect\(/ {
        print
        skip_tree=1
        next
    }

    in_error && /^[[:space:]]+(>?)[[:space:]]+[0-9]+ \|/ {
        skip_tree=0
        print
        next
    }

    in_error && /at Object\.<anonymous>/ {
        print
        in_error=0
        skip_tree=0
        next
    }

    in_error && skip_tree { next }

    /^Test Suites:.*failed/ { print; next }
    /^Tests:.*failed/ { print; next }
    '
}
```

- [ ] **Step 3: Write `.minion-core/cleanup.sh`**

```bash
# .minion-core/cleanup.sh — Temp dir + trap EXIT handler

RUN_TEMP_DIR=$(mktemp -d)
RUN_PLAN_FILE="$RUN_TEMP_DIR/plan.md"
RUN_REVIEW_FILE="$RUN_TEMP_DIR/review.md"

cleanup() {
    rm -rf "$RUN_TEMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
```

- [ ] **Step 4: Verify helpers load without errors**

Run: `bash -n .minion-core/helpers.sh && bash -n .minion-core/cleanup.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add .minion-core/helpers.sh .minion-core/cleanup.sh
git commit -m "feat(minion): add core utilities — helpers.sh + cleanup.sh"
```

---

### Task 2: Configuration — config.sh + .minion.yml

**Files:**
- Create: `.minion-core/config.sh`
- Create: `.minion.yml`

- [ ] **Step 1: Write `.minion-core/config.sh`**

```bash
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
```

- [ ] **Step 2: Write `.minion.yml`**

The full PencaViva configuration as defined in the spec (Section 6: Configuration). Copy the YAML block from the spec exactly.

- [ ] **Step 3: Verify config loads correctly**

Run: `source .minion-core/helpers.sh && CONFIG_FILE=.minion.yml && source .minion-core/config.sh && load_config implement && echo "project=$CFG_PROJECT_NAME model=$CFG_BLUEPRINT_MODEL rules_length=${#CFG_EFFECTIVE_RULES}"`
Expected: `project=pencaviva model=opus rules_length=<non-zero number>`

- [ ] **Step 4: Commit**

```bash
git add .minion-core/config.sh .minion.yml
git commit -m "feat(minion): add config loader + PencaViva configuration"
```

---

### Task 3: Blueprint Loader — loader.sh

**Files:**
- Create: `.minion-core/loader.sh`

- [ ] **Step 1: Write `.minion-core/loader.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/loader.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/loader.sh
git commit -m "feat(minion): add blueprint loader with validation"
```

---

### Task 4: Agent Wrapper — agent.sh

**Files:**
- Create: `.minion-core/agent.sh`

- [ ] **Step 1: Write `.minion-core/agent.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/agent.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/agent.sh
git commit -m "feat(minion): add claude -p agent wrapper"
```

---

### Task 5: TAREAS.md Integration — tareas.sh

**Files:**
- Create: `.minion-core/tareas.sh`

This is the main new module. It parses TAREAS.md, checks dependencies, manages task state, and builds context for agent prompts.

- [ ] **Step 1: Write `.minion-core/tareas.sh`**

```bash
# .minion-core/tareas.sh — TAREAS.md parser + task state management

# ── Task ID detection ──────────────────────────────────
# Returns 0 if $TASK matches F{digit}-{digits} pattern, sets TASK_ID.
# Returns 1 otherwise (free-form fallback).
parse_task_id() {
    if [[ "$TASK" =~ ^F([0-9])-([0-9]{2})$ ]]; then
        TASK_ID="$TASK"
        TASK_PHASE="${BASH_REMATCH[1]}"
        TASK_NUMBER="${BASH_REMATCH[2]}"
        return 0
    fi
    TASK_ID=""
    TASK_PHASE=""
    TASK_NUMBER=""
    return 1
}

# ── Read task from TAREAS.md ──────────────────────────
# Populates TASK_TITLE, TASK_DESCRIPTION, TASK_DEPENDENCIES, TASK_EFFORT, TASK_STATUS
read_task_from_tareas() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"

    if [ ! -f "$tareas_file" ]; then
        echo -e "${RED}Error: $CFG_TAREAS_FILE not found at $tareas_file${NC}" >&2
        return 1
    fi

    # Find the line with the task ID (e.g., "- [ ] **F2-03** ...")
    local task_line
    task_line=$(grep -n "\*\*${TASK_ID}\*\*" "$tareas_file" | head -1)

    if [ -z "$task_line" ]; then
        echo -e "${RED}Error: Task ${TASK_ID} not found in $CFG_TAREAS_FILE${NC}" >&2
        return 1
    fi

    local line_num
    line_num=$(echo "$task_line" | cut -d: -f1)
    local line_content
    line_content=$(echo "$task_line" | cut -d: -f2-)

    # Extract status: [ ], [~], [x], [-]
    TASK_STATUS=$(echo "$line_content" | grep -oE '\[([ ~x-])\]' | head -1 | tr -d '[]')

    # Extract title: everything after **F2-03** up to the effort estimate or end of line
    TASK_TITLE=$(echo "$line_content" | sed -E 's/.*\*\*F[0-9]-[0-9]+\*\*[[:space:]]*//' | sed -E 's/\([0-9]+h\).*//' | sed 's/[[:space:]]*$//')

    # Extract effort: (Nh) pattern
    TASK_EFFORT=$(echo "$line_content" | grep -oE '\([0-9]+h\)' | head -1 | tr -d '()')

    # Extract description: indented lines following the task line until next task or section
    local desc_start=$((line_num + 1))
    TASK_DESCRIPTION=$(awk -v start="$desc_start" '
        NR >= start {
            if (/^- \[/ || /^### / || /^## /) exit
            if (/^[[:space:]]/) print
        }
    ' "$tareas_file")

    # Extract dependencies: lines matching "Dependencies:" or "Depends on:" in description
    TASK_DEPENDENCIES=$(echo "$TASK_DESCRIPTION" | grep -iE '(dependenc|depends on|requires):' | sed -E 's/.*(F[0-9]-[0-9]+)/\1/g' | grep -oE 'F[0-9]-[0-9]+' | tr '\n' ' ')

    log "Task loaded: ${TASK_ID} — ${TASK_TITLE} (${TASK_EFFORT:-?h}, status=${TASK_STATUS})"
}

# ── Check dependencies ─────────────────────────────────
check_dependencies() {
    if [ -z "$TASK_DEPENDENCIES" ]; then
        log "No dependencies to check"
        return 0
    fi

    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    local failed=false

    for dep in $TASK_DEPENDENCIES; do
        local dep_status
        dep_status=$(grep "\*\*${dep}\*\*" "$tareas_file" | grep -oE '\[([ ~x-])\]' | head -1 | tr -d '[]')
        if [ "$dep_status" != "x" ]; then
            log "${RED}Dependency ${dep} is not completed (status: [${dep_status:-?}])${NC}"
            failed=true
        fi
    done

    if [ "$failed" = "true" ]; then
        echo -e "${RED}Error: Not all dependencies are completed. Cannot start ${TASK_ID}.${NC}" >&2
        return 1
    fi

    log "All dependencies satisfied"
}

# ── Mark task in-progress ──────────────────────────────
mark_task_in_progress() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    sed -i '' "s/\- \[ \] \*\*${TASK_ID}\*\*/- [~] **${TASK_ID}**/" "$tareas_file"
    git add "$tareas_file"
    git commit -m "chore: mark ${TASK_ID} as in-progress"
    log "Marked ${TASK_ID} as [~] in-progress"
}

# ── Mark task complete ─────────────────────────────────
mark_task_complete() {
    local tareas_file="$SCRIPT_DIR/$CFG_TAREAS_FILE"
    sed -i '' "s/\- \[~\] \*\*${TASK_ID}\*\*/- [x] **${TASK_ID}**/" "$tareas_file"
    log "Marked ${TASK_ID} as [x] complete"
}

# ── Derive branch name ─────────────────────────────────
derive_branch_name() {
    # Slugify title: lowercase, replace spaces/special chars with hyphens, trim
    local slug
    slug=$(echo "$TASK_TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-|-$//g' | cut -c1-40)
    RUN_ID="${TASK_ID}-${slug}"
    RUN_BRANCH="${CFG_BRANCH_PREFIX}${RUN_ID}"
}

# ── Build task context for agent prompts ───────────────
build_task_context() {
    local context=""
    context="## Task: ${TASK_ID} — ${TASK_TITLE}"
    context="${context}
Effort: ${TASK_EFFORT:-unknown}"

    if [ -n "$TASK_DESCRIPTION" ]; then
        context="${context}

## Task Description (from TAREAS.md)
${TASK_DESCRIPTION}"
    fi

    if [ -n "$TASK_DEPENDENCIES" ]; then
        context="${context}

## Dependencies (already implemented)
${TASK_DEPENDENCIES}"
    fi

    # Try to find relevant section in PLAN_MAESTRO.md
    local plan_file="$SCRIPT_DIR/$CFG_PLAN_MAESTRO_FILE"
    if [ -f "$plan_file" ]; then
        local plan_section
        plan_section=$(awk -v id="$TASK_ID" '
            $0 ~ id { found=1 }
            found && /^##/ && !first { first=1; print; next }
            found && first && /^##/ { exit }
            found && first { print }
        ' "$plan_file")
        if [ -n "$plan_section" ]; then
            context="${context}

## Relevant Architecture (from PLAN_MAESTRO.md)
${plan_section}"
        fi
    fi

    TASK_CONTEXT="$context"
}

# ── Load task (main entry point) ───────────────────────
# Called from minion.sh after config is loaded.
# Sets TASK_CONTEXT for blueprint prompts.
load_task() {
    TASK_CONTEXT=""
    if parse_task_id; then
        read_task_from_tareas || return 1
        check_dependencies || return 1
        derive_branch_name
        build_task_context
        # Override TASK with the full title for display
        TASK_DISPLAY="${TASK_ID} — ${TASK_TITLE}"
    else
        TASK_DISPLAY="$TASK"
        TASK_CONTEXT="## Task
${TASK}"
    fi
}
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/tareas.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/tareas.sh
git commit -m "feat(minion): add TAREAS.md integration module"
```

---

### Task 6: Setup Phase — setup.sh

**Files:**
- Create: `.minion-core/setup.sh`

- [ ] **Step 1: Write `.minion-core/setup.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/setup.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/setup.sh
git commit -m "feat(minion): add setup phase — branch creation + npm ci"
```

---

### Task 7: Plan + Review Loop — plan-review.sh

**Files:**
- Create: `.minion-core/plan-review.sh`

- [ ] **Step 1: Write `.minion-core/plan-review.sh`**

```bash
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
Improve the plan based on the reviewer's feedback.
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/plan-review.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/plan-review.sh
git commit -m "feat(minion): add plan + review iteration loop"
```

---

### Task 8: Validation Loop — validation.sh

**Files:**
- Create: `.minion-core/validation.sh`

- [ ] **Step 1: Write `.minion-core/validation.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/validation.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/validation.sh
git commit -m "feat(minion): add validation loop with fix agent"
```

---

### Task 9: Code Review Phase — review.sh

**Files:**
- Create: `.minion-core/review.sh`

- [ ] **Step 1: Write `.minion-core/review.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/review.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/review.sh
git commit -m "feat(minion): add code review agent phase"
```

---

### Task 10: Security Phase — security.sh

**Files:**
- Create: `.minion-core/security.sh`

- [ ] **Step 1: Write `.minion-core/security.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/security.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/security.sh
git commit -m "feat(minion): add security audit agent phase"
```

---

### Task 11: Result Phase — result.sh

**Files:**
- Create: `.minion-core/result.sh`

- [ ] **Step 1: Write `.minion-core/result.sh`**

```bash
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
```

- [ ] **Step 2: Verify syntax**

Run: `bash -n .minion-core/result.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .minion-core/result.sh
git commit -m "feat(minion): add result phase — doc commit + banner + metrics"
```

---

### Task 12: Blueprints — All 7 Blueprint Files

**Files:**
- Create: `.minion-blueprints/_template.sh`
- Create: `.minion-blueprints/implement.sh`
- Create: `.minion-blueprints/fix-issue.sh`
- Create: `.minion-blueprints/refactor.sh`
- Create: `.minion-blueprints/add-tests.sh`
- Create: `.minion-blueprints/migrate.sh`
- Create: `.minion-blueprints/update-deps.sh`

- [ ] **Step 1: Create `.minion-blueprints/` directory**

```bash
mkdir -p .minion-blueprints
```

- [ ] **Step 2: Write `.minion-blueprints/_template.sh`**

```bash
# .minion-blueprints/_template.sh — Blueprint contract documentation
# ================================================================
# This file documents the blueprint contract.
# NOT executed. Copy it to create a new blueprint.
#
# Usage:
#   1. Copy this file: cp _template.sh my-blueprint.sh
#   2. Define BLUEPRINT_TYPE and the required functions
#   3. Register in .minion.yml under `blueprints:`
#   4. Run: ./minion.sh my-blueprint "task"
#
# ================================================================
# CONTRACT
# ================================================================
#
# REQUIRED:
#   BLUEPRINT_TYPE="plan"|"direct"
#     - "plan": Uses 3 agents (planner + reviewer + executor)
#     - "direct": Uses 1 agent (direct executor)
#
#   execute_prompt()
#     - ALWAYS required
#     - Returns the prompt for the executor agent
#     - For type=plan: includes the approved plan via $RUN_PLAN_FILE
#     - For type=direct: includes the task directly
#
# REQUIRED if BLUEPRINT_TYPE="plan":
#   plan_prompt()
#     - Returns the prompt for the planner agent
#     - Should include the task ($TASK_CONTEXT) and rules ($CFG_EFFECTIVE_RULES)
#
# OPTIONAL (overrides):
#   fix_prompt()
#     - $1 = string with validation errors (ANSI stripped, tests summarized)
#     - If not defined, core generates a default prompt
#
#   review_criteria()
#     - Returns additional criteria for the reviewer
#     - Injected into the plan review prompt
#
# ================================================================
# AVAILABLE VARIABLES
# ================================================================
#
# From CLI:
#   $TASK            - The task as described by the user
#   $TASK_DISPLAY    - Display name (task ID + title, or free-form task)
#   $TASK_CONTEXT    - Full task context (from TAREAS.md or free-form)
#   $TASK_ID         - Task ID if provided (e.g., "F2-03"), empty otherwise
#   $BLUEPRINT       - Blueprint name (e.g., "implement")
#   $DRY_RUN         - "true" or "false"
#
# From config (.minion.yml):
#   $CFG_PROJECT_NAME       - Project name
#   $CFG_EFFECTIVE_RULES    - Global rules + blueprint rules
#   $CFG_BASE_BRANCH        - Base branch (e.g., "develop")
#   $CFG_CMD_*              - Commands (install, lint, format, etc.)
#
# From runtime (generated by core):
#   $RUN_ID          - Unique run identifier
#   $RUN_PLAN_FILE   - Path to approved plan (type=plan only, used in execute_prompt)
#   $RUN_REVIEW_FILE - Path to reviewer feedback (used internally by core)
#   $RUN_BRANCH      - Branch name created
#   $RUN_LOG         - Path to run log
#   $RUN_METRICS     - Path to metrics file
#   $RUN_TEMP_DIR    - Temp directory (cleaned up on exit)
```

- [ ] **Step 3: Write `.minion-blueprints/implement.sh`**

```bash
# .minion-blueprints/implement.sh — Implement a new feature
# Description: Implement a new feature with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Create a detailed implementation plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Read CLAUDE.md for project conventions
2. Search for similar existing code as pattern reference
3. Identify files to create/modify (exact paths)
4. Plan step by step: tests first (TDD), then implementation
5. Each step should result in a committable unit
6. Identify potential risks or design decisions

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown with exact file paths and concrete names.
Each step should be a logical commit unit.
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Implement exactly according to this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step. Do not deviate.
2. Start with tests (TDD): write failing test, then implement to pass.
3. After completing each logical subtask:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "<type>(<scope>): <description>"
   d. Continue to next subtask
4. Do NOT use git add -A. Stage specific files only.
5. Do NOT commit .env, credentials, or secret files.
6. Ensure all files mentioned in the plan are created/modified.

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 4: Write `.minion-blueprints/fix-issue.sh`**

```bash
# .minion-blueprints/fix-issue.sh — Diagnose and fix a bug
# Description: Diagnose and fix a bug with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Diagnose and create a fix plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Reproduce the issue mentally by analyzing the code
2. Identify root cause (not just the symptom)
3. Propose a concrete fix with files and lines to modify
4. Include tests covering the bug scenario (TDD: failing test first)
5. Identify if other locations share the same pattern

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown:
- Root cause
- Proposed fix (files, concrete changes)
- Tests to add
- Potential regressions
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Fix the bug following exactly this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step.
2. Start with the test that reproduces the bug (must fail).
3. Implement the fix so the test passes.
4. Verify existing tests are not broken.
5. After each fix unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "fix(<scope>): <description>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 5: Write `.minion-blueprints/refactor.sh`**

```bash
# .minion-blueprints/refactor.sh — Refactor existing code
# Description: Refactor existing code with plan + review

BLUEPRINT_TYPE="plan"

plan_prompt() {
    cat <<EOF
## Task
Create a refactoring plan for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Analyze the current code to be refactored
2. Identify invariants that MUST be maintained (contracts, interfaces, behavior)
3. Propose the new structure with files and concrete changes
4. Define safe refactoring steps (each step leaves code functional)
5. Identify existing tests that validate current behavior
6. If tests are missing, add them first (to ensure refactor doesn't break anything)

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown:
- Current state (what and why to refactor)
- Invariants to maintain
- Step-by-step plan (each step is safe)
- Tests to add/modify
- Files to create/modify/delete (exact paths)
EOF
}

execute_prompt() {
    cat <<EOF
## Task
Refactor following exactly this approved plan:

$(cat "$RUN_PLAN_FILE")

## Instructions
1. Follow the plan step by step. Each step must leave code functional.
2. If the plan includes new tests, write them first.
3. Perform the refactoring while maintaining invariants.
4. Verify existing tests still pass after each change.
5. Do not change behavior — only structure.
6. After each refactoring unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "refactor(<scope>): <description>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 6: Write `.minion-blueprints/add-tests.sh`**

```bash
# .minion-blueprints/add-tests.sh — Add tests to existing modules
# Description: Add tests to existing modules

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Add tests for: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Analyze the existing code of the indicated module/file
2. Identify use cases and edge cases to test
3. Write comprehensive tests following existing patterns
4. Do NOT modify production code
5. After completing tests:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "test(<scope>): add tests for <module>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 7: Write `.minion-blueprints/migrate.sh`**

```bash
# .minion-blueprints/migrate.sh — Migrate patterns or dependencies
# Description: Migrate patterns or dependencies

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Perform migration: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Identify all files affected by the migration
2. Make changes systematically and consistently
3. Verify existing tests still pass
4. Update imports, types, and references in all affected files
5. After each logical migration unit:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "refactor(<scope>): migrate <what>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 8: Write `.minion-blueprints/update-deps.sh`**

```bash
# .minion-blueprints/update-deps.sh — Update project dependencies
# Description: Update project dependencies

BLUEPRINT_TYPE="direct"

execute_prompt() {
    cat <<EOF
## Task
Update dependencies: ${TASK_DISPLAY}

${TASK_CONTEXT}

## Instructions
1. Identify the dependencies to update and their target versions
2. Update package.json with new versions
3. Run npm install to update package-lock.json
4. If there are breaking changes, update affected code
5. Verify lint, typecheck, and tests pass after the update
6. After completing the update:
   a. Stage relevant files: git add package.json package-lock.json <other changed files>
   b. Commit: git commit -m "chore(deps): update <packages>"

## Project Rules
${CFG_EFFECTIVE_RULES}
EOF
}
```

- [ ] **Step 9: Verify all blueprints have valid syntax**

Run: `for f in .minion-blueprints/*.sh; do bash -n "$f" && echo "OK: $f"; done`
Expected: `OK` for each file

- [ ] **Step 10: Commit**

```bash
git add .minion-blueprints/
git commit -m "feat(minion): add all blueprint definitions"
```

---

### Task 13: Entry Point — minion.sh

**Files:**
- Create: `minion.sh`

- [ ] **Step 1: Write `minion.sh`**

```bash
#!/usr/bin/env bash
# minion.sh — Entry point for PencaViva Minion Runner
# Parses args, loads modules, orchestrates the full blueprint flow.
# Usage: ./minion.sh [--help|--list|--dry-run|--from-plan <file>|--skip-review] [<blueprint> "<task>"]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$SCRIPT_DIR/.minion-core"
BLUEPRINTS_DIR="$SCRIPT_DIR/.minion-blueprints"
CONFIG_FILE="$SCRIPT_DIR/.minion.yml"

# ── Dependency checks ────────────────────────────────────────────
for cmd in yq claude gh git; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "Error: '$cmd' is required but not installed." >&2; exit 1; }
done

# ── Colors + logging (needed before arg parsing) ─────────────────
source "$CORE_DIR/helpers.sh"

# ── Help ────────────────────────────────────────────────────────
show_help() {
    cat <<EOF

${BOLD}PencaViva Minion Runner${NC} — Blueprint engine for coding agents

${BOLD}Usage:${NC}
  ./minion.sh <blueprint> <task-id|"task description">
  ./minion.sh --dry-run <blueprint> <task-id|"task description">
  ./minion.sh --from-plan <plan.md>
  ./minion.sh --list
  ./minion.sh --help

${BOLD}Options:${NC}
  --help              Show this message
  --list              List available blueprints with type and description
  --dry-run           Only run plan + review, without executing or committing
  --from-plan <file>  Execute using an existing plan (skip plan+review)
  --skip-review       Skip code review and security phases (phases 5+6)
  --force             Continue even if plan doesn't reach minimum score

${BOLD}Plan blueprints${NC} (3 agents: planner + reviewer + executor):
  implement   Implement a new feature
  fix-issue   Diagnose and fix a bug
  refactor    Refactor existing code

${BOLD}Direct blueprints${NC} (1 agent: direct executor):
  add-tests    Add tests to existing modules
  migrate      Migrate patterns or dependencies
  update-deps  Update project dependencies

${BOLD}Task argument:${NC}
  Task ID:     ./minion.sh implement F2-03
               Reads task from TAREAS.md, checks deps, manages state
  Free-form:   ./minion.sh implement "Add FAQ screen"
               No TAREAS.md integration

${BOLD}Examples:${NC}
  ./minion.sh implement F2-03
  ./minion.sh fix-issue F1-07
  ./minion.sh --dry-run implement F2-03
  ./minion.sh --from-plan .minion-plans/F2-03-result-notification-plan.md
  ./minion.sh add-tests "src/hooks/useAuth.ts"
  ./minion.sh --skip-review update-deps "Upgrade expo to SDK 56"

EOF
    exit 0
}

# ── List blueprints ─────────────────────────────────────────────
list_blueprints() {
    echo ""
    echo -e "${BOLD}Available blueprints:${NC}"
    echo ""
    printf "  %-16s %-8s %s\n" "NAME" "TYPE" "DESCRIPTION"
    printf "  %-16s %-8s %s\n" "────" "────" "───────────"
    for bp_file in "$BLUEPRINTS_DIR"/*.sh; do
        [ -f "$bp_file" ] || continue
        local bp_name
        bp_name=$(basename "$bp_file" .sh)
        [ "$bp_name" = "_template" ] && continue
        local bp_type
        bp_type=$(sed -n 's/^BLUEPRINT_TYPE="\(.*\)"/\1/p' "$bp_file" | head -1)
        local bp_desc
        bp_desc=$(sed -n 's/^# Description: *//p' "$bp_file" | head -1)
        local type_color="$PURPLE"
        [ "$bp_type" = "direct" ] && type_color="$CYAN"
        printf "  %-16s ${type_color}%-8s${NC} %s\n" "$bp_name" "$bp_type" "$bp_desc"
    done
    echo ""
    exit 0
}

# ── Parse args ──────────────────────────────────────────────────
DRY_RUN=false
FORCE=false
SKIP_REVIEW=false
FROM_PLAN=""
BLUEPRINT=""
TASK=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            show_help
            ;;
        --list|-l)
            list_blueprints
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --skip-review)
            SKIP_REVIEW=true
            shift
            ;;
        --from-plan)
            shift
            FROM_PLAN="${1:?Error: --from-plan requires a file}"
            if [ ! -f "$FROM_PLAN" ]; then
                echo -e "${RED}Error: Plan not found: $FROM_PLAN${NC}" >&2
                exit 1
            fi
            BLUEPRINT=$(sed -n 's/<!-- minion:blueprint=\(.*\) -->/\1/p' "$FROM_PLAN" | head -1)
            TASK=$(sed -n 's/<!-- minion:task=\(.*\) -->/\1/p' "$FROM_PLAN" | head -1)
            if [ -z "$BLUEPRINT" ] || [ -z "$TASK" ]; then
                echo -e "${RED}Error: Plan file missing minion:blueprint and minion:task headers${NC}" >&2
                echo "Regenerate with --dry-run to include the headers." >&2
                exit 1
            fi
            shift
            ;;
        -*)
            echo -e "${RED}Error: Unknown flag: $1${NC}" >&2
            echo "Use --help for options." >&2
            exit 1
            ;;
        *)
            if [ -z "$BLUEPRINT" ]; then
                BLUEPRINT="$1"
            elif [ -z "$TASK" ]; then
                TASK="$1"
            else
                echo -e "${RED}Error: Too many arguments.${NC}" >&2
                echo "Usage: ./minion.sh [--dry-run] <blueprint> \"<task>\"" >&2
                exit 1
            fi
            shift
            ;;
    esac
done

# ── Validate flag combinations ────────────────────────────────
if [ "$DRY_RUN" = "true" ] && [ -n "$FROM_PLAN" ]; then
    echo -e "${RED}Error: --dry-run and --from-plan are mutually exclusive.${NC}" >&2
    exit 1
fi

if [ "$FORCE" = "true" ] && [ "$DRY_RUN" = "true" ]; then
    echo -e "${RED}Error: --force and --dry-run are mutually exclusive.${NC}" >&2
    exit 1
fi

# ── Validate required args ──────────────────────────────────────
if [ -z "$BLUEPRINT" ] || [ -z "$TASK" ]; then
    if [ -n "$FROM_PLAN" ]; then
        echo -e "${RED}Error: Plan file missing minion:blueprint and minion:task headers${NC}" >&2
    else
        echo -e "${RED}Error: <blueprint> and \"<task>\" are required.${NC}" >&2
        echo "Usage: ./minion.sh [--dry-run] <blueprint> \"<task>\"" >&2
    fi
    echo "Use --help for options." >&2
    exit 1
fi

# ── Source core modules (helpers.sh already sourced above) ─────
source "$CORE_DIR/cleanup.sh"
source "$CORE_DIR/config.sh"
source "$CORE_DIR/tareas.sh"
source "$CORE_DIR/agent.sh"
source "$CORE_DIR/loader.sh"
source "$CORE_DIR/plan-review.sh"
source "$CORE_DIR/validation.sh"
source "$CORE_DIR/setup.sh"
source "$CORE_DIR/review.sh"
source "$CORE_DIR/security.sh"
source "$CORE_DIR/result.sh"

# ── Orchestrate ─────────────────────────────────────────────────
RUN_SUCCESS=false
load_config "$BLUEPRINT"
load_task || exit 1
# Re-set RUN_BRANCH after load_task may have changed RUN_ID
RUN_BRANCH="${CFG_BRANCH_PREFIX}${RUN_ID}"
load_blueprint "$BLUEPRINT"
step "0. Start"
log "Task: $TASK_DISPLAY"
log "Dry run: $DRY_RUN"
[ -n "$FROM_PLAN" ] && log "From plan: $FROM_PLAN"

# Validate --from-plan only with plan blueprints
if [ -n "$FROM_PLAN" ] && [ "$BLUEPRINT_TYPE" != "plan" ]; then
    echo -e "${RED}Error: --from-plan only works with plan blueprints, but '$BLUEPRINT' is type '$BLUEPRINT_TYPE'.${NC}" >&2
    exit 1
fi

# Validate --dry-run only with plan blueprints
if [ "$DRY_RUN" = "true" ] && [ "$BLUEPRINT_TYPE" = "direct" ]; then
    echo -e "${RED}Error: --dry-run only works with plan blueprints (implement, fix-issue, refactor).${NC}" >&2
    echo "Blueprint '$BLUEPRINT' is type direct — no plan to generate." >&2
    exit 1
fi

# Phase 1: Setup
if ! run_setup; then
    log "${RED}Setup failed. Aborting.${NC}"
    RUN_SUCCESS=false
    run_result
    exit 1
fi

# Phase 2: Plan + Review (only for type=plan)
if [ "$BLUEPRINT_TYPE" = "plan" ]; then
    if [ -n "$FROM_PLAN" ]; then
        step "2. Plan (from-plan)"
        log "Using existing plan: $FROM_PLAN"
        cp "$FROM_PLAN" "$RUN_PLAN_FILE"
        echo "plan_source=from-plan" >> "$RUN_METRICS"
        echo "plan_source_file=$(cd "$(dirname "$FROM_PLAN")" && pwd)/$(basename "$FROM_PLAN")" >> "$RUN_METRICS"
        save_plan_to_repo "from-plan"
    else
        step "2. Plan + Review"
        timer_start
        if ! run_plan_review; then
            if [ "$FORCE" = "true" ]; then
                log "${YELLOW}Plan not approved but --force active. Continuing.${NC}"
            else
                log "${RED}Plan+Review failed. Aborting. (use --force to continue with unapproved plan)${NC}"
                RUN_SUCCESS=false
                run_result
                exit 1
            fi
        fi
        timer_end "plan_review_total"

        if [ "$DRY_RUN" = "true" ]; then
            dry_run_exit
        fi
    fi
fi

# Phase 3: Execute
step "3. Execution"
timer_start
local_prompt=$(execute_prompt)
if ! run_agent "$local_prompt" "$CFG_BLUEPRINT_MODEL" "$CFG_BLUEPRINT_EFFORT" "$CFG_DEFAULT_TOOLS" "$CFG_MAX_TURNS_IMPL"; then
    log "${RED}Execution agent failed.${NC}"
    echo "execution_agent_failed=true" >> "$RUN_METRICS"
else
    echo "execution_agent_failed=false" >> "$RUN_METRICS"
fi
timer_end "execution"

# Check if agent produced any changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    # Also check if any commits were made on branch (per-subtask commits)
    local_commits=$(git rev-list "$CFG_BASE_BRANCH"..HEAD --count 2>/dev/null || echo "0")
    # Subtract 1 for the task-in-progress commit if it exists
    [ -n "${TASK_ID:-}" ] && local_commits=$((local_commits - 1))
    if [ "$local_commits" -le 0 ]; then
        log "${YELLOW}No changes detected. Nothing to validate.${NC}"
        echo "agent_produced_changes=false" >> "$RUN_METRICS"
        RUN_SUCCESS=false
        step "7. Result"
        timer_start
        run_result
        timer_end "result"
        exit 1
    fi
fi
echo "agent_produced_changes=true" >> "$RUN_METRICS"

# Phase 4: Validation
step "4. Validation"
timer_start
run_validation
timer_end "validation_total"

# Phase 5: Code Review (skippable)
if [ "$RUN_SUCCESS" = "true" ]; then
    run_code_review
fi

# Phase 6: Security Check (skippable)
if [ "$RUN_SUCCESS" = "true" ]; then
    if ! run_security_check; then
        RUN_SUCCESS=false
    fi
fi

# Phase 7: Result
step "7. Result"
timer_start
run_result
timer_end "result"

[ "$RUN_SUCCESS" = "true" ] || exit 1
```

- [ ] **Step 2: Make executable**

Run: `chmod +x minion.sh`

- [ ] **Step 3: Verify syntax**

Run: `bash -n minion.sh && echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add minion.sh
git commit -m "feat(minion): add entry point orchestrator"
```

---

### Task 14: Gitignore + Smoke Test

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add minion directories to `.gitignore`**

Add these lines to `.gitignore`:

```
# Minion Runner
.minion-logs/
.minion-plans/
```

- [ ] **Step 2: Verify `--help` works**

Run: `./minion.sh --help`
Expected: Help text with usage, options, blueprints, and examples

- [ ] **Step 3: Verify `--list` works**

Run: `./minion.sh --list`
Expected: Table listing all 6 blueprints with type and description

- [ ] **Step 4: Verify config loads**

Run: `./minion.sh 2>&1 | head -5`
Expected: Error message about missing blueprint+task (not a crash)

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add minion runtime dirs to gitignore"
```

---

## Execution Checklist

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Core utilities (helpers.sh + cleanup.sh) | None |
| 2 | Configuration (config.sh + .minion.yml) | Task 1 |
| 3 | Blueprint loader (loader.sh) | Task 1 |
| 4 | Agent wrapper (agent.sh) | Task 1 |
| 5 | TAREAS.md integration (tareas.sh) | Task 1, 2 |
| 6 | Setup phase (setup.sh) | Task 1, 5 |
| 7 | Plan + review loop (plan-review.sh) | Task 1, 4 |
| 8 | Validation loop (validation.sh) | Task 1, 4 |
| 9 | Code review phase (review.sh) | Task 1, 4 |
| 10 | Security phase (security.sh) | Task 1, 4 |
| 11 | Result phase (result.sh) | Task 1, 5 |
| 12 | All blueprints | Task 1 |
| 13 | Entry point (minion.sh) | Tasks 1-12 |
| 14 | Gitignore + smoke test | Task 13 |

**Parallel groups:**
- Group A (independent): Tasks 1
- Group B (depends on 1): Tasks 2, 3, 4, 12
- Group C (depends on 1+2): Task 5
- Group D (depends on 1+4): Tasks 7, 8, 9, 10
- Group E (depends on 1+5): Tasks 6, 11
- Group F (depends on all): Task 13
- Group G (depends on 13): Task 14
