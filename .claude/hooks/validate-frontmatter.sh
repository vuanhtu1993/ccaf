#!/usr/bin/env bash
# PreToolUse + PostToolUse hook (matcher: Write|Edit|MultiEdit) — validate frontmatter.
#
# Chạy 2 chế độ:
#   PreToolUse  -> kiểm tra nội dung SẮP ghi (tool_input.content / new_string / edits),
#                  exit 2 để chặn nếu frontmatter sai.
#   PostToolUse -> kiểm tra file ĐÃ ghi trên đĩa, exit 2 để báo Claude sửa lại.
#
# Chỉ áp dụng cho file trong .claude/ để không làm phiền khi sửa code thường.

set -uo pipefail

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  event="$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)"
  file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
else
  event="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("hook_event_name",""))' 2>/dev/null)"
  file="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
fi

[ -z "${file:-}" ] && exit 0

# Chỉ quan tâm file cấu hình Claude Code.
case "$file" in
  */.claude/agents/*.md|*/.claude/skills/*/SKILL.md|*/.claude/rules/*.md) ;;
  *) exit 0 ;;
esac

fail() {
  printf 'Frontmatter không hợp lệ (%s): %s\n' "$(basename "$file")" "$1" >&2
  exit 2
}

require_frontmatter() {
  local content="$1" first_line
  first_line="$(printf '%s' "$content" | head -n 1)"
  # Claude Code chỉ đọc frontmatter khi '---' là dòng ĐẦU TIÊN của file.
  if [ "$first_line" != "---" ]; then
    fail "'---' phải là dòng đầu tiên của file"
  fi
  case "$content" in
    *$'\n---'*) : ;;
    *) fail "thiếu dòng '---' đóng frontmatter" ;;
  esac
}

# Đọc nội dung cần kiểm tra.
content=""
if [ "${event}" = "PostToolUse" ]; then
  [ -f "$file" ] || exit 0
  content="$(cat "$file")"
else
  if command -v jq >/dev/null 2>&1; then
    content="$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty' 2>/dev/null)"
    # MultiEdit đôi khi dùng mảng edits.
    if [ -z "$content" ]; then
      content="$(printf '%s' "$input" | jq -r '(.tool_input.edits // [])[].new_string' 2>/dev/null)"
    fi
  else
    content="$(printf '%s' "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); ti=d.get("tool_input",{}) or {}; print(ti.get("content") or ti.get("new_string") or "\n".join(e.get("new_string","") for e in ti.get("edits") or []))' 2>/dev/null)"
  fi
fi

[ -z "${content:-}" ] && exit 0

require_frontmatter "$content"

case "$file" in
  */.claude/agents/*.md)
    grep -qE '^name:[[:space:]]*\S' <<<"$content" || fail "subagent thiếu field 'name'"
    grep -qE '^description:[[:space:]]*\S' <<<"$content" || fail "subagent thiếu field 'description'"
    ;;
  */.claude/skills/*/SKILL.md)
    grep -qE '^name:[[:space:]]*\S' <<<"$content" || fail "skill thiếu field 'name'"
    grep -qE '^description:[[:space:]]*\S' <<<"$content" || fail "skill thiếu field 'description'"
    # Tên skill phải khớp tên thư mục chứa nó.
    dir_name="$(basename "$(dirname "$file")")"
    declared="$(sed -n 's/^name:[[:space:]]*//p' <<<"$content" | head -n 1 | tr -d '\r' | xargs)"
    if [ -n "$declared" ] && [ "$declared" != "$dir_name" ]; then
      fail "name '$declared' không khớp tên thư mục '$dir_name'"
    fi
    ;;
esac

# PostToolUse: báo cho Claude biết đã pass, không cần chặn.
exit 0
