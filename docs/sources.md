# Nguồn — mọi khẳng định trong repo này đều truy được

Nguyên tắc: nếu không có nguồn, nó không được vào `knowledge.ts`.

## Trang docs chính thức đã đọc khi dựng repo

Tất cả truy cập ngày 2026-10-29, từ `code.claude.com/docs` (bản `.md` để đọc raw).

| Chủ đề | URL | Dùng cho |
| :- | :- | :- |
| Memory / CLAUDE.md / `.claude/rules/` | https://code.claude.com/docs/en/memory | `cc-claude-md`, `cc-rules-paths` |
| Skills + frontmatter | https://code.claude.com/docs/en/skills | `cc-skills`, `cc-skill-frontmatter` |
| Subagents + frontmatter | https://code.claude.com/docs/en/sub-agents | `cc-subagents-files`, `cc-subagent-tools` |
| Hooks reference | https://code.claude.com/docs/en/hooks | `cc-hooks-shape`, `cc-hooks-exit-codes`, `cc-hooks-pretooluse-decision` |
| Permission modes | https://code.claude.com/docs/en/permission-modes | `cc-permission-modes` |
| MCP (`.mcp.json`, transport, env expansion) | https://code.claude.com/docs/en/mcp | `mcp-*` |
| Settings reference | https://code.claude.com/docs/en/settings-reference | `enableAllProjectMcpServers` |
| Agent SDK overview | https://code.claude.com/docs/en/agent-sdk/overview | `agent-sdk-query` |
| Agent SDK TypeScript (types) | https://code.claude.com/docs/en/agent-sdk/typescript | `AgentDefinition`, `Options` |
| Agent SDK skills | https://code.claude.com/docs/en/agent-sdk/skills | `settingSources` + skills |
| MCP spec | https://modelcontextprotocol.io/specification | `mcp-primitives` |
| Anthropic Academy (courses) | https://anthropic.skilljar.com/ | lộ trình học |

## Xác minh bằng máy, không chỉ bằng docs

Đây là phần quan trọng: các khẳng định sau đã được **chạy thật** trên máy, không
phải đọc rồi tin.

| Khẳng định | Cách xác minh | Kết quả |
| :- | :- | :- |
| Claude Code CLI có sẵn | `claude --version` | `2.1.31` |
| Repo `.mcp.json` được Claude Code chấp nhận | `claude mcp list` | `cca-coach: ✓ Connected` |
| MCP server hoạt động đúng protocol | `npm --prefix mcp-server run probe` | 16/16 check |
| Hook đúng hợp đồng exit code | `.claude/hooks/test-hooks.sh` | 11/11 check |
| Cấu hình Claude Code hợp lệ | `npm run validate` | 17/17 check |
| API của MCP SDK (v1.32.2) | đọc `.d.ts` trong `node_modules` + chạy thử client | `registerTool`, `registerResource`, `registerPrompt` đúng |
| API của Agent SDK (v0.3.312) | đọc `sdk.d.ts` | `AgentDefinition` cần `description` + `prompt` |

## Điều KHÔNG có nguồn (và vì sao vẫn nằm trong repo)

| Nội dung | Tình trạng |
| :- | :- |
| Blueprint chính thức của kỳ thi CCA-F (domain, trọng số, giá, độ dài) | **Chưa xác minh.** `anthropic.com/certification` trả 404 khi kiểm tra. Cấu trúc 4 tầng trong repo dựa trên sơ đồ người dùng cung cấp + docs công khai, không dựa trên blueprint chính thức. |
| Bốn domain `api-fundamentals`, `agent-design`, `claude-code-config`, `mcp-integration` | **Do repo tự định nghĩa** để chia đều nội dung, ánh xạ 1-1 với 4 tầng. Không phải tên domain chính thức. |
| Đáp án quiz | Do repo tự viết, dựa trên docs ở bảng trên. Mỗi câu đều có `explanation` nêu lý do. |

Khi bạn tìm được blueprint chính thức: cập nhật `DOMAINS` trong
`mcp-server/src/types.ts`, thêm quiz cho domain mới, rồi chạy `audit_kb`.

## Cách thêm nguồn mới

1. Thêm URL hoặc path thật vào `sources` của concept trong `mcp-server/src/knowledge.ts`.
2. Thêm dòng vào bảng trên.
3. Chạy `npm --prefix mcp-server run probe` — probe sẽ fail nếu bạn tạo concept mồ côi
   hoặc domain lệch layer.
