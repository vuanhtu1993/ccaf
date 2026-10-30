#!/usr/bin/env bash
# Stop hook — ghi lại mỗi lượt học vào docs/progress.md để SessionStart đọc lại.
#
# Đọc JSON qua stdin, lấy .session_id và .last_assistant_message (nếu có).
# Exit 0 luôn: hook này chỉ ghi log, không bao giờ được chặn Claude dừng.

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="$PROJECT_DIR/docs/progress.md"

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || exit 0
[ -f "$LOG_FILE" ] || printf '# Nhật ký học tập\n\n> Hook `Stop` tự động ghi mỗi lượt. Sửa tay thoải mái.\n\n' > "$LOG_FILE"

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  session="$(printf '%s' "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)"
  summary="$(printf '%s' "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null | tr '\n' ' ' | cut -c1-200)"
elif command -v python3 >/dev/null 2>&1; then
  session="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","unknown"))' 2>/dev/null)"
  summary="$(printf '%s' "$input" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("last_assistant_message") or "").replace("\n"," ")[:200])' 2>/dev/null)"
else
  session="unknown"; summary=""
fi

{
  printf '## %s\n\n' "$(date '+%Y-%m-%d %H:%M')"
  printf -- '- session: `%s`\n' "${session:-unknown}"
  if [ -n "${summary:-}" ]; then
    printf -- '- tóm tắt: %s\n' "$summary"
  fi
  printf '\n'
} >> "$LOG_FILE"

exit 0
