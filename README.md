# CCA-F — Claude Certified Architect (Foundations) study repo

Một repo **chạy được** để học kiến trúc Claude, dựng đúng theo sơ đồ:

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

Mỗi nhánh là một thư mục thật, có test thật, không phải mock.

## Trả lời nhanh câu hỏi: dựng bằng Cline được không?

**Được.** Repo này được dựng hoàn toàn bằng Cline. `CLAUDE.md`, rules, skills, hooks,
subagents, `.mcp.json` và MCP server đều là **file trên đĩa** — Cline viết được, và
Claude Code CLI (đã có sẵn trên máy, `2.1.31`) đọc/kiểm tra được mà không cần
subscription.

Điều **cần** subscription hoặc API key chỉ là: để **model chạy** (`/daily-study`,
orchestrator). Việc học kiến trúc và kiểm chứng cấu hình thì không cần.

Chi tiết + bảng đối chiếu Cline ↔ Claude Code: [`docs/cline-vs-claude-code.md`](docs/cline-vs-claude-code.md)

## Bắt đầu trong 60 giây

```bash
npm run setup     # cài deps cho mcp-server + agent-sdk, build cả hai
npm run check     # typecheck + 16 check MCP + 11 check hook + 17 check cấu hình
```

Nếu `npm run check` xanh, cấu trúc Claude Code của bạn **đúng**.

## Trong repo có gì

| Đường dẫn | Tầng | Nội dung |
| :- | :- | :- |
| `CLAUDE.md` | Claude Code | memory luôn bật + bản đồ repo |
| `.claude/rules/` | Claude Code | 3 rule, một cái có `paths:` frontmatter |
| `.claude/skills/` | Claude Code | `daily-study`, `mock-exam` |
| `.claude/agents/` | Claude Code | 4 subagent (reviewer, curator, explainer, driller) |
| `.claude/hooks/` | Claude Code | 3 hook + script test 11 check |
| `.claude/settings.json` | Claude Code | khai báo hook, permission, MCP approval |
| `.mcp.json` | MCP | khai báo MCP server scope project |
| `mcp-server/` | MCP | custom MCP server: 6 tool, 2 resource, 2 prompt, 23 concept / 26 câu quiz |
| `agent-sdk/` | Agent SDK | `query()` + `agents` + `hooks` + `mcpServers` |
| `docs/` | — | kiến trúc, so sánh Cline, lộ trình 30 ngày, nguồn |

## Lệnh

```bash
npm run build          # build mcp-server + agent-sdk
npm run typecheck      # tsc --noEmit cho cả hai
npm run probe          # client thật kiểm tra MCP server (không cần API key)
npm run test:hooks     # kiểm tra hook exit code / stdout (không cần API key)
npm run validate       # kiểm tra cấu hình Claude Code trong repo
npm run check          # tất cả ở trên

npm run agent          # orchestrator, mode tự do    (cần 1 trong 4 nguồn auth)
npm run agent:study    # orchestrator, buổi học      (cần 1 trong 4 nguồn auth)
npm run agent:exam     # orchestrator, đề thi thử    (cần 1 trong 4 nguồn auth)
```

### Xác thực — bốn nguồn, chọn một

| Nguồn | Cách tạo | Yêu cầu |
| :- | :- | :- |
| `/login` | đăng nhập claude.ai | Pro / Max / Team / Enterprise |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` (token 1 năm) | Pro / Max / Team / Enterprise |
| `ANTHROPIC_API_KEY` | Console → API keys | **Không cần subscription**, chỉ cần credit |
| Bedrock / Vertex | env vars của cloud | tài khoản cloud |

Chỉ ba lệnh `agent*` cần auth. `npm run check` (44 check) chạy offline hoàn toàn —
đây là cách học chính nếu bạn chưa nạp credit.

### Chọn model

```bash
ANTHROPIC_MODEL=haiku  npm run agent:exam    # tiết kiệm, prompt nhỏ
ANTHROPIC_MODEL=sonnet npm run agent:study   # hợp suy luận kiến trúc
ANTHROPIC_MODEL=opus   npm run agent         # câu hỏi khó
```

⚠️ Haiku 5.5 có **bậc giá**: prompt vượt 100k token thì input tăng 5x. Sonnet 5.5
không có bậc này và cache read chỉ 5% giá input. Chi tiết + bảng tính:
[`docs/model-choice.md`](docs/model-choice.md)

⚠️ Nếu đã `/login` **và** đặt `ANTHROPIC_API_KEY`, key ghi đè subscription và tính
tiền theo token. Để trống dòng đó trong `.env` nếu muốn dùng subscription.

Và trong Claude Code (nếu có subscription):

```
/daily-study [api|agent-sdk|claude-code|mcp]
/mock-exam [số câu]
```

## MCP server `cca-coach`

| Loại | Tên | Việc |
| :- | :- | :- |
| tool | `list_concepts` | liệt kê concept theo tầng |
| tool | `get_concept` | chi tiết concept + quiz liên quan |
| tool | `generate_quiz` | sinh đề (ẩn đáp án), hỗ trợ `balanced` |
| tool | `grade_answer` | chấm một câu theo đáp án chuẩn |
| tool | `score_report` | điểm theo domain + câu sai |
| tool | `audit_kb` | kiểm tra bất biến của knowledge base |
| resource | `cca://glossary` | toàn bộ concept dạng markdown |
| resource | `cca://domains` | bản đồ domain -> layer |
| prompt | `study-session` | kế hoạch buổi học |
| prompt | `exam-brief` | đề thi thử |

Nội dung nằm ở `mcp-server/src/knowledge.ts` — **nguồn sự thật duy nhất**. Thêm concept
thì phải thêm quiz cùng domain, nếu không `audit_kb` sẽ báo.

## Điều quan trọng nhất cần nhớ

- `CLAUDE.md` và rules là **context**. Hook là **enforcement**. Việc gì buộc phải xảy
  ra thì phải là hook.
- Skill rẻ hơn rule cho nội dung dài: chỉ `name` + `description` nằm sẵn trong context.
- Subagent tồn tại để **cách ly context**, không phải để nhanh/rẻ hơn.
- `stdout` của MCP server stdio **là** kênh JSON-RPC. Log phải đi stderr.
- Agent SDK và CLI dùng **cùng bộ hook event**, khác cơ chế thực thi (callback vs shell).

## Giới hạn trung thực

Blueprint chính thức của kỳ thi **chưa được xác minh** (trang certification của
Anthropic trả 404 khi kiểm tra). Cấu trúc 4 tầng ở đây dựa trên sơ đồ bạn cung cấp và
docs công khai. Xem [`docs/sources.md`](docs/sources.md) để biết chính xác cái gì có
nguồn và cái gì không.

## Đọc tiếp

1. [`docs/architecture.md`](docs/architecture.md) — lý thuyết 4 tầng
2. [`docs/roadmap/README.md`](docs/roadmap/README.md) — lộ trình 4 tuần học theo bản chất kiến trúc
3. [`docs/evaluation-plan.md`](docs/evaluation-plan.md) — kế hoạch đánh giá dự án & năng lực
4. [`docs/cline-vs-claude-code.md`](docs/cline-vs-claude-code.md) — dựng bằng Cline
5. [`docs/roadmap-30-days.md`](docs/roadmap-30-days.md) — checklist 30 ngày
6. [`docs/sources.md`](docs/sources.md) — nguồn
