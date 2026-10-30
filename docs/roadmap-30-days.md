# Lộ trình 30 ngày

Nguyên tắc: mỗi ngày có **một việc tạo ra file thật**, không chỉ đọc. Cuối mỗi tuần
phải `npm run check` xanh.

Thời lượng gợi ý: 60–90 phút/ngày. Ngày nào ít thời gian thì làm phần "Bắt buộc".

## Tuần 1 — Nền tảng + tầng Claude Code

| Ngày | Chủ đề | Việc phải làm (tạo file thật) |
| :- | :- | :- |
| 1 | Bản đồ 4 tầng | Đọc `docs/architecture.md`; chạy `npm run setup && npm run check` |
| 2 | `CLAUDE.md` | Sửa `CLAUDE.md`: thêm 3 quy ước riêng của bạn |
| 3 | rules + `paths` | Thêm `.claude/rules/<topic>.md` có frontmatter `paths:` |
| 4 | skills | Viết skill mới `.claude/skills/<name>/SKILL.md`, name khớp thư mục |
| 5 | hook cơ bản | Thêm hook `PostToolUse`, script dùng `jq` đọc stdin |
| 6 | hook điều khiển | Cho script trả `hookSpecificOutput.permissionDecision` |
| 7 | Ôn + tự kiểm | `npm run check`; tự giải thích 3 câu: context vs enforcement, exit 2, deny > allow |

## Tuần 2 — Subagent + MCP

| Ngày | Chủ đề | Việc phải làm |
| :- | :- | :- |
| 8 | Subagent file | Thêm `.claude/agents/<name>.md` với `tools` thu hẹp |
| 9 | Subagent camelCase | Sửa `maxTurns`/`disallowedTools`; cố tình dùng `max_turns` và quan sát nó bị bỏ qua |
| 10 | MCP primitive | Đọc `mcp-server/src/index.ts`; thêm 1 tool mới |
| 11 | MCP resource | Thêm resource mới, kiểm bằng `npm --prefix mcp-server run probe` |
| 12 | MCP transport | Đổi `.mcp.json` sang `type` sai, chạy `npm run validate` để thấy lỗi |
| 13 | stdout là protocol | Thêm một `console.log` vào index.ts, chạy probe, quan sát nó vỡ; sửa lại |
| 14 | Ôn + tự kiểm | Viết 5 câu quiz mới vào `knowledge.ts`, chạy `audit_kb` |

## Tuần 3 — Agent SDK

| Ngày | Chủ đề | Việc phải làm |
| :- | :- | :- |
| 15 | `query()` | Đọc `agent-sdk/src/orchestrator.ts`; chạy với API key nếu có |
| 16 | `agents` option | Thêm `AgentDefinition` thứ hai; nhớ `description` + `prompt` |
| 17 | `settingSources` | Thử `settingSources: []`, quan sát skill biến mất |
| 18 | Hooks ở SDK | Thêm `PostToolUse` callback, so sánh với shell hook |
| 19 | In-process MCP | Thêm tool thứ hai vào `repo-map` |
| 20 | Permission | Thử `permissionMode` khác nhau, ghi lại khác biệt |
| 21 | Ôn + tự kiểm | Giải thích: vì sao `settingSources: []` là cách làm đúng cho CI |

## Tuần 4 — Tổng hợp + thi thử

| Ngày | Chủ đề | Việc phải làm |
| :- | :- | :- |
| 22 | Ôn domain 1 | `generate_quiz` domain `api-fundamentals`, 10 câu, mục tiêu ≥ 80% |
| 23 | Ôn domain 2 | domain `agent-design`, 10 câu |
| 24 | Ôn domain 3 | domain `claude-code-config`, 10 câu |
| 25 | Ôn domain 4 | domain `mcp-integration`, 10 câu |
| 26 | Thi thử 1 | 20 câu `balanced: true`, ghi vào `docs/mock-exams/` |
| 27 | Vá lỗ hổng | Học lại các concept sai, thêm quiz cho chúng |
| 28 | Thi thử 2 | 20 câu, so sánh với ngày 26 |
| 29 | Đối chiếu nguồn | Đọc `docs/sources.md`, kiểm blueprint chính thức, ghi phần lệch |
| 30 | Tổng duyệt | `npm run check` xanh; đọc lại toàn bộ `.claude/` như đang review PR |

## Cách tự chấm mỗi ngày

Câu hỏi tự kiểm phải trả lời được bằng **một câu**, không cần mở tài liệu:

- `CLAUDE.md` khác hook ở đâu? -> context vs enforcement.
- Skill rẻ hơn rule ở điểm nào? -> chỉ metadata nạp sẵn.
- `exit 2` làm gì? -> chặn, stderr là lý do.
- Vì sao `description` là bắt buộc ở subagent? -> thiếu thì file bị skip im lặng.
- `stdout` của MCP stdio là gì? -> kênh JSON-RPC, nên log phải đi stderr.
- `settingSources: []` dùng khi nào? -> khi cần tái lập, cách ly máy dev.

Nếu một câu trả lời cần nhiều hơn một câu, bạn chưa hiểu — quay lại file tương ứng.

## Dấu hiệu bạn đã sẵn sàng

- `npm run check` xanh, và bạn giải thích được **từng** check đang bảo vệ điều gì.
- Bạn tự thêm được một concept + quiz + skill liên quan mà không cần xem lại repo.
- Bạn chỉ ra được, cho bất kỳ khái niệm nào, nó sống ở tầng nào và vì sao **không**
  nên đặt ở tầng khác.
