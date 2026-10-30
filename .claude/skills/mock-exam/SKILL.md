---
name: mock-exam
description: Chạy một đề thi thử có tính giờ theo cấu trúc CCA-F, chấm điểm theo từng domain, và xuất báo cáo điểm yếu. Dùng khi user nói "thi thử", "mock exam", "làm đề", hoặc gõ /mock-exam.
argument-hint: "[số câu, mặc định 20]"
disable-model-invocation: false
allowed-tools: Read, Write, Bash(date:*), mcp__cca-coach__generate_quiz, mcp__cca-coach__grade_answer, mcp__cca-coach__score_report
---

# Đề thi thử

Tham số: `$ARGUMENTS` — số câu (mặc định 20).

## Trước khi bắt đầu

Nói rõ luật chơi với user:

- Làm **tuần tự**, không quay lại câu trước.
- Không dùng tài liệu. Không hỏi lại.
- Mỗi câu 90 giây. Hết giờ thì tính là sai.

Ghi `started_at` bằng `date -u +%FT%TZ`.

## Sinh đề

Gọi `generate_quiz` với `count = $ARGUMENTS` (mặc định 20) và `balanced: true` để
trải đều 4 domain. Kiểm tra đề trả về đủ 4 domain; nếu thiếu, sinh bù cho domain thiếu.

## Khi làm bài

Hiển thị **một câu tại một thời điểm**, dạng A/B/C/D. Chờ user trả lời rồi mới sang câu tiếp.
Không tiết lộ đáp án trong lúc làm.

## Chấm

Với mỗi câu, gọi `grade_answer` để lấy kết quả chuẩn (không tự chấm bằng cảm tính),
rồi gọi `score_report` với toàn bộ câu trả lời để lấy điểm theo domain.

## Báo cáo

Xuất báo cáo theo mẫu và ghi vào `docs/mock-exams/YYYY-MM-DD.md`:

```
# Mock exam YYYY-MM-DD

Tổng: <đúng>/<tổng> (<phần trăm>%)
Thời gian: <phút>

| Domain | Đúng | Tổng | % |
| :- | :- | :- | :- |

## Câu sai
- Câu <n> (<domain>): chọn <X>, đúng <Y>. <lý do 1 câu>

## Ưu tiên ôn tập
1. <domain yếu nhất> — <concept id cụ thể>
```

Cuối cùng, đề nghị chạy `/daily-study <layer yếu nhất>` vào buổi kế tiếp.
