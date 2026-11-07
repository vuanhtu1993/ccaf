# Thiết Kế Chi Tiết: Lab Scenario 1 - Customer Support Resolution Agent (100% Claude Ecosystem)
**Mã bài thi:** CCA-F (Claude Certified Architect – Foundations)  
**Tác giả:** Anh Tú  
**Trạng thái:** Đã phê duyệt (Approved — Revision v2)  
**Ngày lập:** 2026-11-05 | **Cập nhật:** 2026-11-07  

---

## 1. Intent & The Why (Mục đích & Bối cảnh ra đời)

### 1.1. Bối cảnh & Lý do ra đời (Root Cause)
Trong các hệ thống AI thế hệ đầu (Gen 1), chatbot chăm sóc khách hàng chủ yếu hoạt động dựa trên cây quyết định cứng nhắc (Decision Trees) hoặc tìm kiếm ngữ nghĩa đơn thuần (RAG). Khi ứng dụng Large Language Models (LLM) vào bài toán hỗ trợ khách hàng, chúng ta đối mặt với một xung đột kiến trúc cốt lõi:
* **Bản chất của LLM:** Là mô hình tính toán xác suất (Probabilistic), giỏi suy luận ngữ cảnh nhưng có thể bị ảo giác (hallucination), bỏ sót bước quy trình hoặc bị thao túng qua prompt injection.
* **Bản chất của nghiệp vụ khách hàng:** Các thao tác tài chính (hoàn tiền, hủy đơn, điều chỉnh hóa đơn) đòi hỏi tính tất định 100% (Deterministic) và tuân thủ chặt chẽ các chính sách công ty.

Bên cạnh đó, trong đề thi **CCA-F**, học viên phải nắm vững **hai tầng trừu tượng khác nhau** của hệ sinh thái Claude:
1. **Tầng Động cơ — Claude Messages API (`@anthropic-ai/sdk`):** Nơi lập trình viên tự viết vòng lặp kiểm tra `response.stop_reason === 'tool_use'` và tự nối các khối `tool_result` vào lịch sử hội thoại (Task 1.1).
2. **Tầng Khung vận hành — Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) & MCP:** Nơi vòng lặp đã được đóng gói trong `query()`, công cụ được cung cấp qua MCP Server (`createSdkMcpServer`), và việc kiểm soát tất định được thực hiện qua các callback `PreToolUse` / `PostToolUse` Hooks (Task 1.4, 1.5, 2.1, 2.2).

Do đó, Lab Scenario 1 được thiết kế theo kiến trúc **Ports & Adapters (Hexagonal)** sử dụng **100% hệ sinh thái Claude**: viết một lõi nghiệp vụ thuần (`src/domain/`) và gắn vào hai bộ chuyển đổi song song (**Part A: Messages API** và **Part B: Claude Agent SDK**) để học viên vừa nhìn thấu cơ chế bên dưới nắp máy, vừa thành thạo công cụ Production chuẩn mực của đề thi.

### 1.2. Định nghĩa & Giải phẫu Khái niệm (Definition Anatomy)
> **Định nghĩa:** Một *Customer Support Resolution Agent* trong kiến trúc Claude là một hệ thống tác tử lai (Hybrid Agent System) sử dụng vòng lặp điều phối dựa trên trạng thái dừng (`stop_reason`) kết hợp với giao thức công cụ chuẩn hóa (MCP Tools), các cổng kiểm soát điều kiện tiên quyết và tuân thủ tại thời điểm chạy (`PreToolUse` Hooks & Prerequisite Gates), cùng cơ chế chuẩn hóa và tinh gọn ngữ cảnh (`PostToolUse` Trimmer & Case Facts Block) nhằm tối đa hóa tỷ lệ giải quyết ngay lần đầu (First-Contact Resolution - FCR >= 80%) đồng thời chuyển giao cho con người (Escalation) kịp thời, chính xác kèm bản tóm tắt có cấu trúc (Structured Handoff Summary).

* **Hybrid Agent System (Hệ thống tác tử lai):** Kết hợp khả năng suy luận linh hoạt của Claude (phân rã đa ý định, nhận diện lỗ hổng chính sách qua few-shot examples) với các chốt chặn tất định bằng TypeScript.
* **Vòng lặp `stop_reason` (Messages API) vs `query()` (Agent SDK):** Ở tầng API, vòng lặp tiếp tục khi `stop_reason === "tool_use"` và kết thúc khi `"end_turn"` (kèm một giới hạn phụ `maxIterations` làm cầu chì an toàn). Ở tầng Agent SDK, vòng lặp này được tự động hóa bên trong `query()`.
* **Prerequisite Gates & `PreToolUse` Compliance Hooks:** Chốt chặn tất định tại runtime. Trạng thái của Gate được cập nhật **tự động từ kết quả thực thi tool** (ví dụ: `get_customer` trả về đúng 1 khách hàng duy nhất mới mở khóa `verifiedCustomerId`), ngăn chặn hoàn tiền khi chưa đủ điều kiện hoặc khi số tiền vượt ngưỡng `$500` (`permissionDecision: 'deny'`).
* **`PostToolUse` Normalization & Context Trimmer:** Chốt chặn sau khi tool chạy xong, giúp cắt bỏ 57/62 trường ERP dư thừa, đồng thời chuẩn hóa dữ liệu không đồng nhất (`unix_timestamp` sang `ISO-8601`, mã trạng thái số `3` sang `'DELIVERED'`) qua `updatedToolOutput` và bơm khối `<case_facts>` qua `additionalContext`.
* **First-Contact Resolution (FCR) & Structured Escalation:** Tự động giải quyết trọn vẹn các yêu cầu nằm trong chính sách; nhưng khi gặp **3 triggers chuẩn** (khách đòi gặp người thật, lỗ hổng chính sách như khớp giá đối thủ, hoặc vượt ngưỡng tài chính `$500`), hệ thống lập tức kích hoạt `escalate_to_human` kèm `HandoffSummary` có cấu trúc.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals (Mục tiêu bắt buộc)
1. Hiện thực hóa trọn vẹn hành trình 5 Hồi (gồm Act 1, Act 2, Act 3, Act 4, Act 5A & Act 5B) của khách hàng **Alex Trần** tại thương hiệu công nghệ **NovaSmart**.
2. Bao phủ 100% các Task Statements của Đề thi CCA-F liên quan đến Scenario 1 và Exercise 1:
   * **Domain 1:** Task 1.1 (Loop `stop_reason`, gộp `tool_result`, tránh anti-patterns), Task 1.4 (State-driven Prerequisite Gates, multi-concern parallel decomposition, structured handoff summary), Task 1.5 (`PreToolUse` compliance hook chặn refund `> $500` & `PostToolUse` hook chuẩn hóa Unix timestamp / numeric status code).
   * **Domain 2:** Task 2.1 (Thiết kế 10 tools có mô tả ranh giới rõ ràng, bao gồm cặp tool dễ nhầm `search_product_catalog` vs `check_inventory`), Task 2.2 (Structured error metadata `isError`, `errorCategory`, `isRetryable` và phân biệt kết quả rỗng hợp lệ với lỗi truy cập).
   * **Domain 4 & 5:** Task 4.2 & 5.2 (System prompt với tiêu chí Escalation tường minh + 3 few-shot examples; phân biệt 3 triggers escalation; xử lý trùng tên khách hàng), Task 5.1 (Context trimming 62 -> 5 fields, khối `<case_facts>` độc lập).
3. Cung cấp **Bộ kiểm thử tự động (Vitest Kata)** chạy 100% offline qua `ScriptedMockClient` (không cần API key vẫn kiểm chứng được toàn bộ vòng lặp) và **Storyline Runner** hỗ trợ cả 2 chế độ `--adapter=api` và `--adapter=sdk`.

### 2.2. Non-Goals (Không thuộc phạm vi bài lab)
* Không sử dụng bất kỳ framework bên thứ ba nào ngoài hệ sinh thái Claude (không dùng LangChain, Strands, hay LlamaIndex).
* Không xây dựng giao diện Web UI/Frontend phức tạp (tập trung 100% vào kiến trúc backend và terminal output).
* Không phụ thuộc vào cơ sở dữ liệu thật (dùng Mock Data In-Memory có cơ chế Fault Injection để mô phỏng lỗi mạng).

### 2.3. Anti-Goals (Các điều cấm kỵ / Bẫy thiết kế trong đề thi cần tránh)
* **Anti-pattern 1 (Task 1.1):** Dùng regex, kiểm tra chuỗi văn bản của assistant, hoặc dùng `maxIterations` làm cơ chế dừng chính thay vì `response.stop_reason`.
* **Anti-pattern 2 (Task 1.4 & 1.5):** Dựa vào lời nhắc trong System Prompt để cấm hoàn tiền trên `$500` hoặc bắt xác minh danh tính, hoặc cho phép LLM tự truyền cờ `verified: true` vào Gate thay vì lấy trạng thái từ kết quả tool.
* **Anti-pattern 3 (Task 2.1):** Đặt các cờ phục vụ kiểm thử (như `simulate_transient_failure`) vào trong JSON Schema của tool khiến LLM nhìn thấy.
* **Anti-pattern 4 (Task 5.1):** Đưa toàn bộ 62 fields ERP thô vào lịch sử hội thoại hoặc để các con số tài chính bị tóm tắt mờ nhạt qua nhiều lượt chat.
* **Anti-pattern 5 (Task 5.2):** Tự ý chọn khách hàng đầu tiên khi `get_customer` trả về nhiều người trùng tên, hoặc tự ý từ chối/bịa chính sách khi gặp yêu cầu nằm ngoài văn bản quy định (Policy Gap).
* **Anti-pattern 6 (Task 5.2):** Tiếp tục gọi tool điều tra hoặc cố gắng hoàn tiền khi khách hàng đã trực tiếp yêu cầu gặp người thật (*"Honoring explicit customer requests for human agents immediately without first attempting investigation"*).

---

## 3. Technical Approaches & Trade-offs

| Tiêu chí | Phương án 1: Chỉ dùng `@anthropic-ai/sdk` | Phương án 2: Chỉ dùng `@anthropic-ai/claude-agent-sdk` | Phương án 3: Ports & Adapters — Cả 2 tầng Claude (Được chọn) |
| :--- | :--- | :--- | :--- |
| **Mô tả** | Tự viết vòng lặp và tự giả lập hooks bằng `if/else` | Chỉ cấu hình `query()`, `createSdkMcpServer`, `hooks` | Lõi `domain/` thuần + Adapter Messages API (Part A) + Adapter Agent SDK (Part B) |
| **Thấy rõ `stop_reason` (Task 1.1)** | Có (Trực quan 100%) | Không (Bị ẩn bên trong `query()`) | **Có (Học viên tự tay code ở Part A)** |
| **Chuẩn `PreToolUse` / `PostToolUse` & MCP (Task 1.5, 2.4)** | Không (Chỉ là hàm TS tự quy ước) | Có (Đúng chữ ký hàm của SDK) | **Có (Thực hành chuẩn xác ở Part B)** |
| **Kiểm thử Offline (`npm run check`)** | Dễ dàng qua Mock Client | Cần subprocess CLI nếu chạy `query()` | **Tuyệt đối (Unit test toàn bộ Domain + Loop Part A + Hook Callbacks Part B)** |

---

## 4. Architectural Design (Kiến trúc Chi tiết)

### 4.1. Cấu trúc thư mục dự án (`labs/scenario-1/`)

```
labs/scenario-1/
├── README.md                         # Lý thuyết Definition Anatomy + Bảng so sánh + 5 câu MCQ
├── package.json                      # Dependencies & scripts độc lập cho Lab 1
├── tsconfig.json                     # Cấu hình TypeScript chuẩn NodeNext
├── vitest.config.ts                  # Cấu hình chạy Vitest Kata
├── src/
│   ├── domain/                       # LÕI NGHIỆP VỤ THUẦN (Không phụ thuộc SDK)
│   │   ├── types.ts                  # Customer, RawErpOrder, TrimmedOrder, StructuredToolResult, HandoffSummary
│   │   ├── mock-db.ts                # Dữ liệu NovaSmart (2 Alex Trần, ORD-8821 62 fields) + Fault Injection
│   │   ├── tools.ts                  # 10 Tools (có cặp dễ nhầm search_product_catalog vs check_inventory)
│   │   ├── prerequisite-gate.ts      # State-driven Gate: tự cập nhật từ kết quả get_customer & lookup_order
│   │   ├── compliance-guard.ts       # Chặn hoàn tiền > $500 và hướng dẫn chuyển sang escalate_to_human
│   │   ├── context-trimmer.ts        # Cắt 62 -> 5 fields, đổi Unix timestamp -> ISO-8601, status code 3 -> DELIVERED
│   │   ├── case-facts.ts             # Tự động rút trích <case_facts> từ kết quả tool
│   │   └── system-prompt.ts          # System Prompt kèm Escalation Criteria & 3 Few-Shot Examples
│   └── adapters/                     # HAI BỘ CHUYỂN ĐỔI TRONG HỆ SINH THÁI CLAUDE
│       ├── messages-api.ts           # Part A: Vòng lặp while (stop_reason === 'tool_use') + ScriptedMockClient
│       └── agent-sdk.ts              # Part B: createSdkMcpServer('novasmart') + PreToolUse & PostToolUse Hooks
├── __tests__/                        # BỘ KIỂM THỬ VITEST KATA (Chạy 100% Offline)
│   ├── task-1-sanity.test.ts
│   ├── act-1-multi-intent.test.ts
│   ├── act-2-ambiguity-trimming.test.ts
│   ├── act-3-structured-errors.test.ts
│   ├── act-4-prerequisite-policy.test.ts
│   ├── act-5-compliance-escalation.test.ts
│   └── agent-sdk-adapter.test.ts
└── run-story.ts                      # Script diễn họa 5 Hồi (--adapter=api hoặc --adapter=sdk)
```

### 4.2. Thiết kế chi tiết 5 Hồi (Detailed Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Alex Trần
    participant Agent as Claude Agent (Messages API / Agent SDK)
    participant PreHook as PreToolUse (Prerequisite Gate & Compliance Guard)
    participant MCP as NovaSmart MCP Tools (Mock ERP/CRM)
    participant PostHook as PostToolUse (Trimmer, Normalizer & CaseFacts)

    Note over Customer, PostHook: Hồi 1: Phân rã Đa ý định & Phân biệt Cặp Tool Tương đồng (Task 1.4, 2.1)
    Customer->>Agent: Hỏi tồn kho Robot X1 tại Q1 + Mã TECH20 + Giờ mở cửa Q1
    Agent->>MCP: Gọi song song 3 tools: check_inventory, validate_promo, lookup_store_location
    MCP-->>Agent: Trả về 3 tool_result trong CÙNG 1 user message
    Agent-->>Customer: Tổng hợp câu trả lời mạch lạc cho cả 3 vấn đề

    Note over Customer, PostHook: Hồi 2: Mơ hồ Danh tính & Cắt gọt / Chuẩn hóa Dữ liệu (Task 1.5, 5.1, 5.2)
    Customer->>Agent: "Tôi là Alex Trần, kiểm tra đơn hàng ORD-8821 giúp tôi"
    Agent->>MCP: get_customer(name="Alex Trần")
    MCP-->>PostHook: Trả về 2 khách hàng trùng tên (Q1 và Q7)
    PostHook-->>Agent: Gate giữ verifiedCustomerId = null (do matches > 1)
    Agent-->>Customer: Dừng vòng lặp (end_turn), yêu cầu cung cấp SĐT để định danh
    Customer->>Agent: "SĐT của tôi là 0901234567"
    Agent->>MCP: get_customer(phone="0901234567") & lookup_order(order_id="ORD-8821")
    MCP-->>PostHook: Trả về 1 khách duy nhất + Đơn ORD-8821 (62 fields, unix_timestamp, status_code=3)
    PostHook-->>Agent: Gate mở khóa CUST-001; Trimmer cắt còn 5 fields, đổi sang ISO-8601 & 'DELIVERED'; cập nhật <case_facts>
    Agent-->>Customer: Thông báo chi tiết đơn hàng ORD-8821 ($650)

    Note over Customer, PostHook: Hồi 3: Lỗi Tạm thời & Tự Phục hồi Cục bộ (Task 2.2)
    Customer->>Agent: "Robot bị móp vỏ, tạo phiếu bảo hành giúp tôi"
    Agent->>MCP: create_warranty_ticket(order_id="ORD-8821") [Lần 1: Fault Injected]
    MCP-->>Agent: { isError: true, errorCategory: "transient", isRetryable: true }
    Agent->>MCP: Tự động retry create_warranty_ticket(order_id="ORD-8821") [Lần 2]
    MCP-->>PostHook: { isError: false, data: { ticket_id: "WT-9001" } }
    PostHook-->>Agent: Ghi nhận WT-9001 vào <case_facts>
    Agent-->>Customer: Xác nhận đã tạo phiếu bảo hành WT-9001 thành công

    Note over Customer, PostHook: Hồi 4: Chặn Hoàn tiền Sớm (Gate) & Lỗ hổng Chính sách (Policy Gap) (Task 1.4, 5.2)
    Customer->>Agent: "Hoàn tiền ngay đơn ORD-8821 cho tôi, hoặc khớp giá sàn S đang bán rẻ hơn $50!"
    Agent->>PreHook: Gọi process_refund(order_id="ORD-8821", amount=200)
    PreHook-->>Agent: CHẶN ĐỨNG (return_inspection_status = 'PENDING', chưa hoàn tất kiểm định)
    Agent->>MCP: Gọi get_return_policy(topic="price_matching")
    MCP-->>Agent: Chính sách chỉ hỗ trợ khớp giá trên website NovaSmart, IM LẶNG về sàn đối thủ
    Agent->>MCP: Gọi escalate_to_human(trigger_reason="policy_gap", ...)
    MCP-->>Agent: Xác nhận phiếu chuyển giao ESC-101
    Agent-->>Customer: Giải thích cần kiểm định hàng trước khi hoàn tiền & chuyển chuyên viên xử lý yêu cầu khớp giá đối thủ

    Note over Customer, PostHook: Hồi 5A & 5B: Chặn Vượt Hạn mức $500 vs Yêu cầu Gặp Người thật Trực tiếp (Task 1.5, 5.2)
    Customer->>Agent: [Kịch bản 5A] (Sau khi kiểm định PASSED) "Hãy hoàn toàn bộ $650 của đơn ORD-8821"
    Agent->>PreHook: Gọi process_refund(order_id="ORD-8821", amount=650)
    PreHook-->>Agent: CHẶN ĐỨNG (ComplianceGuard: $650 > hạn mức tự động $500, isRetryable: false)
    Agent->>MCP: Gọi escalate_to_human(trigger_reason="policy_threshold_exceeded", refund_amount_requested=650)
    Agent-->>Customer: Thông báo khoản hoàn $650 vượt hạn mức tự động $500, đã bàn giao quản lý kèm Handoff Summary
    Customer->>Agent: [Kịch bản 5B] "Tôi không muốn nói chuyện với bot nữa, cho tôi gặp quản lý ngay lập tức!"
    Agent->>MCP: Gọi NGAY LẬP TỨC escalate_to_human(trigger_reason="customer_requested_human") [KHÔNG gọi thêm tool điều tra]
    Agent-->>Customer: Lập tức kết nối quản lý kèm bản tóm tắt hồ sơ
```

---

## 5. Danh mục 10 Tools Chuẩn hóa (Source of Truth)

| # | Tên Tool | Nhóm | Mục đích & Ranh giới (Tool Boundary) |
| :- | :--- | :--- | :--- |
| 1 | `search_product_catalog` | Informational | Tra cứu thông số kỹ thuật, tính năng, giá niêm yết của sản phẩm. **KHÔNG** dùng để kiểm tra số lượng tồn kho tại cửa hàng. |
| 2 | `check_inventory` | Informational | Kiểm tra số lượng tồn kho thực tế của một mã `sku` tại một quận/chi nhánh cụ thể. **KHÔNG** dùng để tra cứu thông số kỹ thuật. |
| 3 | `lookup_store_location` | Informational | Tra cứu địa chỉ, số điện thoại và giờ mở cửa của chi nhánh NovaSmart theo quận. |
| 4 | `validate_promo` | Informational | Kiểm tra tính hợp lệ, phần trăm giảm giá và điều kiện đơn tối thiểu của mã khuyến mãi. |
| 5 | `get_customer` | CRM Lookup | Tìm kiếm hồ sơ khách hàng theo `name` hoặc `phone`. Có thể trả về 0, 1 hoặc nhiều bản ghi trùng tên. |
| 6 | `lookup_order` | ERP Lookup | Tra cứu đơn hàng theo `order_id`. Backend trả về 62 fields ERP thô kèm `delivery_timestamp` (Unix) và `order_status_code` (Numeric). |
| 7 | `get_return_policy` | Policy Lookup | Tra cứu văn bản chính sách đổi trả, hoàn tiền và khớp giá chính thức của NovaSmart. |
| 8 | `create_warranty_ticket` | Action | Tạo phiếu tiếp nhận bảo hành cho đơn hàng bị lỗi phần cứng/ngoại quan. |
| 9 | `process_refund` | Financial Action | Thực hiện hoàn tiền tự động. Bị kiểm soát bởi `PrerequisiteGate` (phải verified customer + passed inspection) và `ComplianceGuard` (`amount <= $500`). |
| 10 | `escalate_to_human` | Resolution Handoff | Chuyển giao phiên hỗ trợ cho chuyên viên con người kèm `HandoffSummary` có cấu trúc (`customer_id`, `root_cause`, `refund_amount_requested`, `recommended_action`, `trigger_reason`). |

---
*Made by Anh Tu - Share to be share*
