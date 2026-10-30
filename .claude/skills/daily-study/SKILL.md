---
name: daily-study
description: Chạy một buổi học 45 phút có cấu trúc cho kỳ CCA-F — ôn concept cũ, học 1 concept mới, khoan 5 câu quiz, và ghi tiến độ. Dùng khi user nói "học bài", "buổi học hôm nay", "start a study session", hoặc gõ /daily-study.
argument-hint: "[layer: api|agent-sdk|claude-code|mcp]"
allowed-tools: Read, Glob, Grep, Bash(npm --prefix mcp-server run probe:*), Bash(date:*)
---

# Buổi học 45 phút

Tham số (nếu có): `$ARGUMENTS` — layer muốn tập trung. Nếu trống, chọn theo lộ trình
trong `docs/roadmap-30-days.md`.

## 1. Khởi động (5 phút)

Chạy `npm --prefix mcp-server run probe` để xác nhận MCP server sống, rồi đọc
`docs/progress.md` (nếu có) và tóm tắt cho user biết buổi trước dừng ở đâu.

## 2. Ôn nhanh (10 phút)

Gọi tool `list_concepts` của MCP server `cca-coach`, lọc theo layer của buổi trước,
rồi hỏi user 3 câu mở: "giải thích X trong 2 câu", "khi nào KHÔNG dùng Y".

Sai thì giải thích ngay, đừng để sang phần sau.

## 3. Concept mới (20 phút)

1. Gọi `get_concept` cho concept mới.
2. Trình bày theo đúng 4 khối: API / Agent SDK / Claude Code / MCP. Khối nào
   không áp dụng thì nói rõ lý do.
3. Chỉ ra khái niệm này đang sống ở file nào trong repo (kèm path thật).
4. Bắt user tự viết 1 thay đổi nhỏ trong repo để chứng minh hiểu — ví dụ thêm 1 dòng
   vào đúng layer, hoặc thêm 1 tool vào MCP server.

## 4. Khoan quiz (8 phút)

Gọi tool `generate_quiz` với `domain` tương ứng và `count: 5`, rồi chấm bằng tool
`grade_answer`. Không đưa đáp án trước khi user trả lời.

## 5. Ghi lại (2 phút)

Thêm 1 mục vào cuối `docs/progress.md` theo mẫu:

```
## YYYY-MM-DD — <layer> — <concept id>
- Hiểu: <1 câu>
- Còn yếu: <1 câu>
- Việc tiếp: <1 câu>
```

Nếu tỉ lệ đúng quiz < 60%, đề nghị học lại concept đó vào buổi sau và ghi rõ vào mục "Còn yếu".
