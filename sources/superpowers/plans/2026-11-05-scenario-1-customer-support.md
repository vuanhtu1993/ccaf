# Scenario 1: Customer Support Resolution Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh bài lab thực hành Scenario 1 (Customer Support Resolution Agent) theo chuẩn CCAF (Claude Certified Architect – Foundations), bao gồm lõi Agentic Loop bằng `@anthropic-ai/sdk`, hệ thống Hooks, Prerequisite Gates, 5 file kiểm thử Vitest tương ứng 5 Hồi và Storyline Runner trực quan.

**Architecture:** Sử dụng kiến trúc Hybrid: Lõi Agent chạy vòng lặp kiểm tra `stop_reason === 'tool_use'` kết hợp cơ chế chặn tất định (Runtime Hooks & Prerequisite Gates) và quản lý ngữ cảnh phân tầng (Case Facts block + PostToolUse Trimmer). Toàn bộ được kiểm chứng qua bộ Vitest Katas và một script diễn họa kịch bản 5 Hồi của Alex Trần tại NovaSmart.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk`, `zod`, `vitest`, `tsx`.

**Spec:** [docs/superpowers/specs/2026-11-05-scenario-1-customer-support-design.md](file:///Users/anhtus/Documents/Development/agentic-ai/strands-harness-sdk/strands-ts/docs/superpowers/specs/2026-11-05-scenario-1-customer-support-design.md)

---

## Global Constraints

- Không dùng regex hay parse natural language để dừng Agentic Loop; bắt buộc dùng `response.stop_reason`.
- Giới hạn hoàn tiền tối đa tự động là $500; bất kỳ giao dịch nào > $500 phải bị chặn cứng bằng code hook tại runtime.
- Không đưa toàn bộ 60+ fields ERP thô vào conversation context; phải dùng `PostToolUse` Hook cắt gọt chỉ giữ 5 fields cốt lõi.
- Xử lý trùng tên: khi `get_customer` trả về > 1 kết quả, không được chọn bừa, phải dừng lại hỏi thêm định danh.
- Khi khách hàng trực tiếp yêu cầu gặp người thật, phải lập tức kích hoạt luồng Escalate kèm Structured Handoff Summary.

## Review Focus

1. **Khách hàng yêu cầu nhiều tác vụ cùng lúc (Multi-intent):** Agent phải gọi song song các tools và tổng hợp kết quả đầy đủ.
2. **ERP trả về dữ liệu cồng kềnh (Context Pollution):** Dữ liệu sau khi trim phải không còn các trường kỹ thuật như `warehouse_shelf_id`, `tax_exempt_code`.
3. **Lỗi mạng tạm thời khi tạo ticket bảo hành (Transient Failure):** Tool trả về `isRetryable: true` và Agent tự động retry mà không làm gián đoạn người dùng.
4. **Cố tình gọi hoàn tiền khi chưa kiểm định lỗi (Bypass Prerequisite):** Prerequisite Gate phải ném lỗi chặn đứng việc gọi `process_refund`.
5. **Khách hàng yêu cầu khớp giá đối thủ (Policy Gap):** Agent nhận diện chính sách không có điều khoản "Price Match", từ chối tự biên tự diễn và đề xuất chuyển giao con người.

---

## Cấu trúc thư mục dự kiến (`labs/scenario-1/`)

```
labs/scenario-1/
├── README.md
├── vitest.config.ts
├── src/
│   ├── types.ts
│   ├── mock-db.ts
│   ├── tools.ts
│   ├── gates/
│   │   └── prerequisite.ts
│   ├── hooks/
│   │   ├── context-trimmer.ts
│   │   └── compliance-guard.ts
│   ├── context-manager.ts
│   └── agent.ts
├── __tests__/
│   ├── act-1-multi-intent.test.ts
│   ├── act-2-ambiguity-trimming.test.ts
│   ├── act-3-structured-errors.test.ts
│   ├── act-4-prerequisite-policy.test.ts
│   └── act-5-compliance-escalation.test.ts
└── run-story.ts
```

---

### Task 1: Định nghĩa Types, Mock Database & Cấu hình Vitest

**Files:**
- Create: `labs/scenario-1/vitest.config.ts`
- Create: `labs/scenario-1/src/types.ts`
- Create: `labs/scenario-1/src/mock-db.ts`
- Test: `labs/scenario-1/__tests__/task-1-sanity.test.ts`

**Interfaces:**
- Produces: `Customer`, `Order`, `OrderItem`, `StoreLocation`, `Promotion`, `WarrantyTicket`, `StructuredToolResult`, `StructuredError`, `HandoffSummary` in `src/types.ts`.
- Produces: `mockCustomers`, `mockOrders`, `mockStores`, `mockPromos`, `resetMockDb()` in `src/mock-db.ts`.

- [ ] **Step 1: Write the failing sanity test**
```typescript
// labs/scenario-1/__tests__/task-1-sanity.test.ts
import { describe, it, expect } from 'vitest'
import { mockCustomers, mockOrders, mockStores } from '../src/mock-db.js'

describe('Task 1: Mock Database & Types Sanity', () => {
  it('should have 2 customers with name Alex Trần for ambiguity testing', () => {
    const alexs = mockCustomers.filter((c) => c.name === 'Alex Trần')
    expect(alexs.length).toBe(2)
  })

  it('should have ORD-8821 with total amount $650 and raw ERP data fields', () => {
    const order = mockOrders.find((o) => o.order_id === 'ORD-8821')
    expect(order).toBeDefined()
    expect(order?.total_amount).toBe(650)
    expect(order?.raw_erp_data).toBeDefined()
    expect(Object.keys(order!.raw_erp_data).length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-1/__tests__/task-1-sanity.test.ts`
Expected: FAIL (Cannot find module '../src/mock-db.js')

- [ ] **Step 3: Implement `types.ts`, `mock-db.ts` and `vitest.config.ts`**
  - Tạo `types.ts` với đầy đủ interfaces cho khách hàng, đơn hàng, dữ liệu ERP thô 60 fields, phiếu bảo hành, lỗi có cấu trúc (`isError`, `errorCategory`, `isRetryable`).
  - Tạo `mock-db.ts` với dữ liệu mô phỏng NovaSmart: 2 Alex Trần (1 tại Q1 SĐT 0901234567, 1 tại Q7 SĐT 0987654321), đơn hàng `ORD-8821` giá $650, mã giảm giá `TECH20`.
  - Tạo `vitest.config.ts` trỏ project cấu hình runner.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-1/__tests__/task-1-sanity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/
git commit -m "feat(scenario-1): add domain types, mock db and test setup"
```

---

### Task 2: Hiện thực hóa MCP Tools & Xử lý Lỗi có cấu trúc (Act 1 & Act 3)

**Files:**
- Create: `labs/scenario-1/src/tools.ts`
- Create: `labs/scenario-1/__tests__/act-1-multi-intent.test.ts`
- Create: `labs/scenario-1/__tests__/act-3-structured-errors.test.ts`

**Interfaces:**
- Consumes: Types and mock DB from Task 1.
- Produces: `toolsDefinition` (Anthropic Tool[]), `executeTool(name, input, sessionContext)` in `src/tools.ts`.

- [ ] **Step 1: Write the failing tests for Act 1 and Act 3**
```typescript
// labs/scenario-1/__tests__/act-1-multi-intent.test.ts
import { describe, it, expect } from 'vitest'
import { executeTool, toolsDefinition } from '../src/tools.js'

describe('Act 1: Informational Tools & Multi-intent Contracts', () => {
  it('should define tools with distinct descriptions and schemas', () => {
    const names = toolsDefinition.map((t) => t.name)
    expect(names).toContain('lookup_store_location')
    expect(names).toContain('check_inventory')
    expect(names).toContain('validate_promo')
  })

  it('should return store location and opening hours for Q1', async () => {
    const result = await executeTool('lookup_store_location', { district: 'Quận 1' })
    expect(result.isError).toBe(false)
    expect(result.data.open_hours).toBeDefined()
  })
})
```
```typescript
// labs/scenario-1/__tests__/act-3-structured-errors.test.ts
import { describe, it, expect } from 'vitest'
import { executeTool } from '../src/tools.js'

describe('Act 3: Structured Error Handling & Transient Recovery', () => {
  it('should return structured transient error on initial warranty ticket failure', async () => {
    const result = await executeTool('create_warranty_ticket', {
      order_id: 'ORD-8821',
      issue_description: 'Robot móp vỏ',
      simulate_transient_failure: true
    })
    expect(result.isError).toBe(true)
    expect(result.errorCategory).toBe('transient')
    expect(result.isRetryable).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-1/__tests__/act-1-multi-intent.test.ts labs/scenario-1/__tests__/act-3-structured-errors.test.ts`
Expected: FAIL (Cannot find module '../src/tools.js')

- [ ] **Step 3: Implement `src/tools.ts`**
  - Định nghĩa 7 tools: `lookup_store_location`, `check_inventory`, `validate_promo`, `get_customer`, `lookup_order`, `create_warranty_ticket`, `process_refund`, `escalate_to_human`.
  - Mỗi tool có input_schema chuẩn và mô tả phân biệt ranh giới rõ ràng.
  - Xử lý trả về định dạng chuẩn: `{ isError: false, data }` hoặc `{ isError: true, errorCategory, isRetryable, message }`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-1/__tests__/act-1-multi-intent.test.ts labs/scenario-1/__tests__/act-3-structured-errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/tools.ts labs/scenario-1/__tests__/
git commit -m "feat(scenario-1): implement mcp tools and structured error responses"
```

---

### Task 3: Hiện thực hóa Prerequisite Gates & Compliance Interception Hooks (Act 4 & Act 5 Logic)

**Files:**
- Create: `labs/scenario-1/src/gates/prerequisite.ts`
- Create: `labs/scenario-1/src/hooks/compliance-guard.ts`
- Create: `labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts`

**Interfaces:**
- Produces: `SessionState`, `PrerequisiteGate` in `src/gates/prerequisite.ts`.
- Produces: `ComplianceGuard` in `src/hooks/compliance-guard.ts`.

- [ ] **Step 1: Write the failing test for Gates & Compliance Hook**
```typescript
// labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts
import { describe, it, expect } from 'vitest'
import { PrerequisiteGate, PrerequisiteViolationError } from '../src/gates/prerequisite.js'
import { ComplianceGuard, ComplianceViolationError } from '../src/hooks/compliance-guard.js'

describe('Act 4 & 5: Prerequisite Gates & Compliance Guard', () => {
  it('should block process_refund when inspection has not passed', () => {
    const gate = new PrerequisiteGate()
    gate.verifyCustomer('CUST-001')
    // Chưa verify inspection_passed
    expect(() => gate.assertCanRefund('ORD-8821')).toThrow(PrerequisiteViolationError)
  })

  it('should intercept and block refunds greater than $500', () => {
    const guard = new ComplianceGuard({ maxAutoRefundAmount: 500 })
    expect(() => guard.checkRefundCompliance(650)).toThrow(ComplianceViolationError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/gates/prerequisite.ts` and `src/hooks/compliance-guard.ts`**
  - `PrerequisiteGate`: Theo dõi trạng thái session (verified customer, inspected returned item). Nếu thiếu điều kiện mà gọi refund -> ném lỗi `PrerequisiteViolationError`.
  - `ComplianceGuard`: Nhận `amount`, nếu `amount > maxAutoRefundAmount` (mặc định $500) -> ném lỗi `ComplianceViolationError` chứa chỉ dẫn redirect sang escalation.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/gates/ labs/scenario-1/src/hooks/compliance-guard.ts labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts
git commit -m "feat(scenario-1): add prerequisite gate and compliance guard"
```

---

### Task 4: PostToolUse Context Trimmer Hook & Case Facts Manager (Act 2)

**Files:**
- Create: `labs/scenario-1/src/hooks/context-trimmer.ts`
- Create: `labs/scenario-1/src/context-manager.ts`
- Create: `labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts`

**Interfaces:**
- Produces: `trimToolResult(toolName, rawResult)` in `src/hooks/context-trimmer.ts`.
- Produces: `ContextManager` (manages Case Facts block + message history) in `src/context-manager.ts`.

- [ ] **Step 1: Write the failing test for Context Trimmer & Case Facts**
```typescript
// labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts
import { describe, it, expect } from 'vitest'
import { trimToolResult } from '../src/hooks/context-trimmer.js'
import { ContextManager } from '../src/context-manager.js'
import { mockOrders } from '../src/mock-db.js'

describe('Act 2: Context Trimming & Case Facts Management', () => {
  it('should trim 60+ ERP fields down to 5 essential fields and convert timestamp to ISO', () => {
    const rawOrder = mockOrders[0]
    const trimmed = trimToolResult('lookup_order', rawOrder)
    
    expect(trimmed).toHaveProperty('order_id')
    expect(trimmed).toHaveProperty('status')
    expect(trimmed).toHaveProperty('total_amount')
    expect(trimmed).toHaveProperty('delivery_date')
    expect(trimmed).toHaveProperty('items')
    expect(trimmed).not.toHaveProperty('raw_erp_data')
    expect(trimmed.delivery_date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should format Case Facts into prompt outside summarized conversation history', () => {
    const cm = new ContextManager()
    cm.updateCaseFact('order_id', 'ORD-8821')
    cm.updateCaseFact('customer_name', 'Alex Trần')
    
    const systemPromptWithFacts = cm.buildSystemPrompt('You are NovaSmart Support.')
    expect(systemPromptWithFacts).toContain('<case_facts>')
    expect(systemPromptWithFacts).toContain('ORD-8821')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `context-trimmer.ts` and `context-manager.ts`**
  - `trimToolResult`: Nhận kết quả từ `lookup_order`, loại bỏ `raw_erp_data`, format `unix_timestamp` sang ISO-8601 string.
  - `ContextManager`: Lưu `Map<string, string>` các Case Facts, chèn vào System Prompt bên trong thẻ `<case_facts>`, đồng thời quản lý mảng tin nhắn `Anthropic.MessageParam[]`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/hooks/context-trimmer.ts labs/scenario-1/src/context-manager.ts labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts
git commit -m "feat(scenario-1): add context trimmer hook and case facts manager"
```

---

### Task 5: Lõi Agentic Loop thuần `@anthropic-ai/sdk` & Kiểm thử tích hợp Escalation (Act 5)

**Files:**
- Create: `labs/scenario-1/src/agent.ts`
- Create: `labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts`

**Interfaces:**
- Consumes: All modules from Tasks 1-4.
- Produces: `CustomerSupportAgent` class with `runTurn(userInput: string): Promise<AgentResponse>` in `src/agent.ts`.

- [ ] **Step 1: Write the failing test for Act 5 Escalation and Agentic Loop**
```typescript
// labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts
import { describe, it, expect } from 'vitest'
import { CustomerSupportAgent } from '../src/agent.js'

describe('Act 5: Compliance Interception & Structured Escalation Handoff', () => {
  it('should immediately escalate with handoff summary when customer explicitly asks for human', async () => {
    const agent = new CustomerSupportAgent({ mockMode: true })
    const response = await agent.runTurn('Cho tôi gặp quản lý ngay lập tức!')
    
    expect(response.escalated).toBe(true)
    expect(response.handoffSummary).toBeDefined()
    expect(response.handoffSummary?.trigger_reason).toBe('customer_requested_human')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `CustomerSupportAgent` in `src/agent.ts`**
  - Khởi tạo client `@anthropic-ai/sdk`.
  - Hỗ trợ `mockMode` cho unit test (trả về mock response định sẵn mà không cần API key) và `liveMode` (gọi Anthropic API thật).
  - Triển khai vòng lặp `while (response.stop_reason === 'tool_use')`:
    - Duyệt qua từng tool call trong `response.content`.
    - Kiểm tra `PrerequisiteGate` và `ComplianceGuard`.
    - Thực thi tool -> Chạy `PostToolUse` context trimmer.
    - Đưa tool result vào context -> Gọi lượt tiếp theo.
  - Nhận diện trigger escalate: khách yêu cầu người thật -> đóng gói `HandoffSummary` và dừng loop.

- [ ] **Step 4: Run all 5 act tests to verify they all pass**
Run: `npx vitest run labs/scenario-1/`
Expected: All 5 test suites PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/agent.ts labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts
git commit -m "feat(scenario-1): implement agentic loop with stop_reason and escalation protocol"
```

---

### Task 6: Storyline Runner trực quan & Tài liệu hướng dẫn thực hành

**Files:**
- Create: `labs/scenario-1/run-story.ts`
- Create: `labs/scenario-1/README.md`
- Modify: `package.json` (thêm script `lab:s1` và `lab:s1:test`)

**Interfaces:**
- Produces: Executable script `run-story.ts` simulating the entire 5-Act story of Alex Trần with pedagogical log outputs.

- [ ] **Step 1: Implement `run-story.ts`**
  - Chạy tuần tự từ Hồi 1 đến Hồi 5 của Alex Trần.
  - In ra console màu mè, phân tích rõ từng bước:
    - `[Act 1]` Khách hỏi 3 việc -> Model phát ra 3 tool calls song song.
    - `[Act 2]` Tìm khách ra 2 Alex Trần -> Agent dừng lại hỏi SĐT. Sau khi có SĐT -> Kích hoạt Trimmer: giảm từ 62 fields xuống 5 fields (tiết kiệm token).
    - `[Act 3]` Lỗi mạng timeout -> Tool trả về `isRetryable: true` -> Agent tự retry thành công.
    - `[Act 4]` Đòi khớp giá đối thủ -> Agent nhận diện Policy Gap và từ chối.
    - `[Act 5]` Đòi hoàn $650 -> Compliance Hook chặn đứng -> Tạo Structured Handoff Summary.

- [ ] **Step 2: Add scripts to `package.json` and create `README.md`**
  - Thêm `"lab:s1": "tsx labs/scenario-1/run-story.ts"` và `"lab:s1:test": "vitest run labs/scenario-1"` vào `package.json`.
  - Soạn thảo `labs/scenario-1/README.md` giải thích lý thuyết, các câu hỏi CCAF liên quan, cách chạy và bài tập mở rộng cho học viên.

- [ ] **Step 3: Run the end-to-end Story Runner**
Run: `npm run lab:s1`
Expected: Script chạy trọn vẹn 5 Hồi không lỗi, in đầy đủ phân tích sư phạm.

- [ ] **Step 4: Commit**
```bash
git add labs/scenario-1/run-story.ts labs/scenario-1/README.md package.json
git commit -m "feat(scenario-1): add interactive storyline runner and lab guide"
```

---
*Made by Anh Tu - Share to be share*
