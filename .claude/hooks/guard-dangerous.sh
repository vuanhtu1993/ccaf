#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — chặn lệnh phá hoại.
#
# Đọc JSON qua stdin, lấy .tool_input.command.
# Exit 2  -> block tool call, stderr trở thành lý do Claude nhìn thấy.
# Exit 0  -> không quyết định gì, luồng permission bình thường tiếp tục.

set -uo pipefail

input="$(cat)"

# Trích command: ưu tiên jq, fallback python3 (macOS luôn có sẵn).
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
elif command -v python3 >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)"
else
  # Không parse được thì không đoán — để permission flow xử lý.
  exit 0
fi

[ -z "${cmd:-}" ] && exit 0

block() {
  printf 'Bị chặn bởi .claude/hooks/guard-dangerous.sh: %s\n' "$1" >&2
  exit 2
}

# Các mẫu nguy hiểm trong repo học tập này.
case "$cmd" in
  *"rm -rf /"*)            block "không được xoá toàn hệ thống" ;;
  *"rm -rf ~"*)            block "không được xoá home directory" ;;
  *":(){ :|:& };:"*)       block "fork bomb" ;;
  *"git push --force"*)    block "không force-push từ agent" ;;
  *"git push -f"*)         block "không force-push từ agent" ;;
  *">.env"*|*"> .env"*|*">>.env"*|*">> .env"*)
                           block "không ghi đè .env" ;;
  *"chmod 777"*)           block "không dùng chmod 777" ;;
esac

# Chặn ghi đè lên các file cấu hình của chính Claude Code.
# (Edit/Write đã có matcher riêng; đây là lưới an toàn cho shell.)
if printf '%s' "$cmd" | grep -qE '(>|>>|tee|sed -i).*(\.claude/settings\.json)'; then
  block "sửa settings.json phải làm qua người dùng, không qua shell của agent"
fi

exit 0
