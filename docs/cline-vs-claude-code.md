# Dùng Cline để dựng và luyện cấu trúc Claude Code

Trả lời trực tiếp câu hỏi: **có, được** — và repo này chính là bằng chứng. Toàn bộ
repo được tạo bằng Cline, và mọi file đều đã được validate bằng Claude Code CLI
có sẵn trên máy.

## Vì sao được

Ba sự thật kỹ thuật, không phải suy đoán:

1. **Bài thi kiểm tra kiến thức về file và cấu hình, không kiểm tra bạn mua gói nào.**
   `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/hooks/`, `.claude/agents/`,
   `.mcp.json` đều là **file trên đĩa**. Bạn viết chúng bằng bất kỳ editor nào.
2. **Claude Code CLI đã có sẵn trên máy bạn** (`claude --version` -> `2.1.31`). CLI là
   thứ đọc các file đó, kiểm tra chúng, và chạy chúng. Bạn không cần subscription để
   *cấu trúc* đúng; bạn cần subscription (hoặc API key) để *model chạy*. Đây là hai
   việc khác nhau.
3. **Phần lớn việc học không cần model trả lời.** Viết hook, viết MCP server, thiết kế
   skill, quyết định đặt kiến thức ở tầng nào — tất cả đều kiểm chứng được offline.

## Bảng đối chiếu cơ chế

| Khái niệm Claude Code | Tương đương ở Cline | Ghi chú |
| :- | :- | :- |
| `CLAUDE.md` | `.clinerules/`, `.cline/rules/`, `AGENTS.md` | Cline đọc được cả `AGENTS.md` chuẩn chung |
| `.claude/rules/x.md` | `.clinerules/x.md` với frontmatter `paths:` | Cùng ý tưởng path-scoped |
| `.claude/skills/<n>/SKILL.md` | `.cline/skills/<n>/SKILL.md` (project) hoặc `~/.cline/skills/` | Cùng chuẩn `SKILL.md`, cùng frontmatter `name` + `description` |
| `.claude/agents/*.md` (subagent) | Cline có Agent Teams / subagents | Không cùng định dạng file — đây là chỗ **phải học riêng** |
| `.claude/settings.json` hooks | Cline Hooks được khai báo qua **plugin SDK** (`beforeTool`, `afterTool`, ...) | Khác cơ chế: Cline dùng JS/TS plugin, Claude Code dùng JSON + shell command |
| `.mcp.json` | Cline cũng hỗ trợ MCP | Cùng giao thức — cấu hình gần như giống nhau |
| Slash command | Cline cũng dùng `/` cho skill | Tương đương |

**Kết luận thực dụng:** Cline dựng được 4/7 mục y hệt (rules, skills, MCP, CLAUDE.md),
2/7 gần giống (hooks, slash command), 1/7 khác hẳn (subagent frontmatter). Phần khác
hẳn là phần bạn phải học nghiêm túc — và nó cũng là phần đề thi hay hỏi.

## Ba thứ Cline LÀM ĐƯỢC mà không cần gì thêm

1. **Viết toàn bộ file cấu hình.** Đây là điều Cline vừa làm trong repo này.
2. **Chạy `claude mcp list`** — Claude Code CLI thật, kiểm tra MCP server thật.
   Kết quả trên máy bạn: `cca-coach: ✓ Connected`.
3. **Chạy test tự viết** — `npm run check` kiểm tra 17 invariant của cấu hình và 16
   check của MCP server, không tốn một token nào.

## Ba thứ CẦN subscription hoặc API key

1. Chạy `/daily-study` hay `/mock-exam` **trong Claude Code** (cần model).
2. Chạy `agent-sdk` orchestrator (cần auth).
3. Xem Claude tự chọn subagent nào khi bạn giao việc (hành vi runtime).

"Auth" ở đây là **một trong bốn** nguồn, không riêng API key:

| Nguồn | Yêu cầu |
| :- | :- |
| `/login` (claude.ai) | subscription Pro / Max / Team / Enterprise |
| `CLAUDE_CODE_OAUTH_TOKEN` | cũng cần subscription ở trên |
| `ANTHROPIC_API_KEY` | **không cần subscription** — chỉ cần credit |
| Bedrock / Vertex | tài khoản cloud |

Với người không có subscription, `ANTHROPIC_API_KEY` là đường duy nhất. Nhưng lưu ý:
key hợp lệ **vẫn chưa đủ** — tài khoản phải có credit. Kiểm tra bằng
`GET /v1/models` (miễn phí, trả 200 nếu key đúng) rồi `POST /v1/messages`
(trả lỗi `credit balance is too low` nếu chưa nạp).

## Cách luyện đúng khi không có subscription

**Bước 1 — Kiểm chứng cấu trúc (miễn phí, làm được ngay hôm nay)**

```bash
npm run check
```

Nếu 17 check cấu hình + 16 check MCP đều pass, cấu trúc của bạn **đúng** theo nghĩa
Claude Code sẽ đọc được. Đây là điều bài thi kiểm tra.

**Bước 2 — Luyện thi bằng chính MCP server (miễn phí)**

```bash
npm --prefix mcp-server run probe     # 16 check
```

Và dùng Cline để hỏi chính MCP server thay vì hỏi model:

- "Gọi `generate_quiz` count 10 balanced, rồi đọc kết quả trong file."
- "Gọi `audit_kb` và giải thích từng invariant."

Cline (hoặc bất kỳ MCP client nào) gọi được server này. Câu hỏi và đáp án nằm trong
`mcp-server/src/knowledge.ts` — bạn học từ **nguồn sự thật**, không từ model có thể
bịa.

**Bước 3 — Dùng API key trả theo token cho những buổi cần model**

Không cần subscription. Một key trả theo usage đủ cho:
`agent-sdk` orchestrator, hoặc `claude -p "..."` một lần.

**Bước 4 — Chỉ mua subscription khi bạn cần nhịp luyện hằng ngày**

Giá trị thật của subscription là **số lượt**, không phải kiến thức. Nếu bạn luyện
bằng Cline + MCP server ở trên, bạn đã có 80% giá trị.

## Cảnh báo trung thực

- Tôi **không xác minh được** nội dung chính thức của kỳ thi CCA-F (blueprint, trọng
  số domain, giá, độ dài). Trang `anthropic.com/certification` trả 404 tại thời điểm
  kiểm tra. Cấu trúc 4 tầng trong repo này dựa trên **sơ đồ bạn cung cấp** và tài liệu
  công khai của Anthropic, **không** dựa trên blueprint chính thức. Hãy đối chiếu với
  nguồn chính thức trước khi thi.
- Repo dùng Claude Code **v2.1.31** (bản trên máy bạn). Một số tính năng mới hơn
  (`claude plugin validate` cho thư mục agents, `--add-dir` skill resolution) cần
  bản cao hơn. Repo có script validate riêng để không phụ thuộc version.

## Việc nên làm tiếp

1. `npm run setup` rồi `npm run check` — xác nhận môi trường.
2. Đọc `docs/architecture.md`, đối chiếu từng mục với file thật.
3. Làm theo `docs/roadmap-30-days.md`.
4. Trước khi thi: kiểm tra blueprint chính thức, rồi dùng quiz bank để bù phần lệch.
