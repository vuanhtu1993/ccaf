# CCA-F — Claude Certified Architect (Foundations) Study Repo

Repo này là một **bản đồ sống** của kiến trúc Claude: mỗi tầng trong sơ đồ dưới đây
tương ứng với một thư mục thật, chạy được, trong repo này. Mục tiêu: học bằng cách
dựng và vận hành, không chỉ đọc docs.

```
Claude API
     │
     ├── Agent SDK          -> agent-sdk/
     │      └── Agent + Subagents  -> agent-sdk/src/*, .claude/agents/
     │
     ├── Claude Code        -> .claude/, CLAUDE.md
     │      ├── CLAUDE.md   -> CLAUDE.md, .claude/rules/
     │      ├── rules       -> .claude/rules/
     │      ├── skills      -> .claude/skills/
     │      └── hooks       -> .claude/hooks/ + .claude/settings.json
     │
     └── MCP                -> .mcp.json
            └── Custom MCP Server  -> mcp-server/
```

## Bản đồ thư mục

| Tầng | Đường dẫn | Ghi chú |
| :- | :- | :- |
| Memory / instructions | `CLAUDE.md`, `.claude/rules/*.md` | rules có `paths:` frontmatter thì chỉ load khi làm việc với file khớp glob |
| Subagents | `.claude/agents/*.md` | frontmatter bắt buộc: `name`, `description` |
| Skills | `.claude/skills/<name>/SKILL.md` | `name` phải khớp tên thư mục |
| Hooks | `.claude/settings.json` + `.claude/hooks/*.sh` | script nhận JSON qua stdin, điều khiển bằng exit code / stdout JSON |
| MCP (project scope) | `.mcp.json` | Claude Code hỏi approve lần đầu, hoặc set `enableAllProjectMcpServers` |
| Custom MCP server | `mcp-server/` | TypeScript, stdio transport, build ra `dist/index.js` |
| Agent SDK | `agent-sdk/` | `query()`, option `agents`, `hooks`, `mcpServers` |

## Lệnh chuẩn của repo

```bash
# Build MCP server (Claude Code cần dist/, không tự biên dịch TS)
npm --prefix mcp-server run build

# Kiểm thử offline — KHÔNG cần credit, KHÔNG cần key (44 check)
npm run check

# Kiểm tra cấu hình Claude Code trong repo
claude mcp list
```

## Xác thực: bốn nguồn, chọn một

| Nguồn | Cách tạo | Yêu cầu |
| :- | :- | :- |
| `/login` | đăng nhập claude.ai | Pro / Max / Team / Enterprise |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` (token 1 năm) | Pro / Max / Team / Enterprise |
| `ANTHROPIC_API_KEY` | Console → API keys | **Không cần subscription**, chỉ cần credit |
| Bedrock / Vertex | env vars của cloud | tài khoản cloud |

Chỉ `npm --prefix agent-sdk run start` mới cần một trong bốn nguồn trên.
`npm run check` chạy hoàn toàn offline.

⚠️ Nếu bạn đã `/login` **và** đặt `ANTHROPIC_API_KEY`, key sẽ ghi đè subscription
và bị tính tiền theo token.

## Quy ước khi sửa repo này

- Không commit `.env`, `dist/`, `node_modules/`.
- Mọi kiến thức thêm vào phải có nguồn: `docs/` hoặc link docs chính thức trong `docs/sources.md`.
- Hook script phải idempotent và không được chặn luồng khi thiếu `jq`.
- Khi thêm một khái niệm mới, thêm cả **concept card** (`mcp-server/src/knowledge.ts`)
  và **câu hỏi quiz** cùng domain — để mock exam luôn phủ kịp nội dung đã học.

## Ngôn ngữ

Trao đổi và ghi chú bằng tiếng Việt; tên file, tên tool, frontmatter và code giữ tiếng Anh.
