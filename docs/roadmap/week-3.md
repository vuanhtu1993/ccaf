# Tuần 3: Lập trình Điều khiển & Khung Kiềm tỏa
*(Week 3: Programmatic Agent Control & Harnessing)*

> **Mục tiêu cốt lõi**: Thấu hiểu bản chất của **Claude Agent SDK** như một thư viện đóng gói toàn bộ vòng lặp của Claude Code; làm chủ khái niệm **Agent Harness** để lập trình hóa các rào chắn an toàn (guardrails), cơ chế xác thực đa nguồn, và thiết lập môi trường thực thi cô lập tuyệt đối (Hermetic Execution) cho CI/CD.

---

## 1. Câu hỏi Cội rễ (Core Inquiry)

> *"Tại sao bạn không thể dùng Claude Code CLI trong các luồng backend tự động hóa (CI/CD, Web API), và làm thế nào để đảm bảo Agent chạy trong code Node.js không bị ảnh hưởng bởi cấu hình cá nhân trên máy của từng lập trình viên?"*

### Phân tích Lịch sử & Nguyên nhân Gốc rễ (Root Cause Analysis)
* **Quá khứ**: Claude Code CLI được sinh ra để phục vụ tương tác dòng lệnh giữa người và máy (Interactive Terminal). CLI tự động dò tìm cấu hình global từ thư mục Home (`~/.claude/settings.json`) và Keychain của máy tính.
* **Vấn đề khi đưa vào CI/CD / Backend Server**:
  - Không có người ngồi gõ phím để cấp quyền xác nhận chạy tool (Permission Prompt).
  - Tình trạng *"chạy được trên máy tôi nhưng lỗi trên server CI"* xảy ra vì máy dev có các file rule, skill, token cá nhân được nạp ngầm mà trên CI không có.
* **Sự ra đời của Agent SDK**: Anthropic đóng gói chính engine vòng lặp của Claude Code thành thư viện npm (`@anthropic-ai/claude-agent-sdk`). Bạn có thể gọi `query({ prompt, options })` và toàn quyền kiểm soát bằng mã nguồn TypeScript, tách biệt hoàn toàn khỏi giao diện người dùng.

---

## 2. Giải phẫu Khái niệm & Cơ chế Vận hành Ngầm

### 2.1. Quyền lực của Option `settingSources`

Đây là một trong những điểm hay xuất hiện nhất trong các đề thi kiến trúc nâng cao:

```typescript
// Trong orchestrator.ts:
const options: Options = {
  settingSources: ['user', 'project'], // Nạp cấu hình từ filesystem
  // HOẶC
  settingSources: [], // CÔ LẬP TUYỆT ĐỐI (HERMETIC EXECUTION)
};
```

1. **`['user', 'project']`**: Agent SDK sẽ quét thư mục `.claude/` của dự án và thư mục user. Toàn bộ `CLAUDE.md`, `.claude/rules`, `.claude/skills` sẽ được nạp tự động.
2. **`[]` (Mảng Rỗng)**: Tắt sạch toàn bộ việc đọc file từ đĩa. Toàn bộ hành vi của Agent phải được định nghĩa tường minh bằng code TypeScript (qua `options.agents`, `options.hooks`, `options.mcpServers`). Đây là cách duy nhất để đảm bảo bài test chạy trong môi trường CI luôn đồng nhất 100%.

### 2.2. Sự Hội Tụ Giữa Shell Hook và TypeScript Hook

Ở tầng CLI và tầng SDK, Anthropic sử dụng **chung một bộ sự kiện vòng đời (Lifecycle Events)** nhưng khác biệt về cơ chế thực thi:

| Khía Cạnh | Tầng Claude Code CLI | Tầng Claude Agent SDK |
| :--- | :--- | :--- |
| **Khai Báo** | File JSON (`.claude/settings.json`) | Object TypeScript (`options.hooks`) |
| **Thực Thi** | Tiến trình Shell con (Shell Script qua `stdin`/`stdout`) | Callback bất đồng bộ TypeScript (`async (input) => { ... }`) |
| **Cơ Chế Chặn** | Trả về mã thoát: `exit 2` | Trả về JSON: `{ decision: 'block', reason: '...' }` (chuẩn đặc tả Agent SDK mới: `hookSpecificOutput: { permissionDecision: 'deny' }`) |

---

## 3. Các Bài Lab Thực nghiệm Chứng minh (Hands-on Proofs)

### 🧪 Lab 3.1: Thao Túng Môi Trường Cô Lập Bằng `settingSources`
* **Mục tiêu**: Tận mắt chứng kiến sự biến mất của Skill và Rule khi đổi nguồn cấu hình.
* **Thực hành**:
  1. Mở file [`agent-sdk/src/orchestrator.ts`](../../agent-sdk/src/orchestrator.ts).
  2. Tìm đến hàm `buildOptions()` ở dòng ~215:
     ```typescript
     settingSources: ['user', 'project'],
     ```
  3. Thử sửa thành chế độ Hermetic (cô lập hoàn toàn):
     ```typescript
     settingSources: [],
     ```
  4. Biên dịch lại code:
     ```bash
     npm --prefix agent-sdk run build
     ```
  5. **Kiểm chứng thực tế**: Chạy thử lệnh `npm run validate`:
     ```bash
     npm run validate
     ```
     Script thẩm định kiểm tra cấu hình sẽ nhận diện và xác nhận môi trường cô lập. Khi `settingSources: []`, SDK hoàn toàn không quét thư mục `.claude/` trên đĩa.
  6. **Khôi phục**: Đổi lại về `settingSources: ['user', 'project']` và chạy `npm --prefix agent-sdk run build` để đưa hệ thống về trạng thái ban đầu.

### 🧪 Lab 3.2: Khởi Tạo MCP Server Ngay Trong Bộ Nhớ (In-process MCP)
* **Mục tiêu**: Viết một tool phục vụ agent mà không cần tạo tiến trình con riêng.
* **Thực hành**:
  1. Mở [`agent-sdk/src/orchestrator.ts`](../../agent-sdk/src/orchestrator.ts) và quan sát biến `repoMapServer` (dòng ~171).
  2. Đây là một server MCP được khởi tạo bằng hàm `createSdkMcpServer()` và tool `tool()`.
  3. **Ưu điểm kiến trúc**: Tool này chạy ngay trong tiến trình của Node.js, chia sẻ cùng heap memory, không tốn tài nguyên spawn process và không lo vấn đề vỡ giao thức `stdio`.

### 🧪 Lab 3.3: Hook Callback Chặn Lệnh Phá Hoại Bằng TypeScript
* **Mục tiêu**: Kiểm tra hàng rào an toàn `pretoolGuard` trong SDK.
* **Thực hành**:
  1. Quan sát đoạn code hook trong [`orchestrator.ts`](../../agent-sdk/src/orchestrator.ts#L132-L153):
     ```typescript
     if (/(^|\s)rm\s+-rf\s+(\/|~)/.test(command) || /git\s+push\s+(--force|-f)\b/.test(command)) {
       return {
         decision: 'block',
         reason: `Hook SDK chặn lệnh nguy hiểm: ${command}`,
       };
     }
     ```
  2. **So sánh kiến trúc**: Cơ chế `{ decision: 'block' }` (hoặc `permissionDecision: 'deny'` theo đặc tả mới) của SDK tương đương 100% với việc trả về `exit 2` của hook shell `guard-dangerous.sh` ở tầng CLI. Agent sẽ dừng tool call và nhận được phản hồi lỗi qua trường `reason`.

---

## 4. Phân tích Đánh đổi Kỹ thuật (Architectural Trade-offs)

| Cặp Giải Pháp Đánh Đổi | Lựa Chọn A | Lựa Chọn B | Bản Chất Trade-off & Khuyến Nghị Kiến Trúc |
| :--- | :--- | :--- | :--- |
| **Triển Khai: CLI vs. Agent SDK** | Claude Code CLI | Claude Agent SDK (`query()`) | **Tốc độ làm việc cá nhân vs. Khả năng tự động hóa**: CLI tuyệt vời cho developer tương tác hàng ngày. SDK bắt buộc phải dùng khi muốn đóng gói Agent vào microservice, xử lý background jobs, hoặc tích hợp bot Slack/Discord. |
| **MCP: Stdio Child Process vs. In-process SDK** | Tiến trình Stdio riêng biệt (`mcp-server/`) | `createSdkMcpServer` trong code Node | **Tái sử dụng vs. Hiệu năng & Đơn giản**: Stdio server dùng chung được cho nhiều client khác nhau. In-process server chỉ dùng được trong file code đó, nhưng không có overhead khởi tạo tiến trình con. |

---

## 5. Câu hỏi Tự vấn Bản chất (Self-reflection Questions)

1. *Khi nào bạn BẮT BUỘC phải dùng `settingSources: []` thay vì `settingSources: ['project']`?*
2. *Trong SDK, nếu hàm callback của `PreToolUse` trả về `{ decision: 'block' }`, chuyện gì sẽ xảy ra với lượt chạy đó của Agent?*
3. *Tại sao việc kiểm tra cứng `if (!process.env['ANTHROPIC_API_KEY'])` lại bị coi là một anti-pattern trong file `orchestrator.ts`? (Xem file `scripts/validate-config.mjs`)*

---

## 6. Tiêu chuẩn Nghiệm thu Đầu ra Tuần 3 (Weekly Sign-off Gate)

Bạn đã hoàn thành Tuần 3 khi:
- [x] Hiểu cặn kẽ 5 thành phần kiến trúc trong [`agent-sdk/src/orchestrator.ts`](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/agent-sdk/src/orchestrator.ts).
- [x] Cả hai package đều biên dịch TypeScript không lỗi:
  ```bash
  npm run typecheck
  ```
  *(Kết quả: `tsc --noEmit` pass cho cả mcp-server và agent-sdk)*
- [x] Lệnh validate cấu hình xác nhận orchestrator đạt chuẩn an toàn xác thực:
  ```bash
  npm run validate
  ```
  *(Kết quả: `orchestrator không chặn cứng theo ANTHROPIC_API_KEY` & `orchestrator không hard-code API key`)*

👉 **Chuyển sang [Tuần 4: Phòng thủ Đa tầng & Sát hạch Kiến trúc sư](week-4.md)**

---
*Made by Anh Tu - Share to be share*
