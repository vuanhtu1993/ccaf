# Mock exams

Mỗi lần chạy `/mock-exam` (hoặc `npm run agent:exam`), báo cáo được ghi vào đây với
tên `YYYY-MM-DD.md`.

## Mẫu báo cáo

```markdown
# Mock exam YYYY-MM-DD

Tổng: <đúng>/<tổng> (<phần trăm>%)
Thời gian: <phút>

| Domain | Đúng | Tổng | % |
| :- | :- | :- | :- |
| api-fundamentals | | | |
| agent-design | | | |
| claude-code-config | | | |
| mcp-integration | | | |

## Câu sai
- Câu <n> (<domain>): chọn <X>, đúng <Y>. <lý do 1 câu>

## Ưu tiên ôn tập
1. <domain yếu nhất> — <concept id cụ thể>
```

## Cách đọc kết quả

- Domain yếu nhất -> chạy `/daily-study <layer tương ứng>` vào buổi sau.
- Câu sai ở cùng một concept 2 lần -> thêm quiz mới cho concept đó trong
  `mcp-server/src/knowledge.ts`, rồi chạy `npm --prefix mcp-server run probe`.
- Không bao giờ tự chấm bằng cảm tính: luôn qua tool `grade_answer`.

## Phân bố quiz hiện tại

| Domain | Số câu |
| :- | :- |
| api-fundamentals | 4 |
| agent-design | 6 |
| claude-code-config | 10 |
| mcp-integration | 6 |

Tổng 26 câu, 23 concept. Domain `claude-code-config` nhiều nhất vì tầng Claude Code
có nhiều cơ chế nhất (rules, skills, subagents, hooks, permission).
