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
