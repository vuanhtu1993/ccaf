#!/usr/bin/env bash
# SessionStart hook — nạp bối cảnh buổi học vào context của Claude.
#
# Hợp đồng: đọc JSON hook input qua stdin, in plain text ra stdout.
# Với SessionStart, plain-text stdout được Claude Code thêm vào context.
# Không bao giờ exit != 0 để tránh làm hỏng phiên.

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROGRESS_FILE="$PROJECT_DIR/docs/progress.md"

printf '## Bối cảnh buổi học (SessionStart hook)\n\n'

printf -- '- Repo: `%s`\n' "$(basename "$PROJECT_DIR")"
printf -- '- Ngày: %s\n' "$(date '+%Y-%m-%d %H:%M')"

if command -v git >/dev/null 2>&1 && [ -d "$PROJECT_DIR/.git" ]; then
  branch="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
  dirty="$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  printf -- '- Git: branch `%s`, %s file thay đổi chưa commit\n' "$branch" "$dirty"
fi

# Tiến độ: đọc 12 dòng cuối của docs/progress.md nếu có.
if [ -f "$PROGRESS_FILE" ]; then
  printf -- '\n### Tiến độ gần nhất (12 dòng cuối của docs/progress.md)\n\n```\n'
  tail -n 12 "$PROGRESS_FILE"
  printf '```\n'
else
  printf -- '\nChưa có `docs/progress.md` — đây là buổi học đầu tiên.\n'
fi

printf -- '\nNhắc nhở: mọi concept mới phải thêm concept card vào `mcp-server/src/knowledge.ts` và câu hỏi quiz cùng domain.\n'

# Exit 0: stdout trở thành context. Không block gì cả.
exit 0
