# .minion-core/cleanup.sh — Temp dir + trap EXIT handler

RUN_TEMP_DIR=$(mktemp -d)
RUN_PLAN_FILE="$RUN_TEMP_DIR/plan.md"
RUN_REVIEW_FILE="$RUN_TEMP_DIR/review.md"

cleanup() {
    rm -rf "$RUN_TEMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
