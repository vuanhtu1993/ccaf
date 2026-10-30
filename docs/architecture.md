# Kiến trúc — bốn tầng, và vì sao chúng tồn tại

Tài liệu này là phần "lý thuyết" của repo. Mỗi mục tương ứng một nhánh trong sơ đồ:

```
Claude API
     │
     ├── Agent SDK
     │      └── Agent + Subagents
     │
     ├── Claude Code
     │      ├── CLAUDE.md
     │      ├── rules
     │      ├── skills
     │      └── hooks
     │
     └── MCP
            └── Custom MCP Server
```

## Câu hỏi gốc: ai viết vòng lặp?

Mọi tầng trong sơ đồ đều gọi cùng một model. Khác biệt duy nhất, và cũng là câu hỏi
xuyên suốt kỳ thi, là **ai viết vòng lặp gọi tool**.

| Tầng | Ai viết tool loop | Ai quyết định quyền | Nơi cấu hình |
| :- | :- | :- | :- |
| Claude API | Bạn | Bạn | code |
| Agent SDK | Claude Code (đóng gói) | Bạn (options + hooks) | code + file |
| Claude Code | Claude Code | Bạn (settings + hooks) | file |
| MCP | Không liên quan — MCP chỉ cung cấp tool | Client quyết định | `.mcp.json` |

Quy tắc ghi nhớ: **càng xuống dưới, càng ít code, càng nhiều cấu hình**.

---

## Tầng 1 — Claude API

Bạn gửi `messages`, nhận về `stop_reason`. Nếu là `tool_use`, bạn phải tự chạy tool
và gửi `tool_result` trở lại. Không có gì tự động.

Hệ quả thiết kế quan trọng nhất: **context là tài nguyên bạn tự quản**. Mọi token
bạn nhét vào request đều tốn ở lượt đó. Đây chính là lý do tầng Claude Code tách
"tri thức luôn bật" khỏi "tri thức nạp theo nhu cầu" — xem mục Claude Code bên dưới.

Trong repo: `docs/architecture.md` (chính file này). Repo không viết client API thô
vì mục tiêu là kiến trúc Claude Code, không phải SDK HTTP.

## Tầng 2 — Agent SDK

Agent SDK = chính agent loop của Claude Code, đóng gói thành thư viện. Bạn gọi
`query({ prompt, options })` và nhận async stream message.

Bốn option quyết định 80% hành vi:

| Option | Ý nghĩa | Bẫy thường gặp |
| :- | :- | :- |
| `settingSources` | file cấu hình nào được nạp | `[]` sẽ tắt luôn `.claude/skills`, `.claude/rules` |
| `agents` | subagent lập trình được | `AgentDefinition` cần `description` + `prompt`, không phải `name` |
| `hooks` | callback TypeScript | cùng event với CLI nhưng trả JSON, không phải shell |
| `mcpServers` | MCP server | phân biệt stdio (process riêng) và in-process |

### Agent + Subagents

Subagent tồn tại để **cách ly context**, không phải để "chạy nhanh hơn". Toàn bộ log,
file, kết quả search nằm trong context window riêng của subagent; hội thoại chính
chỉ nhận bản tóm tắt. Đây là lý do câu trả lời phổ biến "đẩy việc đọc log sang
subagent" đúng, còn "subagent rẻ hơn" sai.

Trong repo: `agent-sdk/src/orchestrator.ts`.

## Tầng 3 — Claude Code

Bốn cơ chế, và đề thi gần như chắc chắn hỏi **khi nào dùng cái nào**:

| Cơ chế | Nạp khi nào | Dùng cho |
| :- | :- | :- |
| `CLAUDE.md` | mọi phiên, luôn luôn | sự thật ngắn, luôn cần |
| `.claude/rules/*.md` | mọi phiên (hoặc theo `paths`) | luật dài hơn, có thể chia theo file |
| `.claude/skills/<n>/SKILL.md` | khi được gọi | quy trình nhiều bước, nội dung dài |
| `.claude/hooks/` | theo event | việc **buộc** phải xảy ra |

### Ranh giới quan trọng nhất

`CLAUDE.md` và rules là **context**, không phải **enforcement**. Claude có thể không
tuân. Nếu điều gì đó phải xảy ra bất kể model quyết định gì — chặn `git push`, chặn
`rm -rf`, validate frontmatter — thì đó là **hook**, không phải rule.

### Hook: ba tầng lồng

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "..." }] }
    ]
  }
}
```

Event -> matcher group -> handler. Handler không chỉ có `command`: còn `http`,
`mcp_tool`, `prompt`, `agent`.

Hợp đồng của command handler:

| Kênh | Ý nghĩa |
| :- | :- |
| stdin | JSON của event (`hook_event_name`, `tool_name`, `tool_input`, ...) |
| stdout | plain text, hoặc **một** object JSON để điều khiển |
| exit 0 | thành công, không quyết định gì |
| exit 2 | **chặn** hành động; stderr là lý do Claude nhìn thấy |
| exit khác | lỗi không chặn |

Với `PreToolUse`, quyết định nằm trong `hookSpecificOutput.permissionDecision`
(`allow` / `deny` / `ask` / `defer`), và khi nhiều hook trả khác nhau thì ưu tiên là
`deny > defer > ask > allow`.

Trong repo: `.claude/settings.json` + `.claude/hooks/*.sh`.

## Tầng 4 — MCP

MCP tách tool ra khỏi tiến trình agent. Tool trở thành một server nói protocol, nên
cùng một server dùng được cho Claude Code, Agent SDK, hay client khác.

Ba primitive: `tool` (model gọi), `resource` (đọc theo URI), `prompt` (template cho
người dùng).

Bốn transport: `stdio`, `http`, `sse`, `ws`. Entry có `url` mà thiếu `type` sẽ bị đọc
là stdio và bị bỏ qua — lỗi cấu hình rất hay gặp.

Ràng buộc sống còn với stdio: **stdout là kênh JSON-RPC**. Một `console.log` là đủ
làm hỏng protocol. Log phải đi stderr.

Trong repo: `mcp-server/src/index.ts`, khai báo ở `.mcp.json` (scope project, commit
được, chia sẻ cho cả team).

---

## Đường đi của một yêu cầu, xuyên bốn tầng

Ví dụ: người dùng gõ `/mock-exam 20`.

1. **Claude Code** nhận slash command, khớp skill `.claude/skills/mock-exam/SKILL.md`,
   nạp thân skill vào context (trước đó chỉ có `name` + `description` trong context).
2. Skill hướng dẫn Claude gọi tool `generate_quiz`. Tool đó **không** nằm trong
   Claude Code — nó ở **MCP server** `cca-coach` khai báo trong `.mcp.json`.
3. **MCP server** chạy ở tiến trình riêng (stdio), trả JSON câu hỏi qua stdout.
4. Claude trả lời từng câu; mỗi câu chấm qua tool `grade_answer`.
5. Nếu chạy qua **Agent SDK**, cùng chuỗi trên nhưng `options.agents` có thể giao
   việc map concept cho subagent `layer-cartographer`, và `options.hooks` chặn lệnh
   nguy hiểm bằng callback TypeScript thay vì shell.
6. Cuối cùng `Stop` hook ghi lại phiên vào `docs/progress.md`.

Mỗi bước trên đều có một file thật trong repo — đó là toàn bộ mục đích của repo này.
