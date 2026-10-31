# Tuần 2: Giao thức Công cụ & Cách ly Ngữ cảnh
*(Week 2: MCP Protocol & Context Isolation)*

> **Mục tiêu cốt lõi**: Thấu hiểu bản chất của **Model Context Protocol (MCP)** như một chuẩn giao tiếp mở tách rời công cụ khỏi tiến trình agent; làm chủ cơ chế truyền tin JSON-RPC qua `stdio` (bảo toàn tính thuần khiết của `stdout`); và thiết kế các **Subagents** chuyên biệt để cô lập ngữ cảnh, chống ô nhiễm prompt chính.

---

## 1. Câu hỏi Cội rễ (Core Inquiry)

> *"Tại sao Anthropic lại tạo ra giao thức MCP thay vì để người dùng tự viết tool JSON nhúng thẳng vào code? Và tại sao một dòng `console.log` debug tưởng như vô hại lại có thể làm sập toàn bộ kết nối của Agent?"*

### Phân tích Lịch sử & Nguyên nhân Gốc rễ (Root Cause Analysis)
* **Quá khứ (Tool Silos)**: Mỗi nền tảng AI (OpenAI, LangChain, Claude, AutoGen) tự định nghĩa một cấu trúc JSON schema riêng cho Function Calling. Muốn tích hợp PostgreSQL hay Git, lập trình viên phải viết lại adapter cho từng framework. Công cụ bị "nhốt chặt" trong tiến trình của agent.
* **Sự ra đời của MCP**: Tương tự như cách **LSP (Language Server Protocol)** giải phóng trình biên dịch khỏi từng IDE, **MCP (Model Context Protocol)** giải phóng Tool khỏi Client. Tool trở thành một Server độc lập, nói một thứ tiếng chung (JSON-RPC 2.0). Cùng một server `cca-coach`, Claude Code CLI đọc được, Claude Desktop đọc được, và Agent SDK cũng đọc được.
* **Bản chất Subagents (Context Polluting)**: Khi một tác vụ đòi hỏi đọc 50 file log hoặc tìm kiếm hàng chục trang web, nếu làm trên một agent duy nhất, toàn bộ dữ liệu rác sẽ làm tràn context window, gây suy giảm trí thông minh của mô hình (Lost in the Middle). Subagent ra đời để **nhốt dữ liệu rác trong context riêng của nó**, chỉ gửi về kết quả tóm tắt cho agent cha.

---

## 2. Giải phẫu Khái niệm & Cơ chế Vận hành Ngầm

### 2.1. Ba Primitive cốt lõi của MCP

```
                             BA TRỤ CỘT CỦA GIAO THỨC MCP
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │ 1. TOOLS (Công cụ)     -> Dành cho Model: Hàm có tham số, mô hình tự quyết định │
  │                           khi nào gọi để tác động hoặc lấy dữ liệu.             │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ 2. RESOURCES (Tài nguyên)-> Dành cho Ứng dụng/User: Dữ liệu tĩnh hoặc động đọc  │
  │                           theo cấu trúc URI (ví dụ: cca://glossary).            │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │ 3. PROMPTS (Mẫu câu)   -> Dành cho Người dùng: Các prompt template được chuẩn   │
  │                           hóa sẵn với tham số truyền vào (ví dụ: study-session).│
  └─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Nguyên tắc Sống còn: Stdout Purity trong Stdio Transport

Trong transport `stdio` (tiến trình con chạy qua terminal):
- Kênh **`stdout` (Standard Output)** là **ĐƯỜNG DÂY MẠNG DÀNH RIÊNG CHO JSON-RPC**. Từng byte gửi qua đây phải là một JSON object hợp lệ.
- Kênh **`stderr` (Standard Error)** là nơi duy nhất dành cho việc ghi log và debug của lập trình viên.
- ⚠️ **Hậu quả**: Nếu bạn gõ `console.log("Connecting...")`, chuỗi text này sẽ bị đẩy vào `stdout`. Client phía Claude đọc chuỗi này, không parse được JSON, và lập tức ngắt kết nối với thông báo lỗi giao thức.

---

## 3. Các Bài Lab Thực nghiệm Chứng minh (Hands-on Proofs)

### 🧪 Lab 2.1: Bẫy Ô Nhiễm Stdout (The Stdout Pollution Disaster)
* **Mục tiêu**: Tự tay làm hỏng giao thức để hiểu lý do tại sao mọi log phải đi qua `stderr`.
* **Thực hành**:
  1. Mở file [`mcp-server/src/index.ts`](../../mcp-server/src/index.ts).
  2. Thêm thử một dòng `console.log("=== Debugging MCP Server ===");` ở đầu file.
  3. Biên dịch mã TypeScript sang JavaScript (do probe thực thi bản `dist/`):
     ```bash
     npm --prefix mcp-server run build
     ```
  4. Chạy lệnh probe để kiểm thử giao thức:
     ```bash
     npm --prefix mcp-server run probe
     ```
  5. **Quan sát**: Client kiểm thử lập tức crash (`JSON.parse error` hoặc giao thức bị ngắt) vì nhận được chuỗi text trên kênh `stdout` vốn chỉ dành riêng cho JSON-RPC.
  6. **Khắc phục**: Đổi thành `console.error("=== Debugging MCP Server ===");`, build lại rồi chạy probe:
     ```bash
     npm --prefix mcp-server run build
     npm --prefix mcp-server run probe
     ```
     Probe sẽ xanh trở lại 16/16 check!

### 🧪 Lab 2.2: Kiểm tra Bất biến Knowledge Base (`audit_kb`)
* **Mục tiêu**: Chứng minh nguyên tắc toàn vẹn tri thức của hệ thống.
* **Thực hành**:
  1. Mở file [`mcp-server/src/knowledge.ts`](../../mcp-server/src/knowledge.ts).
  2. Thêm một Concept mới vào mảng `CONCEPTS` nhưng cố tình **không** thêm câu hỏi Quiz nào tương ứng vào `QUIZ_ITEMS`.
  3. Biên dịch lại server MCP:
     ```bash
     npm --prefix mcp-server run build
     ```
  4. Chạy lệnh kiểm thử:
     ```bash
     npm --prefix mcp-server run probe
     ```
  5. **Quan sát**: Tool `audit_kb` kích hoạt bất biến và báo lỗi ngay lập tức vì phát hiện Concept mồ côi (Orphan Concept).
  6. **Khôi phục**: Xoá concept thử nghiệm vừa thêm, chạy `npm --prefix mcp-server run build && npm --prefix mcp-server run probe` để khôi phục trạng thái sạch.

### 🧪 Lab 2.3: Thiết kế Subagent Thu Hẹp Quyền (Least Privilege Subagent)
* **Mục tiêu**: Cấu hình subagent chỉ có quyền đọc để review kiến trúc an toàn.
* **Thực hành**:
  1. Mở file [`.claude/agents/architecture-reviewer.md`](../../.claude/agents/architecture-reviewer.md).
  2. Quan sát phần header YAML frontmatter:
     ```markdown
     ---
     name: architecture-reviewer
     description: Reviews changes in this repo against the four-layer Claude architecture...
     tools: Read, Grep, Glob
     model: inherit
     ---
     ```
  3. **Điểm mấu chốt đề thi CCA-F**:
     - Subagent dùng **`camelCase`** (`disallowedTools`, `maxTurns`). Nếu viết `max_turns` (snake_case), Claude Code sẽ âm thầm bỏ qua!
     - Trường `description` là **BẮT BUỘC**. Nếu thiếu `description`, Claude Code sẽ coi file này là file markdown rác và bỏ qua trong danh sách agent.

---

## 4. Phân tích Đánh đổi Kỹ thuật (Architectural Trade-offs)

| Cặp Giải Pháp Đánh Đổi | Lựa Chọn A | Lựa Chọn B | Bản Chất Trade-off & Khuyến Nghị Kiến Trúc |
| :--- | :--- | :--- | :--- |
| **Transport: Stdio vs. HTTP/SSE** | `stdio` (Process cục bộ) | `http` / `sse` (Mạng phân tán) | **Local Security vs. Scalability**: `stdio` chạy cực nhanh, an toàn tuyệt đối trên máy local vì không mở cổng mạng. `http/sse` cho phép chia sẻ server MCP cho cả công ty nhưng đòi hỏi xác thực Token/OAuth và quản lý firewall phức tạp. |
| **Monolithic Agent vs. Subagents** | 1 Agent làm tất cả | Chia nhỏ ra các Subagents | **Token Overhead vs. Context Purity**: Subagent sinh ra chi phí khởi tạo prompt và tóm tắt kết quả gửi ngược lại (tốn nhiều token hơn), nhưng giữ cho context window của Agent cha luôn sạch và sắc bén. |

---

## 5. Câu hỏi Tự vấn Bản chất (Self-reflection Questions)

1. *Tại sao Subagent KHÔNG rẻ hơn và KHÔNG nhanh hơn một Agent đơn lẻ?*
   <details>
   <summary>💡 Gợi ý đáp án kiến trúc</summary>
   Subagent đòi hỏi chi phí token khởi tạo system prompt và ngữ cảnh riêng cho tiến trình con, đồng thời tốn thêm token khi tóm tắt kết quả gửi ngược về Agent cha. Ngoài ra, việc spawn thêm sub-session làm tăng latency so với việc gọi trực tiếp trên cùng một phiên.
   </details>

2. *Nếu một server MCP có cấu hình `url: "http://localhost:3000"` nhưng thiếu trường `type: "http"`, Claude Code sẽ xử lý như thế nào? (Xem file `scripts/validate-config.mjs`)*
   <details>
   <summary>💡 Gợi ý đáp án kiến trúc</summary>
   Claude Code mặc định coi server là dạng tiến trình con <code>stdio</code> (yêu cầu trường <code>command</code>). Khi thiếu <code>type: "http"</code>, hệ thống sẽ báo lỗi cấu hình không hợp lệ hoặc cố gắng khởi chạy qua shell thất bại.
   </details>

3. *Sự khác biệt về mục đích sử dụng giữa MCP Resource và MCP Tool là gì?*
   <details>
   <summary>💡 Gợi ý đáp án kiến trúc</summary>
   <b>Resource</b> là dữ liệu chỉ đọc (read-only/passive data) do client hoặc người dùng nạp theo URI để bổ sung ngữ cảnh. <b>Tool</b> là hàm có thể thực thi (executable/active functions) có tham số, do mô hình chủ động quyết định gọi để tạo tác động hoặc truy vấn động.
   </details>

---

## 6. Tiêu chuẩn Nghiệm thu Đầu ra Tuần 2 (Weekly Sign-off Gate)

Bạn đã hoàn thành Tuần 2 khi:
- [ ] Hiểu rõ sự phân tách `stdout` và `stderr` trong [`mcp-server/src/index.ts`](../../mcp-server/src/index.ts).
- [ ] Lệnh kiểm tra toàn diện MCP server đạt chuẩn 100%:
  ```bash
  npm --prefix mcp-server run probe
  ```
  *(Kết quả: `Probe PASS — 16/16 check`)*
- [ ] Cả 4 subagent trong [`.claude/agents/`](../../.claude/agents) đều vượt qua bộ kiểm tra cú pháp frontmatter của `npm run validate`.

👉 **Chuyển sang [Tuần 3: Lập trình Điều khiển & Khung Kiểm soát (Agent SDK)](week-3.md)**

---
*Made by Anh Tu - Share to be share*
