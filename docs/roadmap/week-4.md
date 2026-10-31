# Tuần 4: Quản trị Hệ thống, Phòng thủ Đa tầng & Sát hạch Kiến trúc sư
*(Week 4: Defense-in-Depth, Token Economics & Certification Benchmark)*

> **Mục tiêu cốt lõi**: Tổng hợp tri thức toàn bộ 4 tầng kiến trúc; làm chủ nguyên lý **Phòng thủ Đa tầng (Defense-in-Depth)** và **Kinh tế học Token (Token Economics & Caching)**; vượt qua các bài diễn tập tiêm lỗi (Failure Injection) và hoàn thành bài thi mô phỏng Mock Exam đạt chuẩn chứng chỉ CCA-F.

---

## 1. Câu hỏi Cội rễ (Core Inquiry)

> *"Tại sao một hệ thống AI chạy thử nghiệm cá nhân rất tốt nhưng khi đưa vào Production lại nhanh chóng cạn kiệt ngân sách hoặc gây ra lỗ hổng bảo mật nghiêm trọng? Và làm thế nào để chứng minh một kỹ sư đã đủ năng lực là Claude Certified Architect?"*

### Phân tích Lịch sử & Nguyên nhân Gốc rễ (Root Cause Analysis)
* **Ảo tưởng Demo (The Prototype Fallacy)**: Khi xây dựng sản phẩm mẫu (POC), lập trình viên thường dùng prompt ngắn, dữ liệu ít, và tự mình làm người dùng có ý thức tốt. Hệ thống trông có vẻ hoàn hảo.
* **Thực tế Production**:
  1. **Bẫy Chi Phí Token (Token Drain)**: Sử dụng mô hình năng lực cao cho mọi tác vụ nhỏ, thiếu phân tầng nhiệm vụ (Model Tiering), và không tận dụng Prompt Caching (tiết kiệm đến 90% chi phí đọc lại prompt tĩnh dài), dẫn đến hóa đơn API tăng đột biến hàng nghìn USD.
  2. **Tấn công Đa tầng (Multi-layer Exploits)**: Hacker dùng các kỹ thuật prompt injection phức tạp qua nhiều lượt (Multi-turn Jailbreak) để đánh lừa mô hình bỏ qua các hướng dẫn an toàn trong system prompt.
* **Giải pháp của Kiến trúc sư Claude**: Thiết lập chiến lược **Phòng thủ Đa tầng (Defense-in-Depth)**: Không tin tưởng tuyệt đối vào bất kỳ tầng đơn lẻ nào. Kết hợp chặt chẽ: Định hướng ngữ cảnh -> Giới hạn quyền Tool -> Chốt chặn Hook OS -> Ghi log hậu kiểm.

---

## 2. Giải phẫu Khái niệm & Cơ chế Vận hành Ngầm

### 2.1. Mô hình Phòng thủ Đa tầng (Defense-in-Depth Architecture)

```
                       CHIẾN LƯỢC PHÒNG THỦ ĐA TẦNG (DEFENSE-IN-DEPTH)
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │ LỚP 1: ĐỊNH HƯỚNG NGỮ CẢNH (CLAUDE.md & .claude/rules/)                        │
  │        └─ Hướng dẫn mô hình hiểu quy chuẩn dự án và không đề xuất lệnh xấu.     │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ LỚP 2: THU HẸP DANH SÁCH TOOL (Permission Modes & disallowedTools)              │
  │        └─ Subagent chỉ được cấp đúng những tool cần thiết (Least Privilege).    │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ LỚP 3: CƯỠNG CHẾ TIỀN TRẠM TẤT ĐỊNH (PreToolUse Hook với exit 2)               │
  │        └─ Chặn đứng các lệnh nguy hiểm (rm -rf, git push -f) trước khi chạy.     │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ LỚP 4: GIÁM SÁT & HẬU KIỂM (PostToolUse / Stop Hook Logging)                    │
  │        └─ Ghi vết toàn bộ hành vi vào progress.md để kiểm toán và phát hiện sớm. │
  └─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Kinh tế học Token & Lựa chọn Mô hình (Token Economics)

Đề thi CCA-F đặc biệt chú trọng khả năng lựa chọn mô hình dựa trên bài toán chi phí và hiệu năng:

| Mô Hình | Điểm Mạnh | Bẫy Chi Phí & Hiệu Năng | Khuyến Nghị Kiến Trúc |
| :--- | :--- | :--- | :--- |
| **Claude 3.5 Haiku** | Cực nhanh (low latency), chi phí siêu rẻ cho tác vụ ngắn. | Khả năng suy luận mã nguồn sâu và tuân thủ rào chắn nhiều bước không bằng Sonnet. | Dùng cho phân loại text, tra cứu nhanh, trích xuất dữ liệu, drill quiz ngắn. |
| **Claude 3.5 Sonnet** | Khả năng suy luận mã nguồn và kiến trúc vượt trội; độ tuân thủ rào chắn cao. | Chi phí input/output cơ sở cao hơn Haiku nếu gọi lặp đi lặp lại mà không áp dụng caching. | Mô hình chuẩn mực cho coding, review kiến trúc, orchestrator điều phối. |
| **Prompt Caching** | Đọc cache chỉ tốn **10% giá input gốc** (giảm 90% chi phí cho các lượt gọi sau). Cache Write tốn 125% giá base. | Cache có thời gian sống (TTL) mặc định 5 phút tính từ lượt gọi gần nhất (hỗ trợ refresh). | Đặt phần tài liệu cố định (System prompt, Tools schema, Rules) ở đầu context để tái sử dụng. |

---

## 3. Các Bài Lab Thực nghiệm Chứng minh (Hands-on Proofs)

### 🧪 Lab 4.1: Diễn Tập Tiêm Lỗi Thực Chiến (Failure Injection Drills)
* **Mục tiêu**: Xử lý 4 bẫy kiến trúc kinh điển được định nghĩa trong [`docs/evaluation-plan.md`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/docs/evaluation-plan.md).
* **Nhiệm vụ cần vượt qua**:
  1. *Drill 1 (Bẫy Stdout MCP)*: Nhận diện và sửa lỗi `console.log` trong MCP Server.
  2. *Drill 2 (Bẫy Bypass Safety)*: Chuyển một rule text cấm xoá file thành một Hook shell `PreToolUse` trả về `exit 2`.
  3. *Drill 3 (Lỗi Cú pháp Subagent)*: Dùng `scripts/validate-config.mjs` để tìm ra lỗi sai định dạng `camelCase` trong agent.
  4. *Drill 4 (Môi trường CI)*: Cấu hình `settingSources: []` trong `orchestrator.ts` để đảm bảo bài test chạy cách ly hoàn toàn.

### 🧪 Lab 4.2: Thi Đấu Mô Phỏng Có Bấm Giờ (Timed Mock Exam Marathon)
* **Mục tiêu**: Làm quen với áp lực phòng thi (90 giây/câu, không dùng tài liệu).
* **Thực hành**:
  1. Kích hoạt bài thi thử bằng skill Claude Code:
     ```
     /mock-exam 20
     ```
     *(Hoặc kiểm tra ngân hàng câu hỏi bằng `npm --prefix mcp-server run probe`)*
  2. Hệ thống sẽ sinh đề 20 câu với `balanced: true` trải đều 4 domain:
     - `api-fundamentals`: 5 câu
     - `agent-design`: 5 câu
     - `claude-code-config`: 5 câu
     - `mcp-integration`: 5 câu
  3. Báo cáo kết quả sẽ được tự động ghi vào thư mục [`docs/mock-exams/`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/docs/mock-exams/).

---

## 4. Phân tích Đánh đổi Kỹ thuật Cốt lõi (Architectural Trade-offs)

| Vấn Đề Kiến Trúc | Phương Án A | Phương Án B | Bản Chất Đánh Đổi |
| :--- | :--- | :--- | :--- |
| **Phân bổ Context** | Nạp toàn bộ tài liệu vào System Prompt | Tách nhỏ thành Skills nạp theo nhu cầu | Trả tiền token ở mọi turn vs Chấp nhận latency nhỏ khi nạp skill lần đầu. |
| **Quyền Thực Thi Tool** | `permissionMode: "bypass"` (Chạy tự động hoàn toàn) | `permissionMode: "default"` (Hỏi người dùng) | Tự động hóa tối đa vs Nguy cơ rủi ro bảo mật nếu hook không bao quát hết các kịch bản. |
| **Lựa chọn Mô hình** | Dùng Haiku cho toàn bộ hệ thống | Dùng Sonnet làm Orchestrator + Haiku làm Worker | Tiết kiệm chi phí ban đầu nhưng dễ sai sót logic phức tạp vs Cân bằng hoàn hảo giữa trí tuệ và ngân sách. |

---

## 5. Câu hỏi Tự vấn Kiến trúc Sư (Architect Self-Check)

1. *Khi nào một hệ thống dùng Prompt Caching với Sonnet lại có chi phí rẻ hơn hoặc tương đương một hệ thống dùng Haiku không cache? Và điều kiện để một prompt block được kích hoạt Cache Read là gì?*
2. *Nếu một dự án có 10 subagents cùng chia sẻ chung một MCP server, làm sao để hạn chế subagent A không gọi được tool của subagent B?*
3. *Quy tắc ưu tiên `deny > defer > ask > allow` giúp giải quyết xung đột như thế nào khi có 2 hook cùng can thiệp vào một tool call?*

---

## 6. Tiêu chuẩn Nghiệm thu Toàn diện (Readiness Sign-off Gate)

Chúc mừng thầy Tú và các bạn học viên! Bạn chính thức đủ điều kiện được ký duyệt **SẴN SÀNG THI CCA-F** khi đạt đủ 4 tiêu chuẩn vàng:

- [x] **1. Automated Checks 100% Xanh**:
  ```bash
  npm run check
  ```
  *(Toàn bộ 47+ kiểm thử tĩnh, probe, hook tests, và validate config đều PASS không tì vết)*
- [x] **2. Tri thức Nhất quán 100%**:
  `audit_kb` báo cáo tỷ lệ khớp 1:1 giữa Concept và Quiz, không có concept mồ côi.
- [x] **3. Mock Exam Điểm Cao**:
  Hoàn thành tối thiểu 2 đề thi 20 câu với kết quả:
  - Điểm tổng thể: $\ge 85\%$
  - Không có Domain nào $< 75\%$
  - Thời gian trung bình: $\le 75$ giây/câu
- [x] **4. Bản lĩnh Giải trình Kiến trúc**:
  Có khả năng giải thích rành mạch "Tại sao" cho bất kỳ luật thiết kế nào trong repo trong vòng 2 câu ngắn gọn.

---
*Made by Anh Tu - Share to be share*
