# Kế hoạch Chỉnh sửa Nâng cao Chất lượng Học liệu 4 Tuần (`docs/roadmap`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiệu chỉnh toàn bộ 5 tài liệu trong `docs/roadmap/` nhằm khắc phục các lỗ hổng thực nghiệm lab, chuẩn hóa số liệu token economics, đảm bảo tính bất biến kỹ thuật và nâng cao trải nghiệm sư phạm cho người học.

**Architecture:** Sử dụng phương pháp refactoring tài liệu theo từng mô-đun tuần độc lập, ưu tiên xử lý các lỗi logic thực nghiệm (lab build steps), tiếp đến là sửa lỗi kiến thức (token pricing, prompt caching, hook mechanics) và cuối cùng là chuẩn hóa đường dẫn tương đối cùng khung sư phạm (gợi ý đáp án, checklist nghiệm thu).

**Tech Stack:** Markdown (GitHub Flavored), TypeScript, Node.js (`npm test:hooks`, `npm run validate`, `npm --prefix mcp-server run probe`), Mermaid diagrams.

**Spec:** [`docs/roadmap_quality_audit.md`](file:///Users/anhtus/.gemini/antigravity-ide/brain/43860996-bde8-4619-b112-49fc65d1c5fb/roadmap_quality_audit.md)

---

## Global Constraints

- Không sửa đổi logic kiểm thử cốt lõi trong `mcp-server/`, `agent-sdk/` hay `.claude/hooks/` nếu không cần thiết; mã nguồn hiện tại đang pass 100% (`npm run check`).
- Tuyệt đối không dùng đường dẫn tuyệt đối dạng `file:///Users/...` trong tài liệu `docs/` để tránh hỏng link trên môi trường khác của học viên hoặc GitHub.
- Tuân thủ nguyên tắc sư phạm của Anh Tú: luôn có "Câu hỏi Cội rễ", "Giải phẫu Khái niệm", "Bài Lab Thực nghiệm", "Đánh đổi Kỹ thuật", "Câu hỏi Tự vấn" và "Tiêu chuẩn Nghiệm thu".
- Tuân thủ nguyên tắc No Hallucination: mọi thông số kỹ thuật (giá token, cơ chế hook) phải có nguồn kiểm chứng hoặc ghi chú rõ ràng.
- Giữ footer bản quyền bắt buộc: `*Made by Anh Tu - Share to be share*`.

---

## Review Focus

1. **Lab không tái hiện lỗi**: Các bước hướng dẫn tiêm lỗi (Failure Injection) phải thực sự làm vỡ hệ thống khi làm theo hướng dẫn và hồi phục lại bình thường khi sửa lỗi.
2. **Số liệu giá API Token & Prompt Caching**: Tỷ lệ đọc cache (10% thay vì 5%) và mô tả chi phí không chứa thông tin suy đoán (không có "bậc giá 100k gấp 5 lần" vô căn cứ).
3. **Cơ chế nạp Skill**: Phải phản ánh đúng cả 2 cách kích hoạt (User gọi slash command HOẶC Claude tự nạp theo `description`).
4. **Link tương đối khả dụng**: Tất cả liên kết trong `docs/roadmap/` phải trỏ đúng file qua đường dẫn tương đối (ví dụ `../../.claude/...` thay vì link tuyệt đối của máy cá nhân).
5. **Checklist tự học**: Trạng thái mặc định của checklist kết tuần phải là chưa hoàn thành (`- [ ]`) để học viên tự đánh giá.

---

### Task 1: Khắc phục Lỗ hổng Thực nghiệm Lab 2.1 & Lab 2.2 trong Tuần 2

**Files:**
- Modify: `docs/roadmap/week-2.md:48-70`

**Interfaces:**
- Consumes: `mcp-server/scripts/probe.mjs` (thực thi `dist/index.js`).
- Produces: Các bước thực hành Lab 2.1 và Lab 2.2 có lệnh build trung gian để mã nguồn TypeScript được biên dịch sang JavaScript trước khi chạy probe.

- [ ] **Step 1: Cập nhật Lab 2.1 (Bẫy Ô Nhiễm Stdout)**
  - Bổ sung bước biên dịch `npm --prefix mcp-server run build` ngay sau khi học viên thêm `console.log(...)` vào `mcp-server/src/index.ts`.
  - Bổ sung bước `npm --prefix mcp-server run build` sau khi sửa thành `console.error(...)` để probe xanh trở lại.

- [ ] **Step 2: Cập nhật Lab 2.2 (Kiểm tra Bất biến Knowledge Base)**
  - Bổ sung bước biên dịch `npm --prefix mcp-server run build` sau khi thêm concept mồ côi vào `mcp-server/src/knowledge.ts`.
  - Bổ sung bước khôi phục file `knowledge.ts` và build lại để đảm bảo trạng thái sạch.

- [ ] **Step 3: Xác minh tính đúng đắn của tài liệu**
  - Đọc lại `docs/roadmap/week-2.md` từ dòng 48 đến 70 để đảm bảo thứ tự dòng lệnh hoàn toàn chính xác.

- [ ] **Step 4: Chạy kiểm tra hệ thống**
  - Chạy `npm --prefix mcp-server run probe` để bảo đảm server MCP vẫn pass 16/16 check.

---

### Task 2: Hiệu chỉnh Kinh tế học Token & Lựa chọn Mô hình trong Tuần 4

**Files:**
- Modify: `docs/roadmap/week-4.md:20-50`
- Modify: `docs/roadmap/week-4.md:95-105`

**Interfaces:**
- Consumes: Bảng giá và tài liệu Claude API chính thức (Prompt Caching read = 10% base input cost, write = 125%; không có bậc giá 100k cho Haiku).
- Produces: Bảng đối chiếu mô hình chính xác và câu hỏi tự vấn phản ánh đúng trade-off thực tế.

- [ ] **Step 1: Cập nhật Bảng Token Economics (§2.2)**
  - Loại bỏ khẳng định không có nguồn về bậc giá 100k của Claude 3.5 Haiku.
  - Thay bằng so sánh chuẩn mực:
    - **Haiku**: Tối ưu chi phí cho các tác vụ tác vụ nhẹ, phân loại, tìm kiếm, prompt ngắn; độ trễ cực thấp.
    - **Sonnet**: Cân bằng tối ưu giữa trí tuệ kiến trúc và chi phí; phù hợp làm Orchestrator.
    - **Prompt Caching**: Tiết kiệm đến **90%** chi phí input token cho các lượt đọc cache tiếp theo (Cache Read = 10% giá base input; Cache Write = 125% giá base input). Thời gian sống TTL mặc định 5 phút (có hỗ trợ refresh khi truy cập).

- [ ] **Step 2: Sửa câu hỏi tự vấn số 1 (Q1)**
  - Đổi câu hỏi: *"Khi nào chi phí gọi Claude 3.5 Haiku thực tế lại ĐẮT HƠN gọi Claude 3.5 Sonnet?"*
  - Thành câu hỏi kiến trúc thực tế: *"Khi nào một hệ thống dùng Prompt Caching với Sonnet lại có chi phí rẻ hơn hoặc tương đương một hệ thống dùng Haiku không cache? Và điều kiện để một prompt block được kích hoạt Cache Read là gì?"*

- [ ] **Step 3: Xác minh nội dung**
  - Đọc lại mục 2.2 và 5 của `docs/roadmap/week-4.md` để đảm bảo văn phong sư phạm và tính chính xác kỹ thuật.

---

### Task 3: Chuẩn hóa Tính Chính xác Kỹ thuật của Hook & Skill trong Tuần 1 & Tuần 3

**Files:**
- Modify: `docs/roadmap/week-1.md:30-52`
- Modify: `docs/roadmap/week-3.md:40-92`

**Interfaces:**
- Consumes: Cơ chế thực thi của Claude Code CLI Hooks và Claude Agent SDK Options.
- Produces: Nội dung lý thuyết phản ánh đúng cả 2 hình thức nạp Skill và 2 phiên bản định dạng Hook trong SDK.

- [ ] **Step 1: Điều chỉnh mô tả Skill trong Sơ đồ Bộ nhớ Tuần 1 (§2.1)**
  - Sửa dòng `.claude/skills/*/`: Ghi rõ Skill nạp `name` + `description` vào ngữ cảnh ban đầu; toàn bộ nội dung hướng dẫn sẽ được nạp khi **người dùng gõ slash command HOẶC khi mô hình tự động phát hiện ngữ cảnh khớp với `description`**.
  - Bổ sung ghi chú về cơ chế JSON Output của hook khi `exit 0` (hỗ trợ can thiệp biến môi trường hoặc gửi phản hồi có cấu trúc).

- [ ] **Step 2: Cập nhật định dạng Hook của Agent SDK trong Tuần 3 (§2.2 & Lab 3.3)**
  - Chú thích rõ ràng hai dạng trả lời của hook:
    - Dạng chuẩn mới (Agent SDK): `{ hookSpecificOutput: { permissionDecision: 'deny' }, reason: '...' }`
    - Dạng tương thích hiện hành trong repo: `{ decision: 'block', reason: '...' }` (như đang dùng trong `orchestrator.ts`).
  - Nâng cấp **Lab 3.1**: Thêm bước kiểm chứng thực tế bằng lệnh `npm run agent:study` sau khi đổi `settingSources: []` để sinh viên quan sát thấy thông báo lỗi thiếu skill.

- [ ] **Step 3: Xác minh tính nhất quán**
  - Đọc lại `docs/roadmap/week-1.md` và `docs/roadmap/week-3.md` để đảm bảo không còn sự mâu thuẫn giữa lý thuyết và bảng trade-off.

---

### Task 4: Chuẩn hóa Trải nghiệm Sư phạm, Đường dẫn Tương đối & Checklist

**Files:**
- Modify: `docs/roadmap/README.md`
- Modify: `docs/roadmap/week-1.md`
- Modify: `docs/roadmap/week-2.md`
- Modify: `docs/roadmap/week-3.md`
- Modify: `docs/roadmap/week-4.md`

**Interfaces:**
- Consumes: Cấu trúc thư mục dự án (`docs/roadmap/` so với gốc repo).
- Produces: Bộ tài liệu với link tương đối 100%, checklist mở (`[ ]`), có gợi ý đáp án tự vấn, và văn phong hướng tới học viên.

- [ ] **Step 1: Chuyển đổi toàn bộ đường dẫn tuyệt đối sang tương đối**
  - Thay thế mọi link dạng `file:///Users/anhtus/...` thành đường dẫn tương đối (ví dụ `../../.claude/...`, `../../mcp-server/...`, `../evaluation-plan.md`).

- [ ] **Step 2: Đổi trạng thái checklist nghiệm thu**
  - Chuyển toàn bộ `- [x]` tại mục **Tiêu chuẩn Nghiệm thu Đầu ra** của cả 4 tuần thành `- [ ]`.

- [ ] **Step 3: Bổ sung Khối Gợi ý Đáp án cho phần Câu hỏi Tự vấn**
  - Thêm block `<details><summary>Gợi ý đáp án kiến trúc</summary>...</details>` cho mỗi câu hỏi ở mục 5 của cả 4 tuần.

- [ ] **Step 4: Chuẩn hóa xưng hô và tiêu đề**
  - Sửa "Chúc mừng thầy Tú và các bạn học viên!" ở Tuần 4 (§6) thành "Chúc mừng bạn học viên!".
  - Chuẩn hóa chính tả: "Khung Kiềm tỏa" -> "Khung Kiểm soát & Kiềm tỏa (Agent Harnessing)".

---

### Task 5: Kiểm định Toàn diện và Ký duyệt Đóng Task (Verification Gate)

**Files:**
- Review: Toàn bộ 5 files trong `docs/roadmap/`.

**Interfaces:**
- Consumes: Hệ thống scripts thẩm định tự động của repo.
- Produces: Báo cáo kết quả kiểm định xanh 100% không còn cảnh báo.

- [ ] **Step 1: Chạy bộ kiểm thử tự động toàn dự án**
  - Chạy `npm run check` (bao gồm `typecheck`, `probe`, `test:hooks`, `validate`).
  - Kỳ vọng: Toàn bộ PASS, 0 cảnh báo.

- [ ] **Step 2: Kiểm tra liên kết và định dạng markdown**
  - Quét kiểm tra xem còn sót URL tuyệt đối nào trong `docs/roadmap/` không:
    `grep -rn "file:///Users" docs/roadmap/`
  - Kỳ vọng: Không có kết quả nào trả về.

- [ ] **Step 3: Bàn giao kết quả hoàn thiện cho người dùng**

---
*Made by Anh Tu - Share to be share*
