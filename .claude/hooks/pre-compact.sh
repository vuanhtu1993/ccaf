#!/usr/bin/env bash
# PreCompact hook — kích hoạt ngay trước khi Claude Code nén (compact) ngữ cảnh.
# Dùng để ghi vết hoặc sao lưu snapshot trạng thái quan trọng vào docs/progress.md.
# Luôn exit 0: hook này chỉ quan sát và ghi vết, không bao giờ chặn quá trình nén.

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="$PROJECT_DIR/docs/progress.md"

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || exit 0

input="$(cat)"

# Trích xuất session_id nếu có
if command -v jq >/dev/null 2>&1; then
  session="$(printf '%s' "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)"
elif command -v python3 >/dev/null 2>&1; then
  session="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","unknown"))' 2>/dev/null)"
else
  session="unknown"
fi

{
  printf '### 📦 Cảnh báo Nén Ngữ Cảnh (PreCompact Hook: %s)\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf -- '- session: `%s`\n' "${session:-unknown}"
  printf -- '- thông điệp: *Ngữ cảnh đạt ngưỡng tối đa. Đang tiến hành nén context window để giải phóng bộ nhớ.*\n\n'
} >> "$LOG_FILE"

exit 0
