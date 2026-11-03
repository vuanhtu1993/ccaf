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

