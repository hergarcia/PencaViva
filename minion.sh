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
source "$CORE_DIR/execution.sh"
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
if ! run_execution; then
    RUN_SUCCESS=false
    step "7. Result"
    timer_start
    run_result
    timer_end "result"
    exit 1
fi

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
