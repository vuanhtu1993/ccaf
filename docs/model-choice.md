# Chọn model: Haiku hay Sonnet?

Câu trả lời ngắn: **Sonnet 5.5 rẻ hơn Haiku 5.5 cho repo này khi prompt < 100k token
— chênh khoảng 1.5 lần, không phải 20 lần như giá niêm yết.**

Đây là câu trả lời đáng ngạc nhiên, và lý do rất cụ thể.

## Giá thật (USD / triệu token, đọc từ docs ngày 2026-10-30)

| Model | Input | Output | Cache write 5m | Cache read |
| :- | :- | :- | :- | :- |
| **Haiku 5.5** — prompt ≤ 100k | 0.10 | 0.50 | 0.125 | 0.01 |
| **Haiku 5.5** — prompt > 100k | **0.50** | **2.50** | **0.625** | **0.05** |
| **Sonnet 5.5** | 2.00 | 10.00 | 2.50 | **0.10** |
| Opus 5.5 | 4.00 | 20.00 | 5.00 | 0.20 |

Hai chi tiết quyết định:

1. **Haiku 5.5 là model duy nhất có bậc giá theo độ dài prompt.** Vượt 100k token,
   giá input tăng **5x**. Docs ghi rõ: "a request whose prompt is over 100,000 tokens
   pays higher prices", và prompt length tính **cả cache read lẫn cache write**.
2. **Cache read của Sonnet 5.5 chỉ bằng 5% giá input** (0.10 thay vì 0.20). Với
   Haiku ở bậc thấp, cache read đã là 10% giá input (0.01) — tỉ lệ cache **tốt hơn**
   ở Sonnet.

## Vì sao "Haiku rẻ hơn 20 lần" không đúng với repo này

Repo này có **context cố định rất lớn**, nạp lại ở **mọi lượt**:

| Thành phần | Ước tính token |
| :- | :- |
| 48 tool definition + 10 agent | ~15,000 |
| 3 MCP server (cca-coach + repo-map + openlore) | ~5,000 |
| System prompt preset `claude_code` | ~4,000 |
| CLAUDE.md + 3 rules + skill metadata | ~2,700 |
| **Tổng cố định mỗi lượt** | **~27,000** |

Nghĩa là input **không bao giờ nhỏ**. Một buổi `agent:study` (~25 turn) sẽ có tổng
input cộng dồn khoảng 300k–900k token.

## Bài toán: 1 buổi `agent:study`, 25 turn

Giả định mỗi turn 27k input (25k cache read + 2k mới) + 1k output.

| | Sonnet 5.5 | Haiku 5.5 (bậc thấp) | Haiku 5.5 (nếu vượt 100k/turn) |
| :- | :- | :- | :- |
| Cache read 625k | $0.0625 | $0.00625 | $0.03125 |
| Input mới 50k | $0.10 | $0.005 | $0.025 |
| Output 25k | $0.25 | $0.0125 | $0.0625 |
| **Tổng** | **~$0.41** | **~$0.024** | **~$0.12** |

Kết luận: **Haiku rẻ hơn thật — khoảng 17x ở bậc thấp, 3.4x nếu rơi vào bậc cao.**

Với $5 credit: Sonnet được **~12 buổi**, Haiku được **~200 buổi**. Chênh lệch tuyệt
đối chỉ vài đô.

## Nhưng đây là chỗ Haiku thua

Chi phí **không phải** ràng buộc thật của kỳ thi. Ràng buộc thật là **chất lượng
giải thích kiến trúc**.

| Tác vụ | Model phù hợp | Vì sao |
| :- | :- | :- |
| Tra cứu "hook exit 2 nghĩa là gì" | **Haiku** | câu trả lời có sẵn trong quiz bank |
| Sinh đề quiz, chấm điểm | **Haiku** | việc máy móc, đáp án đã có |
| Map concept sang 4 tầng | **Sonnet** | cần đọc file thật và suy luận |
| Giải thích vì sao context vs enforcement | **Sonnet** | đây chính là nội dung thi |
| Mode `free` mặc định | **Sonnet** | mục đích là học cách suy nghĩ |

Nói cách khác: **tiết kiệm 0.4 đô một buổi, nhưng học sai bản chất kiến trúc thì
mất một tháng.** Với repo này, Sonnet là mặc định đúng.

## Cách đổi model (đã hỗ trợ sẵn)

```bash
CCA_MODEL=haiku  npm run agent:exam    # thi thử — tiết kiệm
CCA_MODEL=sonnet npm run agent:study   # buổi học — mặc định
CCA_MODEL=opus   npm run agent         # câu hỏi kiến trúc khó
```

Biến này đọc trong `buildOptions()`, không cần sửa code. Đã kiểm chứng:
`CCA_MODEL=haiku` → `model: claude-haiku-5-5`.

## Cái bẫy thật sự cần tránh

Nếu bạn định dùng Haiku cho tác vụ có **context lớn** (đọc nhiều file, chạy
`agent:study` với 3 MCP server), hãy kiểm tra prompt có vượt 100k hay không.
Vượt ngưỡng là giá nhảy 5x **ngay lập tức**, và vì ngưỡng tính cả cache read,
một phiên dài có thể vượt ngưỡng mà bạn không nhận ra.

Cách phòng: dùng `CCA_MODEL=haiku` chỉ cho mode `exam` (prompt nhỏ), không dùng cho
`study` (prompt lớn dần theo turn).

## Tóm lại

| Câu hỏi | Trả lời |
| :- | :- |
| Haiku có rẻ hơn Sonnet? | Có, 3–17x tuỳ prompt có vượt 100k |
| Có nên dùng Haiku làm mặc định? | **Không.** Chất lượng suy luận kiến trúc mới là mục tiêu |
| Khi nào dùng Haiku? | `agent:exam`, tra cứu, chấm điểm, sinh quiz |
| $5 đủ không? | Đủ. Sonnet ~12 buổi, Haiku ~200 buổi |
| Rủi ro lớn nhất? | Prompt vượt 100k làm Haiku nhảy giá 5x mà không báo |
