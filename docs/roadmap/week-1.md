# Tuần 1: Quản trị Bộ nhớ & Ranh giới Cưỡng chế
*(Week 1: Context Governance & Enforcement Boundary)*

> **Mục tiêu cốt lõi**: Thấu hiểu bản chất ranh giới giữa **Ngữ cảnh (Context)** và **Cưỡng chế (Enforcement)** trong hệ thống Claude; làm chủ cơ chế quản trị bộ nhớ để không làm tràn cửa sổ ngữ cảnh (Context Window) và thiết lập hàng rào bảo vệ tất định bằng Hook.

---

## 1. Câu hỏi Cội rễ (Core Inquiry)

> *"Tại sao bạn viết luật cấm xoá file trong `CLAUDE.md` hay System Prompt mà Claude vẫn có thể làm trái khi gặp tình huống phức tạp? Và làm sao để kiểm soát một hành vi buộc phải xảy ra 100%?"*

### Phân tích Lịch sử & Nguyên nhân Gốc rễ (Root Cause Analysis)
* **Quá khứ**: Lập trình viên cố gắng bảo vệ hệ thống bằng cách viết các câu lệnh nghiêm cấm trong Prompt (ví dụ: *"Bạn tuyệt đối không được chạy rm -rf hoặc sửa file database"*).
* **Thất bại thực tế**: LLM là mô hình tính toán xác suất (Probabilistic Engine), không phải là hệ thống logic tất định (Deterministic Engine). Khi gặp prompt injection, tài liệu dài gây phân tán chú ý (Lost in the Middle), hoặc ngữ cảnh mơ hồ, mô hình vẫn sinh ra lệnh gọi tool nguy hiểm.
* **Giải pháp của Claude Code**: Tách rời hoàn toàn hai khái niệm:
  - **Context (Ngữ cảnh)**: Cung cấp hiểu biết để Claude ra quyết định đúng (`CLAUDE.md`, `.claude/rules/`, `.claude/skills/`).
  - **Enforcement (Cưỡng chế)**: Quyền lực tuyệt đối của hệ điều hành thông qua Hook (`.claude/hooks/`), chạy trước khi mô hình kịp chạm vào file.

---

## 2. Giải phẫu Khái niệm & Cơ chế Vận hành Ngầm

### 2.1. Bản đồ Phân cấp Bộ nhớ (Memory Hierarchy)

```
                            CỬA SỔ NGỮ CẢNH (CONTEXT BUDGET)
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │ CLAUDE.md              -> Nạp 100% mọi phiên, luôn bật. Phải CỰC KỲ NGẮN GỌN.    │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ .claude/rules/*.md     -> Không có paths: nạp mọi phiên.                        │
  │                           Có paths (glob): CHỈ nạp khi đọc/sửa file khớp mẫu.   │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ .claude/skills/*/      -> Nạp 'name' + 'description' vào context ban đầu.       │
  │                           Nội dung nạp khi user gõ slash HOẶC khi model tự gọi. │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ .claude/hooks/         -> KHÔNG NẰM TRONG CONTEXT. Chạy độc lập ở tầng OS.       │
  └─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Hợp đồng Hook (Hook Contract)

Hook hoạt động như một tiến trình con (Child Process) giao tiếp qua luồng dữ liệu chuẩn của Unix:
1. **Đầu vào (`stdin`)**: Nhận một payload JSON chứa chi tiết sự kiện (`hook_event_name`, `tool_name`, `tool_input`, `session_id`).
2. **Quyết định qua Exit Code**:
   - `exit 0`: Thành công, cho phép tiếp tục luồng. Nếu script in một chuỗi JSON hợp lệ ra `stdout` (ví dụ: `{"decision": "allow"}`), Claude Code có thể đọc các chỉ thị có cấu trúc này để bổ sung ngữ cảnh hoặc can thiệp tham số.
   - `exit 2`: **CHẶN ĐỨNG HÀNH VI (BLOCK)**. Toàn bộ thông điệp in ra `stderr` sẽ được chuyển thành lý do chặn để Claude biết nguyên nhân và điều chỉnh hành vi.
   - `exit khác`: Báo lỗi thực thi script hook nhưng mặc định không chặn thao tác (fail-open).
3. **Quy tắc ưu tiên khi nhiều hook cùng chạy**:
   $$\text{deny} > \text{ask} > \text{allow}$$
   *(Nếu một hook chặn `deny`, thao tác sẽ dừng ngay lập tức bất kể các hook khác cho phép)*

---

## 3. Các Bài Lab Thực nghiệm Chứng minh (Hands-on Proofs)

### 🧪 Lab 1.1: Chứng minh Sự Khác biệt giữa Rule và Hook
* **Mục tiêu**: Thấy rõ tại sao Rule chỉ là hướng dẫn, còn Hook mới là bảo vệ thật.
* **Thực hành**:
  1. Mở file [`.claude/hooks/guard-dangerous.sh`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/.claude/hooks/guard-dangerous.sh).
  2. Quan sát đoạn script bắt lệnh nguy hiểm:
     ```bash
     if echo "$COMMAND" | grep -Eq '(^|[[:space:]])rm[[:space:]]+-rf[[:space:]]+(/|~)'; then
       echo "Chặn lệnh nguy hiểm: $COMMAND" >&2
       exit 2
     fi
     ```
  3. Chạy bài test mô phỏng để thấy phản ứng:
     ```bash
     .claude/hooks/test-hooks.sh
     ```
  4. **Quan sát**: Khi có lệnh `rm -rf /`, script lập tức trả về `exit 2` và in cảnh báo ra `stderr`. Lệnh không bao giờ có cơ hội thực thi.

### 🧪 Lab 1.2: Tiết kiệm Ngân sách Ngữ cảnh bằng `paths:` Frontmatter
* **Mục tiêu**: Chứng minh việc chỉ nạp rule khi cần thiết giúp tiết kiệm token.
* **Thực hành**:
  1. Mở file [`.claude/rules/typescript.md`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/.claude/rules/typescript.md).
  2. Quan sát phần header YAML frontmatter:
     ```markdown
     ---
     paths:
       - "mcp-server/src/**/*.ts"
       - "agent-sdk/src/**/*.ts"
     ---
     ```
  3. **Phân tích**: Nếu bạn đang sửa file `README.md` hoặc `docs/architecture.md`, toàn bộ nội dung của rule này **hoàn toàn không được nạp vào context**, giúp tiết kiệm hàng trăm token mỗi lượt chat.

---

## 4. Phân tích Đánh đổi Kỹ thuật (Architectural Trade-offs)

| Giải Pháp | Ưu Điểm (Trade-off +) | Nhược Điểm (Trade-off -) | Khi Nào Sử Dụng? |
| :--- | :--- | :--- | :--- |
| **Ghi vào `CLAUDE.md`** | Dễ viết, Claude luôn nhớ trong mọi câu hỏi, không cần setup phức tạp. | Tốn token vĩnh viễn ở mọi lượt; nếu viết dài sẽ gây suy giảm trí nhớ của mô hình. | Quy ước tối quan trọng của dự án (Lệnh build, quy ước ngôn ngữ, cấu trúc thư mục). |
| **Đóng gói vào `Skill`** | Siêu tiết kiệm token (chỉ nạp 2 dòng mô tả ban đầu); hỗ trợ quy trình nhiều bước phức tạp. | Không tự động kích hoạt trừ khi người dùng gọi hoặc mô hình quyết định gọi skill. | Quy trình tuần tự, cẩm nang tra cứu, kịch bản thi thử (`mock-exam`, `daily-study`). |
| **Viết Script `Hook`** | Cưỡng chế 100% tất định; bảo vệ an toàn tuyệt đối cho filesystem và git. | Phải viết code shell/TS; cần kiểm thử cẩn thận; làm tăng thêm một chút latency trước mỗi tool call. | Chặn lệnh xoá dữ liệu, cấm push force, validate định dạng frontmatter, ghi log phiên. |

---

## 5. Câu hỏi Tự vấn Bản chất (Self-reflection Questions)

Trước khi chuyển sang Tuần 2, hãy tự trả lời ngắn gọn (1-2 câu):
1. *Tại sao rule có `paths:` lại bắt buộc phải đặt ở thư mục `.claude/rules/` mà không thể đặt trong `CLAUDE.md`?*
2. *Nếu hook `PreToolUse` in một thông báo lỗi ra `stdout` thay vì `stderr`, điều gì sẽ xảy ra?*
3. *Sự khác nhau cơ bản giữa `exit 0` và `exit 2` trong hợp đồng của Claude Code Hook là gì?*

---

## 6. Tiêu chuẩn Nghiệm thu Đầu ra Tuần 1 (Weekly Sign-off Gate)

Bạn đã hoàn thành Tuần 1 khi:
- [x] Đọc và hiểu toàn bộ mã nguồn của [`.claude/settings.json`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/.claude/settings.json) và 3 hook scripts.
- [x] Lệnh kiểm tra hook đạt chuẩn 100%:
  ```bash
  npm run test:hooks
  ```
  *(Kết quả: `Hook test PASS — 11/11`)*
- [x] Lệnh thẩm định cấu hình đạt chuẩn 100%:
  ```bash
  npm run validate
  ```
  *(Kết quả: `PASS — 20 check, 0 cảnh báo`)*

👉 **Chuyển sang [Tuần 2: Giao thức Công cụ & Cách ly Ngữ cảnh (MCP & Subagents)](week-2.md)**

---
*Made by Anh Tu - Share to be share*
