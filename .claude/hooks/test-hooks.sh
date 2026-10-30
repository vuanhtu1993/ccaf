#!/usr/bin/env bash
# Test hook bằng JSON input giả lập giống Claude Code gửi qua stdin.
# Chạy: .claude/hooks/test-hooks.sh
#
# Đây là test của chính repo: nó chứng minh hook hoạt động đúng hợp đồng
# exit code / stdout, không chỉ là cấu hình đẹp trên giấy.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
HOOKS="$PROJECT_DIR/.claude/hooks"
pass=0
fail=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  \xe2\x9c\x93 %s\n' "$label"
    pass=$((pass + 1))
  else
    printf '  \xe2\x9c\x97 %s (mong %s, nhận %s)\n' "$label" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

echo "== guard-dangerous.sh =="

# rm -rf / phải bị chặn: exit 2
json='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'
out=$(printf '%s' "$json" | "$HOOKS/guard-dangerous.sh" 2>&1); code=$?
assert_eq "chặn rm -rf /" "2" "$code"

# git push --force phải bị chặn
json='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}'
printf '%s' "$json" | "$HOOKS/guard-dangerous.sh" >/dev/null 2>&1; code=$?
assert_eq "chặn git push --force" "2" "$code"

# lệnh bình thường phải pass: exit 0
json='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm run build"}}'
printf '%s' "$json" | "$HOOKS/guard-dangerous.sh" >/dev/null 2>&1; code=$?
assert_eq "cho phép npm run build" "0" "$code"

# stdin rỗng không được crash
printf '' | "$HOOKS/guard-dangerous.sh" >/dev/null 2>&1; code=$?
assert_eq "stdin rỗng vẫn exit 0" "0" "$code"

echo
echo "== validate-frontmatter.sh =="

# Subagent hợp lệ: exit 0
json=$(jq -nc '{
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/tmp/x/.claude/agents/ok.md",
    content: "---\nname: ok\ndescription: test\n---\n\nBody\n"
  }
}')
printf '%s' "$json" | "$HOOKS/validate-frontmatter.sh" >/dev/null 2>&1; code=$?
assert_eq "subagent hợp lệ được ghi" "0" "$code"

# Thiếu description: exit 2
json=$(jq -nc '{
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/tmp/x/.claude/agents/bad.md",
    content: "---\nname: bad\n---\n\nBody\n"
  }
}')
printf '%s' "$json" | "$HOOKS/validate-frontmatter.sh" >/dev/null 2>&1; code=$?
assert_eq "subagent thiếu description bị chặn" "2" "$code"

# '---' không ở dòng đầu: exit 2
json=$(jq -nc '{
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/tmp/x/.claude/agents/late.md",
    content: "# Title\n\n---\nname: late\ndescription: test\n---\n"
  }
}')
printf '%s' "$json" | "$HOOKS/validate-frontmatter.sh" >/dev/null 2>&1; code=$?
assert_eq "frontmatter không ở dòng đầu bị chặn" "2" "$code"

# Skill có name lệch tên thư mục: exit 2
json=$(jq -nc '{
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/tmp/x/.claude/skills/deploy/SKILL.md",
    content: "---\nname: ship\ndescription: test\n---\n\nBody\n"
  }
}')
printf '%s' "$json" | "$HOOKS/validate-frontmatter.sh" >/dev/null 2>&1; code=$?
assert_eq "skill name lệch thư mục bị chặn" "2" "$code"

# File ngoài .claude/: bỏ qua hoàn toàn
json=$(jq -nc '{
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/tmp/x/src/main.ts",
    content: "console.log(1);"
  }
}')
printf '%s' "$json" | "$HOOKS/validate-frontmatter.sh" >/dev/null 2>&1; code=$?
assert_eq "file ngoài .claude/ được bỏ qua" "0" "$code"

echo
echo "== study-log.sh =="
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/docs"
json='{"session_id":"test-session-123","last_assistant_message":"Học xong hooks."}'
CLAUDE_PROJECT_DIR="$tmpdir" printf '%s' "$json" | CLAUDE_PROJECT_DIR="$tmpdir" "$HOOKS/study-log.sh" >/dev/null 2>&1; code=$?
assert_eq "ghi log exit 0" "0" "$code"
if grep -q "test-session-123" "$tmpdir/docs/progress.md" 2>/dev/null; then
  printf '  \xe2\x9c\x93 ghi được session_id vào docs/progress.md\n'
  pass=$((pass + 1))
else
  printf '  \xe2\x9c\x97 không ghi được docs/progress.md\n'
  fail=$((fail + 1))
fi
rm -rf "$tmpdir"

echo
if [ "$fail" -eq 0 ]; then
  echo "Hook test PASS — $pass/$pass."
  exit 0
fi
echo "Hook test FAIL — $fail lỗi, $pass pass."
exit 1
