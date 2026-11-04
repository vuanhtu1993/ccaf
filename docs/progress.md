# Nhật ký học tập

> Hook `Stop` tự động ghi mỗi lượt vào file này. Sửa tay thoải mái.
> Hook `SessionStart` đọc 12 dòng cuối để nhắc bạn đang ở đâu.

## Mẫu ghi tay

```
## YYYY-MM-DD — <layer> — <concept id>
- Hiểu: <1 câu>
- Còn yếu: <1 câu>
- Việc tiếp: <1 câu>
```

## 2026-10-29 — bootstrap

- Hiểu: repo dựng xong cấu trúc 4 tầng, `npm run check` xanh (17 cấu hình + 16 MCP + 11 hook).
- Còn yếu: chưa chạy buổi học nào; chưa đối chiếu blueprint chính thức của kỳ thi.
- Việc tiếp: đọc `docs/architecture.md`, rồi làm ngày 1 của `docs/roadmap-30-days.md`.
## 2026-10-30 22:40

- session: `df53bdf0-7ad5-4980-b74e-e16646dd6e3c`

## 2026-10-30 22:46

- session: `1d04b6be-7db4-46d3-a35a-18b816bb2ddb`

## 2026-10-31 13:12

- session: `7dfdd479-6417-4fc3-9fba-57099a2a62e8`


## 2026-10-31 22:43

- session: `ca478a9d-47e0-4ed8-b599-2cb2f2c538a5`
- tóm tắt: Tầng **claude-code** có 10 concept:  | # | ID | Tiêu đề | Tóm tắt | | :- | :- | :- | :- | | 1 | `cc-claude-md` | CLAUDE.md — bộ nhớ luôn bật | Nạp vào đầu mỗi phiên như context, không phải cấu hình cư

## 2026-10-31 22:43

- session: `ca478a9d-47e0-4ed8-b599-2cb2f2c538a5`
- tóm tắt: **Concept 01: CLAUDE.md — bộ nhớ luôn bật** (`cc-claude-md`, tầng Claude Code)  **Tóm tắt:** CLAUDE.md được nạp vào đầu mỗi phiên và đóng vai trò là context, không phải cấu hình cưỡng chế. Việc gì buộ

## 2026-10-31 22:51

- session: `2f5d012c-025c-4247-9af9-44ad23ee709b`
- tóm tắt: Repo hiện có **23 concept**, chia theo 4 tầng:  **Claude API (3)** | ID | Tiêu đề | | :- | :- | | `api-tool-loop` | Tool loop do bạn tự viết | | `api-stop-reason` | stop_reason quyết định vòng lặp | |

## 2026-10-31 22:52

- session: `2f5d012c-025c-4247-9af9-44ad23ee709b`
- tóm tắt: ## Tool loop do bạn tự viết (`api-tool-loop`)  **Ý chính:** khi gọi Claude API trực tiếp, API **không tự chạy tool** cho bạn. Code của bạn phải tự điều khiển vòng lặp.  ### Các bước trong vòng lặp  1.

## 2026-10-31 23:19

- session: `31aea4d7-d922-426f-afa0-ee4bf83ba796`
- tóm tắt: Your subagents are loaded. `/list-agents` lists **running** instances (live subagents, teammates, and other Claude sessions), not configured definitions. Right now nothing is running, so it reports no

## 2026-10-31 23:21

- session: `31aea4d7-d922-426f-afa0-ee4bf83ba796`
- tóm tắt: I've started the `architecture-reviewer` subagent on the review. It runs in the background, and I'll report its findings when it finishes. It's read-only, so it won't change any files.  It's checking 

## 2026-10-31 23:21

- session: `31aea4d7-d922-426f-afa0-ee4bf83ba796`
- tóm tắt: Subagent `architecture-reviewer` hit its 5-turn limit (`maxTurns: 5`) and returned no report. I did the review directly instead. Overall the repo follows the four-layer structure. Three items need att

## 2026-11-03 17:13

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tôi đã tạo 3 slash command dự án trong `.claude/commands/`:  - **`/check`**: chạy `npm run check` (kiểm thử offline, không cần key) và tóm tắt số check pass/fail. - **`/build-mcp`**: chạy `npm --prefi

## 2026-11-03 17:17

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Đã đặt auto làm chế độ mặc định, và đã kiểm tra lại file vẫn parse được.  **Đã thay đổi** - `~/.claude/settings.json`: thêm `"defaultMode": "auto"` vào khối `permissions`. Có hiệu lực ở mọi dự án. Nếu

## 2026-11-03 17:18

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tất cả kiểm thử đều pass, không có lỗi và không có cảnh báo.  | Bước | Kết quả | |---|---| | `probe` (MCP server) | 16/16 pass | | `test:hooks` | 13/13 pass | | `validate` (cấu hình Claude Code) | 21/

## 2026-11-04 08:48

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: **Rules** và **hooks** là hai cơ chế khác nhau:  - **Rule** (`.claude/rules/*.md`) là chỉ dẫn để Claude đọc và tuân theo. Nó nằm trong context. Claude có thể quên hoặc bỏ qua. - **Hook** (`.claude/hoo

## 2026-11-04 08:52

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Không có thứ tự ưu tiên chính thức giữa `CLAUDE.md` và `.claude/rules/`. Cả hai đều được nạp như chỉ dẫn của người dùng, cùng mức trọng lượng. Claude Code không tài liệu hóa một bảng xếp hạng nào giữa

## 2026-11-04 10:33

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Không phải mọi thứ trong repo này đều là agent system. Hai khái niệm này khác nhau ở **ai quyết định bước tiếp theo**.  - **Deterministic workflow (quy trình xác định)**: các bước và thứ tự được lập t

## 2026-11-04 10:37

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Chưa hoàn toàn đúng. File `.md` không định nghĩa workflow hay agent theo nghĩa kỹ thuật. Nó chỉ là chỉ dẫn mà Claude đọc và làm theo. Cách phân biệt hợp lý hơn là **ai giữ quyền điều khiển luồng**:  -

## 2026-11-04 11:02

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Có hai cách chính: chạy Claude Code ở chế độ không tương tác (`claude -p`) trong script, hoặc dùng GitHub Action chính thức `anthropics/claude-code-action`. Cả hai đều cần một lần thiết lập xác thực v

## 2026-11-04 11:05

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Đúng, GitHub Actions runner là tiến trình gọi Claude. Key phải nằm trong **GitHub Secrets** của repo, không nằm trong code.  **Đặt key ở đâu**  1. Vào repo trên GitHub: **Settings → Secrets and variab

## 2026-11-04 11:09

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tôi đã tạo `.github/workflows/ci.yml`, có hai job. File đã được kiểm tra là YAML hợp lệ. Chưa commit, chưa push và chưa chạy trên GitHub.  **Job `check` (bắt buộc, không cần key)** - Chạy trên mỗi PR 

## 2026-11-04 11:13

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Không bắt buộc phải có `--bare`. Thiếu nó thì không gây lỗi, nhưng có vài hệ quả trong CI.  `--bare` tắt các thứ mà runner không cần: - hook trong settings và plugin - tự động tìm `CLAUDE.md` - auto-m

## 2026-11-04 13:29

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Có, chạy `claude -p` ở local được, và dùng đúng cách như trong CI. Bạn không cần tạo key mới để thử.  **Cách 1: dùng subscription (không cần key)**  Nếu bạn đã `/login` bằng tài khoản Pro, Max, Team h

## 2026-11-04 13:32

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Prompt hiện tại chưa tốt. Nó đủ để thử, nhưng sẽ kém khi PR lớn hoặc có nhiều lỗi.  **Điểm yếu của prompt hiện tại**  - **Không giới hạn số lượng.** Nếu có 50 lỗi, Claude sẽ liệt kê cả 50, log dài, kh

## 2026-11-04 13:40

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tin nhắn của bạn dừng ở "đánh giá prompt sau:" và chưa có nội dung prompt. Bạn gửi lại prompt cần đánh giá nhé. Tôi sẽ chấm theo các tiêu chí đã dùng cho prompt trong `ci.yml`: giới hạn số lượng, định

## 2026-11-04 13:40

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Prompt này tốt hơn bản trong `ci.yml` ở nhiều điểm, nhất là phần lọc nhiễu và phần chống báo sai. Nhưng khi đưa vào CI của repo này, nó còn thiếu vài thứ.  **Điểm mạnh** - **Phạm vi rõ.** Chỉ báo lỗi 

## 2026-11-04 13:42

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tôi đã chỉnh `.github/workflows/ci.yml`. YAML và cú pháp shell của bước review đều hợp lệ. Chưa commit, chưa chạy trên GitHub.  **Thay đổi trong bước `Chạy review`**  - **Shell tự lấy diff** vào `revi

## 2026-11-04 14:05

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Tôi đã thêm few-shot vào prompt trong `ci.yml`. YAML và cú pháp shell của bước review đều hợp lệ. Chưa chạy trên GitHub.  **Điều bạn cần biết trước**  Khi đọc lại file, tôi thấy khối `PROMPT=...` và b

## 2026-11-04 14:11

- session: `83206def-9b37-4109-8170-279c1a2e2bd0`
- tóm tắt: Hôm nay, tốn token nhất là **một session dài trên máy này**, không phải một tác vụ đơn lẻ. Dữ liệu lấy từ transcript cục bộ.  **Tổng hợp hôm nay (session `83206def…`)**  | Chỉ số | Giá trị | |---|---|

## 2026-11-04 14:36

- session: `6a3dfbfa-8caa-4207-82a8-4baa9909c0a1`
- tóm tắt: **Ngắn gọn: nên giữ cách hiện tại (`--json-schema` của `claude -p`), không đổi sang tool_use.** Bạn vẫn cần ràng buộc đầu ra bằng JSON Schema, nhưng cơ chế nên khớp với việc review cần làm.  **Vì sao 

