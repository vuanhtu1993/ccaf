# Kiến trúc — luật bất biến của repo này

Repo mô phỏng đúng sơ đồ kiến trúc Claude. Khi thêm tính năng, đặt đúng tầng:

| Câu hỏi | Tầng | Thư mục |
| :- | :- | :- |
| Đây là "model + tool loop" tự viết? | Claude API / Client SDK | (không có trong repo — ghi chú ở `docs/`) |
| Đây là agent loop đóng gói sẵn? | Agent SDK | `agent-sdk/src/` |
| Đây là worker chuyên biệt được giao việc? | Subagent | `.claude/agents/` hoặc option `agents` của SDK |
| Đây là tri thức/quy trình nạp theo nhu cầu? | Skill | `.claude/skills/` |
| Đây là luật luôn bật, áp theo đường dẫn? | Rule | `.claude/rules/` |
| Đây là hành vi bắt buộc ở một thời điểm? | Hook | `.claude/hooks/` + `.claude/settings.json` |
| Đây là tool nối hệ thống ngoài? | MCP server | `mcp-server/` |

Nguyên tắc:

- Kiến thức luôn bật, ngắn -> `CLAUDE.md`. Kiến thức luôn bật, dài -> `.claude/rules/`.
- Quy trình nhiều bước, chỉ dùng đôi khi -> skill (nội dung chỉ nạp khi gọi).
- Điều **phải** xảy ra mà không phụ thuộc việc Claude có nghe lời hay không -> hook.
- Không nhân đôi: một khái niệm chỉ sống ở đúng một tầng, các tầng khác trỏ tới nó.
