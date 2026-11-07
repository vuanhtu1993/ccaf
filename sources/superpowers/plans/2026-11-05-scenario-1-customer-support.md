# Scenario 1: Customer Support Resolution Agent — Implementation Plan (100% Claude Ecosystem)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh bài lab thực hành Scenario 1 (Customer Support Resolution Agent) theo chuẩn đề thi CCA-F (Claude Certified Architect – Foundations), sử dụng **100% hệ sinh thái Claude** theo kiến trúc Ports & Adapters:
1. **Lõi Domain thuần (`src/domain/`):** 10 MCP-ready tools (có cặp tool dễ nhầm `search_product_catalog` vs `check_inventory`), lỗi có cấu trúc (`isError`, `errorCategory`, `isRetryable`), State-Driven Prerequisite Gate, Compliance Guard (`<= $500`), PostToolUse Trimmer/Normalizer (62 fields -> 5, Unix timestamp -> ISO-8601, numeric status code -> text), và `<case_facts>` manager.
2. **Part A — Claude Messages API Adapter (`src/adapters/messages-api.ts`):** Tự viết vòng lặp `while (response.stop_reason === 'tool_use')` kèm `ScriptedMockClient` để kiểm thử 100% offline mọi kịch bản đa lượt.
3. **Part B — Claude Agent SDK Adapter (`src/adapters/agent-sdk.ts`):** Đóng gói tools bằng `createSdkMcpServer()` và gắn native hooks `PreToolUse` (`permissionDecision: 'deny'`) & `PostToolUse` (`updatedToolOutput`, `additionalContext`).

**Tech Stack:** TypeScript (ESM), `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `zod`, `vitest`, `tsx`.

**Spec:** [sources/superpowers/specs/2026-11-05-scenario-1-customer-support-design.md](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/sources/superpowers/specs/2026-11-05-scenario-1-customer-support-design.md)

---

## Global Constraints (Quy tắc Bắt buộc từ Đề thi CCA-F)

1. **Loop Control (Task 1.1):** Ở Part A, bắt buộc điều khiển vòng lặp bằng `response.stop_reason === 'tool_use'` và kết thúc khi `'end_turn'`. Tuyệt đối không parse ngôn ngữ tự nhiên hay dùng regex để dừng vòng lặp. Giới hạn `maxIterations = 10` chỉ đóng vai trò cầu chì an toàn phụ (secondary safety cap).
2. **Parallel Tool Results (Task 1.1 & 1.4):** Khi một lượt phản hồi của Claude chứa nhiều khối `tool_use` (ví dụ 3 tools ở Act 1), toàn bộ kết quả thực thi phải được gom vào **một `user` message duy nhất** chứa mảng các khối `tool_result` tương ứng trước khi gửi lại API.
3. **State-Driven Prerequisite Gate (Task 1.4):** Trạng thái định danh (`verifiedCustomerId`) và kiểm định đơn hàng (`inspectedOrders`) trong `PrerequisiteGate` chỉ được cập nhật **tự động từ kết quả trả về của tool** (`get_customer` trả về đúng 1 khách duy nhất; `lookup_order` có `return_inspection_status === 'PASSED'`). Không cho phép LLM tự truyền tham số mở khóa.
4. **Deterministic Compliance Interception (Task 1.5):** Mọi lệnh gọi `process_refund` có `amount > 500` phải bị chặn cứng tại runtime (`PreToolUse`), trả về lỗi có cấu trúc `errorCategory: 'business'`, `isRetryable: false` kèm hướng dẫn chuyển sang `escalate_to_human`.
5. **PostToolUse Data Normalization & Trimming (Task 1.5 & 5.1):** Kết quả `lookup_order` từ ERP (62 trường phẳng, `delivery_timestamp` dạng Unix epoch, `order_status_code` dạng số) phải được cắt gọn còn đúng 5 trường cốt lõi, chuyển đổi sang chuỗi ISO-8601 và mã trạng thái chữ (`'DELIVERED'`) trước khi đưa vào context của model.
6. **Three Escalation Triggers (Task 5.2):**
   - `customer_requested_human`: Khi khách đòi gặp người thật, phải gọi **ngay lập tức** `escalate_to_human` mà không gọi thêm bất kỳ tool điều tra hay hoàn tiền nào.
   - `policy_gap`: Khi khách yêu cầu quyền lợi mà chính sách im lặng (ví dụ khớp giá sàn đối thủ sau khi tra `get_return_policy`), phải escalate thay vì tự ý từ chối hoặc tự bịa quy định.
   - `policy_threshold_exceeded`: Khi khoản hoàn tiền vượt ngưỡng tự động `$500` bị Compliance Hook chặn, phải chuyển hướng sang `escalate_to_human`.

---

## Cấu trúc thư mục dự kiến (`labs/scenario-1/`)

```
labs/scenario-1/
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── domain/
│   │   ├── types.ts
│   │   ├── mock-db.ts
│   │   ├── tools.ts
│   │   ├── prerequisite-gate.ts
│   │   ├── compliance-guard.ts
│   │   ├── context-trimmer.ts
│   │   ├── case-facts.ts
│   │   └── system-prompt.ts
│   └── adapters/
│       ├── messages-api.ts
│       └── agent-sdk.ts
├── __tests__/
│   ├── task-1-sanity.test.ts
│   ├── act-1-multi-intent.test.ts
│   ├── act-2-ambiguity-trimming.test.ts
│   ├── act-3-structured-errors.test.ts
│   ├── act-4-prerequisite-policy.test.ts
│   ├── act-5-compliance-escalation.test.ts
│   └── agent-sdk-adapter.test.ts
└── run-story.ts
```

---

### Task 0: Khởi tạo Package `labs/scenario-1` & Cấu hình TypeScript / Vitest

**Files:**
- Create: `labs/scenario-1/package.json`
- Create: `labs/scenario-1/tsconfig.json`
- Create: `labs/scenario-1/vitest.config.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Tạo `labs/scenario-1/package.json`, `tsconfig.json` và `vitest.config.ts`**
```json
// labs/scenario-1/package.json
{
  "name": "cca-f-lab-scenario-1",
  "version": "0.1.0",
  "private": true,
  "description": "CCAF Scenario 1 Lab: Customer Support Resolution Agent (Messages API + Claude Agent SDK + MCP)",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "story:api": "tsx run-story.ts --adapter=api",
    "story:sdk": "tsx run-story.ts --adapter=sdk"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.312",
    "@anthropic-ai/sdk": "^0.39.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@types/node": "^26.6.6",
    "tsx": "^4.19.2",
    "typescript": "^7.0.2",
    "vitest": "^3.0.0"
  }
}
```
```json
// labs/scenario-1/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  },
  "include": ["src/**/*", "__tests__/**/*", "run-story.ts"]
}
```
```typescript
// labs/scenario-1/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Thêm scripts tiện ích vào `package.json` gốc của repo**
  - Bổ sung vào `scripts` của root `package.json`:
    - `"lab:s1:test": "npm --prefix labs/scenario-1 test"`
    - `"lab:s1:story": "npm --prefix labs/scenario-1 run story:api"`
    - `"lab:s1:sdk": "npm --prefix labs/scenario-1 run story:sdk"`

- [ ] **Step 3: Cài đặt dependencies**
Run: `npm --prefix labs/scenario-1 install`
Expected: Cài đặt thành công, tạo `labs/scenario-1/node_modules`.

- [ ] **Step 4: Commit**
```bash
git add labs/scenario-1/package.json labs/scenario-1/tsconfig.json labs/scenario-1/vitest.config.ts package.json
git commit -m "chore(scenario-1): initialize lab package, tsconfig and vitest runner"
```

---

### Task 1: Domain Types, Mock ERP/CRM Database & Cơ chế Fault Injection

**Files:**
- Create: `labs/scenario-1/src/domain/types.ts`
- Create: `labs/scenario-1/src/domain/mock-db.ts`
- Create: `labs/scenario-1/__tests__/task-1-sanity.test.ts`

**Interfaces:**
- Produces: `ErrorCategory` (`'transient' | 'validation' | 'business' | 'permission'`), `StructuredToolResult<T>`, `Customer`, `RawErpOrder` (phẳng 62 keys, `delivery_timestamp: number`, `order_status_code: number`, `return_inspection_status: 'PENDING' | 'PASSED' | 'FAILED'`), `TrimmedOrder`, `HandoffSummary`, `EscalationTrigger` in `src/domain/types.ts`.
- Produces: `mockCustomers`, `mockOrders`, `mockCatalog`, `mockStores`, `mockPromos`, `returnPolicyText`, `injectFault()`, `consumeFault()`, `setOrderInspectionStatus()`, `resetMockDb()` in `src/domain/mock-db.ts`.

- [ ] **Step 1: Viết failing test kiểm tra dữ liệu ERP 62 trường phẳng, trùng tên khách hàng và Fault Injection**
```typescript
// labs/scenario-1/__tests__/task-1-sanity.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockCustomers,
  mockOrders,
  injectFault,
  consumeFault,
  resetMockDb,
  returnPolicyText,
} from '../src/domain/mock-db.js';

describe('Task 1: Domain Types, Mock ERP Database & Fault Injection', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should have exactly 2 customers named Alex Trần for ambiguity resolution (Task 5.2)', () => {
    const matches = mockCustomers.filter((c) => c.name === 'Alex Trần');
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.phone)).toEqual(['0901234567', '0987654321']);
  });

  it('should store ORD-8821 as a flat 62-field ERP record with Unix timestamp and numeric status code (Task 1.5 & 5.1)', () => {
    const order = mockOrders.find((o) => o.order_id === 'ORD-8821');
    expect(order).toBeDefined();
    expect(order?.total_amount).toBe(650);
    expect(typeof order?.delivery_timestamp).toBe('number');
    expect(order?.order_status_code).toBe(3); // 3 = DELIVERED
    expect(order?.return_inspection_status).toBe('PENDING');
    expect(Object.keys(order!).length).toBeGreaterThanOrEqual(62);
  });

  it('should support programmatic fault injection without polluting tool input schemas (Task 2.1 & 2.2)', () => {
    injectFault('create_warranty_ticket', {
      remainingFailures: 1,
      errorCategory: 'transient',
      message: 'ERP Warranty Service connection timed out after 3000ms',
    });

    const firstAttempt = consumeFault('create_warranty_ticket');
    expect(firstAttempt?.errorCategory).toBe('transient');

    const secondAttempt = consumeFault('create_warranty_ticket');
    expect(secondAttempt).toBeNull();
  });

  it('should provide a return policy that addresses own-site adjustments but is silent on competitor price matching (Task 5.2)', () => {
    expect(returnPolicyText).toContain('novasmart.vn');
    expect(returnPolicyText.toLowerCase()).not.toContain('sàn s');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL (`Cannot find module '../src/domain/mock-db.js'`)

- [ ] **Step 3: Hiện thực hóa `src/domain/types.ts` và `src/domain/mock-db.ts`**
  - Trong `types.ts`: định nghĩa rõ `StructuredToolResult<T>` có hai nhánh phân biệt theo `isError: false` (`data: T`) và `isError: true` (`errorCategory: ErrorCategory`, `isRetryable: boolean`, `message: string`, `suggestedAction?: string`).
  - Trong `mock-db.ts`: khởi tạo đơn hàng `ORD-8821` có đúng 62 thuộc tính cấp một (bao gồm 57 trường nội bộ ERP như `erp_warehouse_bin_code`, `erp_gl_account_id`, `erp_carrier_contract_ref`, v.v.) để `PostToolUse` hook thực hiện cắt gọt và chuẩn hóa thực chất.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/domain/types.ts labs/scenario-1/src/domain/mock-db.ts labs/scenario-1/__tests__/task-1-sanity.test.ts
git commit -m "feat(scenario-1): add domain types, 62-field flat ERP mock db and fault injection"
```

---

### Task 2: Hệ thống 10 Tools, Ranh giới Cặp Tool Tương đồng & Lỗi có Cấu trúc (Act 1 & Act 3)

**Files:**
- Create: `labs/scenario-1/src/domain/tools.ts`
- Create: `labs/scenario-1/__tests__/act-1-multi-intent.test.ts`
- Create: `labs/scenario-1/__tests__/act-3-structured-errors.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `mock-db.ts`.
- Produces: `TOOL_DEFINITIONS` (danh sách 10 tools kèm Zod schema & JSON Schema cho Anthropic API), `executeDomainTool(name, input)` in `src/domain/tools.ts`.

- [ ] **Step 1: Viết failing tests cho Act 1 (Tool Boundaries & Multi-intent) và Act 3 (Structured Errors & Valid Empty Result)**
```typescript
// labs/scenario-1/__tests__/act-1-multi-intent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TOOL_DEFINITIONS, executeDomainTool } from '../src/domain/tools.js';
import { resetMockDb } from '../src/domain/mock-db.js';

describe('Act 1: Tool Descriptions, Boundaries & Multi-Intent Informational Tools (Task 2.1)', () => {
  beforeEach(() => resetMockDb());

  it('should define all 10 canonical tools with clear boundary instructions between similar tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual([
      'search_product_catalog',
      'check_inventory',
      'lookup_store_location',
      'validate_promo',
      'get_customer',
      'lookup_order',
      'get_return_policy',
      'create_warranty_ticket',
      'process_refund',
      'escalate_to_human',
    ]);

    const catalogTool = TOOL_DEFINITIONS.find((t) => t.name === 'search_product_catalog')!;
    const inventoryTool = TOOL_DEFINITIONS.find((t) => t.name === 'check_inventory')!;

    // Exercise 1 requirement: differentiate similar tools with explicit boundary explanations
    expect(catalogTool.description).toContain('Do NOT use this tool to check stock');
    expect(inventoryTool.description).toContain('Do NOT use this tool for product specifications');
  });

  it('should execute informational tools for store location, inventory and promo code', async () => {
    const [inv, promo, store] = await Promise.all([
      executeDomainTool('check_inventory', { sku: 'ROBO-X1', district: 'Quận 1' }),
      executeDomainTool('validate_promo', { code: 'TECH20' }),
      executeDomainTool('lookup_store_location', { district: 'Quận 1' }),
    ]);

    expect(inv.isError).toBe(false);
    expect(promo.isError).toBe(false);
    expect(store.isError).toBe(false);
  });
});
```
```typescript
// labs/scenario-1/__tests__/act-3-structured-errors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { executeDomainTool } from '../src/domain/tools.js';
import { injectFault, resetMockDb } from '../src/domain/mock-db.js';

describe('Act 3: Structured MCP Error Responses & Valid Empty Results (Task 2.2)', () => {
  beforeEach(() => resetMockDb());

  it('should return retryable transient error when fault is injected, then succeed on retry', async () => {
    injectFault('create_warranty_ticket', {
      remainingFailures: 1,
      errorCategory: 'transient',
      message: 'Upstream warranty service 503 Service Unavailable',
    });

    const first = await executeDomainTool('create_warranty_ticket', {
      order_id: 'ORD-8821',
      issue_description: 'Robot bị móp vỏ khi giao hàng',
    });

    expect(first.isError).toBe(true);
    if (first.isError) {
      expect(first.errorCategory).toBe('transient');
      expect(first.isRetryable).toBe(true);
    }

    const second = await executeDomainTool('create_warranty_ticket', {
      order_id: 'ORD-8821',
      issue_description: 'Robot bị móp vỏ khi giao hàng',
    });
    expect(second.isError).toBe(false);
  });

  it('should return non-retryable validation error for invalid SKU format', async () => {
    const res = await executeDomainTool('check_inventory', {
      sku: '   ',
      district: 'Quận 1',
    });
    expect(res.isError).toBe(true);
    if (res.isError) {
      expect(res.errorCategory).toBe('validation');
      expect(res.isRetryable).toBe(false);
    }
  });

  it('should distinguish valid empty result (isError: false, matches: 0) from access failure (Task 2.2)', async () => {
    const emptyCustomer = await executeDomainTool('get_customer', {
      name: 'Người Không Tồn Tại',
    });
    expect(emptyCustomer.isError).toBe(false);
    if (!emptyCustomer.isError) {
      expect(emptyCustomer.data).toEqual({ matches: 0, customers: [] });
    }
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL (`Cannot find module '../src/domain/tools.js'`)

- [ ] **Step 3: Hiện thực hóa `src/domain/tools.ts`**
  - Viết mô tả chi tiết cho cả 10 tools theo đúng chuẩn Task 2.1 (nêu rõ input format, khi nào dùng, khi nào KHÔNG dùng, đặc biệt ở cặp `search_product_catalog` và `check_inventory`).
  - Đảm bảo `escalate_to_human` yêu cầu đầy đủ cấu trúc `HandoffSummary` (`customer_id`, `root_cause`, `refund_amount_requested`, `recommended_action`, `trigger_reason`).

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/domain/tools.ts labs/scenario-1/__tests__/act-1-multi-intent.test.ts labs/scenario-1/__tests__/act-3-structured-errors.test.ts
git commit -m "feat(scenario-1): implement 10 domain tools with boundary descriptions and structured errors"
```

---

### Task 3: State-Driven Prerequisite Gate & Compliance Guard (Act 4 & Act 5A Logic)

**Files:**
- Create: `labs/scenario-1/src/domain/prerequisite-gate.ts`
- Create: `labs/scenario-1/src/domain/compliance-guard.ts`
- Create: `labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts`

**Interfaces:**
- Produces: `PrerequisiteGate` (với `recordToolResult(toolName, result)` và `checkPreToolUse(toolName, input)`) in `src/domain/prerequisite-gate.ts`.
- Produces: `ComplianceGuard` (với `checkPreToolUse(toolName, input)`) in `src/domain/compliance-guard.ts`.

- [ ] **Step 1: Viết failing tests cho State-Driven Gate và Compliance Guard**
```typescript
// labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts
import { describe, it, expect } from 'vitest';
import { PrerequisiteGate } from '../src/domain/prerequisite-gate.js';
import { ComplianceGuard } from '../src/domain/compliance-guard.js';

describe('Act 4 & 5A: State-Driven Prerequisite Gate & Compliance Interception (Task 1.4 & 1.5)', () => {
  it('should NOT verify customer when get_customer returns 2 ambiguous matches', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 2,
        customers: [
          { customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' },
          { customer_id: 'CUST-002', name: 'Alex Trần', phone: '0987654321' },
        ],
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.errorCategory).toBe('business');
    expect(decision.errorResult?.isRetryable).toBe(false);
    expect(decision.errorResult?.message).toContain('verified customer');
  });

  it('should block process_refund when customer is verified but order return_inspection_status is PENDING', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        customer_id: 'CUST-001',
        return_inspection_status: 'PENDING',
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.message).toContain('inspection');
  });

  it('should allow process_refund once customer is uniquely verified AND order inspection is PASSED', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        customer_id: 'CUST-001',
        return_inspection_status: 'PASSED',
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(true);
  });

  it('should intercept and block refunds exceeding $500 with escalation redirect guidance', () => {
    const guard = new ComplianceGuard({ maxAutoRefundAmount: 500 });
    const decision = guard.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 650,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.errorCategory).toBe('business');
    expect(decision.errorResult?.isRetryable).toBe(false);
    expect(decision.errorResult?.suggestedAction).toBe('escalate_to_human');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL

- [ ] **Step 3: Hiện thực hóa `prerequisite-gate.ts` và `compliance-guard.ts`**
  - Không ném unhandled exception làm sập vòng lặp; trả về đối tượng `PreToolDecision` (`{ allowed: boolean; errorResult?: StructuredErrorResult }`) để cả Adapter Messages API (đóng gói thành `tool_result` có `is_error: true`) và Adapter Agent SDK (trả về `permissionDecision: 'deny'`) tái sử dụng.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/domain/prerequisite-gate.ts labs/scenario-1/src/domain/compliance-guard.ts labs/scenario-1/__tests__/act-4-prerequisite-policy.test.ts
git commit -m "feat(scenario-1): add state-driven prerequisite gate and $500 compliance guard"
```

---

### Task 4: PostToolUse Data Normalizer, Context Trimmer & Case Facts Manager (Act 2)

**Files:**
- Create: `labs/scenario-1/src/domain/context-trimmer.ts`
- Create: `labs/scenario-1/src/domain/case-facts.ts`
- Create: `labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts`

**Interfaces:**
- Produces: `normalizeAndTrimToolResult(toolName, result)` in `src/domain/context-trimmer.ts`.
- Produces: `CaseFactsManager` (với `ingestToolResult(toolName, result)`, `renderCaseFactsBlock()`, `injectIntoSystemPrompt(basePrompt)`) in `src/domain/case-facts.ts`.

- [ ] **Step 1: Viết failing tests cho Trimmer/Normalizer và Case Facts Manager**
```typescript
// labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAndTrimToolResult } from '../src/domain/context-trimmer.js';
import { CaseFactsManager } from '../src/domain/case-facts.js';
import { executeDomainTool } from '../src/domain/tools.js';
import { resetMockDb } from '../src/domain/mock-db.js';

describe('Act 2: PostToolUse Data Normalization, Trimming & Case Facts Persistence (Task 1.5 & 5.1)', () => {
  beforeEach(() => resetMockDb());

  it('should trim 62 flat ERP fields down to 5 essential fields and normalize Unix timestamp + numeric status code', async () => {
    const rawResult = await executeDomainTool('lookup_order', { order_id: 'ORD-8821' });
    expect(rawResult.isError).toBe(false);

    const rawJsonLength = JSON.stringify(rawResult).length;
    const trimmedResult = normalizeAndTrimToolResult('lookup_order', rawResult);
    const trimmedJsonLength = JSON.stringify(trimmedResult).length;

    expect(trimmedResult.isError).toBe(false);
    if (!trimmedResult.isError) {
      const data = trimmedResult.data as Record<string, unknown>;
      expect(Object.keys(data)).toEqual([
        'order_id',
        'status',
        'total_amount',
        'delivery_date_iso',
        'return_eligibility',
      ]);
      expect(data.status).toBe('DELIVERED'); // normalized from order_status_code: 3
      expect(String(data.delivery_date_iso)).toMatch(/^\d{4}-\d{2}-\d{2}T/); // normalized from Unix timestamp
      expect(data).not.toHaveProperty('erp_warehouse_bin_code');
    }

    // Chứng minh tiết kiệm > 70% dung lượng token/ký tự
    expect(trimmedJsonLength).toBeLessThan(rawJsonLength * 0.3);
  });

  it('should automatically extract transactional Case Facts from tool results into a persistent block', async () => {
    const facts = new CaseFactsManager();

    const custResult = await executeDomainTool('get_customer', { phone: '0901234567' });
    const orderResult = await executeDomainTool('lookup_order', { order_id: 'ORD-8821' });

    facts.ingestToolResult('get_customer', custResult);
    facts.ingestToolResult('lookup_order', orderResult);

    const prompt = facts.injectIntoSystemPrompt('Base System Prompt');
    expect(prompt).toContain('<case_facts>');
    expect(prompt).toContain('verified_customer_id: CUST-001');
    expect(prompt).toContain('order_id: ORD-8821');
    expect(prompt).toContain('order_total_amount: $650');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL

- [ ] **Step 3: Hiện thực hóa `context-trimmer.ts` và `case-facts.ts`**
  - Trong `context-trimmer.ts`: ánh xạ `order_status_code` (`1 -> 'PROCESSING'`, `2 -> 'SHIPPED'`, `3 -> 'DELIVERED'`, `4 -> 'RETURNED'`), chuyển `delivery_timestamp * 1000` sang `new Date(...).toISOString()`, và chỉ giữ lại 5 trường cốt lõi (`order_id`, `status`, `total_amount`, `delivery_date_iso`, `return_eligibility` gồm `items` và `return_inspection_status`).
  - Trong `case-facts.ts`: tự động bắt kết quả từ `get_customer` (khi `matches === 1`), `lookup_order`, và `create_warranty_ticket` để cập nhật `Map<string, string>` các sự kiện quan trọng.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/domain/context-trimmer.ts labs/scenario-1/src/domain/case-facts.ts labs/scenario-1/__tests__/act-2-ambiguity-trimming.test.ts
git commit -m "feat(scenario-1): add PostToolUse data normalizer, 62-to-5 field trimmer and case facts manager"
```

---

### Task 5 (Part A): Vòng lặp Messages API (`@anthropic-ai/sdk`), System Prompt Few-Shots & Kiểm thử Kịch bản Đa lượt (Act 1–5)

**Files:**
- Create: `labs/scenario-1/src/domain/system-prompt.ts`
- Create: `labs/scenario-1/src/adapters/messages-api.ts`
- Create: `labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts`

**Interfaces:**
- Produces: `buildCustomerSupportSystemPrompt()` (chứa tiêu chí Escalation + 3 few-shot examples chuẩn Task 4.2 & 5.2) in `src/domain/system-prompt.ts`.
- Produces: `MessagesApiSupportAgent`, `ScriptedMockAnthropicClient` in `src/adapters/messages-api.ts`.

- [ ] **Step 1: Viết failing integration tests cho toàn bộ vòng lặp Messages API qua `ScriptedMockAnthropicClient`**
```typescript
// labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MessagesApiSupportAgent,
  ScriptedMockAnthropicClient,
} from '../src/adapters/messages-api.js';
import { resetMockDb, setOrderInspectionStatus } from '../src/domain/mock-db.js';

describe('Part A — Messages API Agentic Loop & All 3 Escalation Triggers (Task 1.1, 1.4, 1.5, 5.2)', () => {
  beforeEach(() => resetMockDb());

  it('Act 1: should execute parallel tool_use blocks and append all tool_results in a single user message', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'check_inventory', input: { sku: 'ROBO-X1', district: 'Quận 1' } },
          { type: 'tool_use', id: 'tu_2', name: 'validate_promo', input: { code: 'TECH20' } },
          { type: 'tool_use', id: 'tu_3', name: 'lookup_store_location', input: { district: 'Quận 1' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Quận 1 còn 5 máy, mã TECH20 giảm 20%, mở cửa 8:00-22:00.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Kiểm tra tồn kho ROBO-X1 Q1, mã TECH20 và giờ mở cửa.');

    expect(turn.iterations).toBe(2);
    expect(turn.toolCallsExecuted).toEqual([
      'check_inventory',
      'validate_promo',
      'lookup_store_location',
    ]);

    // Kiểm tra message lịch sử thứ 3 (user message chứa kết quả tool) phải gom đủ 3 tool_result blocks
    const history = agent.getMessagesHistory();
    const toolResultMsg = history[2];
    expect(toolResultMsg.role).toBe('user');
    expect(Array.isArray(toolResultMsg.content)).toBe(true);
    expect((toolResultMsg.content as unknown[]).length).toBe(3);
  });

  it('Act 4: should block premature refund via PrerequisiteGate and escalate on competitor price-match policy gap', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_cust', name: 'get_customer', input: { phone: '0901234567' } },
          { type: 'tool_use', id: 'tu_ord', name: 'lookup_order', input: { order_id: 'ORD-8821' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          // Cố gọi hoàn tiền khi return_inspection_status đang là PENDING
          { type: 'tool_use', id: 'tu_ref', name: 'process_refund', input: { order_id: 'ORD-8821', amount: 200, reason: 'Khách đòi hoàn ngay' } },
          { type: 'tool_use', id: 'tu_pol', name: 'get_return_policy', input: { topic: 'price_matching' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_esc',
            name: 'escalate_to_human',
            input: {
              customer_id: 'CUST-001',
              root_cause: 'Khách yêu cầu khớp giá sàn đối thủ S (Policy Gap) và đòi hoàn tiền khi chưa kiểm định',
              refund_amount_requested: 200,
              recommended_action: 'Xem xét ngoại lệ khớp giá sàn S và hướng dẫn kiểm định hàng lỗi',
              trigger_reason: 'policy_gap',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Đã chuyển chuyên viên xử lý ngoại lệ chính sách khớp giá.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Hoàn tiền ngay hoặc khớp giá sàn S cho tôi!');

    expect(turn.blockedToolCalls).toContain('process_refund');
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('policy_gap');
  });

  it('Act 5A: should intercept refund > $500 via ComplianceGuard and redirect to escalate_to_human', async () => {
    setOrderInspectionStatus('ORD-8821', 'PASSED');

    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'get_customer', input: { phone: '0901234567' } },
          { type: 'tool_use', id: 'tu_2', name: 'lookup_order', input: { order_id: 'ORD-8821' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_3', name: 'process_refund', input: { order_id: 'ORD-8821', amount: 650, reason: 'Hàng lỗi đã kiểm định' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_4',
            name: 'escalate_to_human',
            input: {
              customer_id: 'CUST-001',
              root_cause: 'Khoản hoàn tiền $650 vượt hạn mức tự động $500',
              refund_amount_requested: 650,
              recommended_action: 'Phê duyệt hoàn tiền $650 cho đơn ORD-8821 đã kiểm định PASSED',
              trigger_reason: 'policy_threshold_exceeded',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Khoản hoàn $650 vượt hạn mức $500, đã chuyển quản lý phê duyệt.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Hoàn toàn bộ $650 cho đơn ORD-8821 giúp tôi.');

    expect(turn.blockedToolCalls).toEqual(['process_refund']);
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('policy_threshold_exceeded');
    expect(turn.handoffSummary?.refund_amount_requested).toBe(650);
  });

  it('Act 5B: should honor explicit human request IMMEDIATELY without calling investigation or refund tools', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_human',
            name: 'escalate_to_human',
            input: {
              customer_id: 'UNKNOWN_OR_PENDING',
              root_cause: 'Khách hàng yêu cầu trực tiếp gặp quản lý con người ngay lập tức',
              refund_amount_requested: 0,
              recommended_action: 'Tiếp nhận hội thoại trực tiếp theo yêu cầu khách hàng',
              trigger_reason: 'customer_requested_human',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Tôi đã kết nối ngay với quản lý hỗ trợ cho bạn.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Cho tôi gặp quản lý ngay lập tức!');

    // Tuyệt đối không có tool điều tra nào được gọi trước escalate_to_human (Task 5.2 L1173)
    expect(turn.toolCallsExecuted).toEqual(['escalate_to_human']);
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('customer_requested_human');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL

- [ ] **Step 3: Hiện thực hóa `system-prompt.ts` và `messages-api.ts`**
  - Trong `system-prompt.ts`: viết System Prompt chứa quy tắc phân định tool, quy tắc xử lý trùng tên, và **3 few-shot examples** minh họa rõ khi nào tự giải quyết (khách bực tức nhưng yêu cầu đơn giản trong hạn mức) vs khi nào escalate ngay (khách đòi gặp người thật, hoặc gặp Policy Gap).
  - Trong `messages-api.ts`: hiện thực hóa vòng lặp `while (response.stop_reason === 'tool_use')` kết hợp `PrerequisiteGate`, `ComplianceGuard`, `normalizeAndTrimToolResult`, và `CaseFactsManager`. Khi Gate/Guard chặn, trả về khối `tool_result` với `is_error: true` để model đọc được `suggestedAction: 'escalate_to_human'` và tự chuyển hướng ở lượt tiếp theo.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/domain/system-prompt.ts labs/scenario-1/src/adapters/messages-api.ts labs/scenario-1/__tests__/act-5-compliance-escalation.test.ts
git commit -m "feat(scenario-1): implement Part A Messages API agentic loop with scripted multi-turn tests"
```

---

### Task 6 (Part B): Adapter Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) — In-Process MCP Server & Native Hooks

**Files:**
- Create: `labs/scenario-1/src/adapters/agent-sdk.ts`
- Create: `labs/scenario-1/__tests__/agent-sdk-adapter.test.ts`

**Interfaces:**
- Consumes: `src/domain/*`, `@anthropic-ai/claude-agent-sdk`.
- Produces: `createNovaSmartMcpServer()`, `createNovaSmartSdkHooks(state)`, `buildNovaSmartAgentSdkOptions(state)` in `src/adapters/agent-sdk.ts`.

- [ ] **Step 1: Viết failing tests kiểm tra trực tiếp In-Process MCP Server và Native `PreToolUse` / `PostToolUse` Hooks của Claude Agent SDK**
```typescript
// labs/scenario-1/__tests__/agent-sdk-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNovaSmartMcpServer,
  createNovaSmartSdkHooks,
  NovaSmartSessionRuntime,
   invokePreToolUseHook,
  invokePostToolUseHook,
} from '../src/adapters/agent-sdk.js';
import { resetMockDb, mockOrders } from '../src/domain/mock-db.js';

describe('Part B — Claude Agent SDK Adapter: MCP Server & Native Hooks (Task 1.5 & 2.4)', () => {
  beforeEach(() => resetMockDb());

  it('should create an in-process SDK MCP server named novasmart', () => {
    const server = createNovaSmartMcpServer();
    expect(server).toBeDefined();
    expect(server.type).toBe('sdk');
    expect(server.name).toBe('novasmart');
  });

  it('PreToolUse hook should return permissionDecision: deny when refund exceeds $500 or prerequisites are missing', async () => {
    const runtime = new NovaSmartSessionRuntime();
    const hooks = createNovaSmartSdkHooks(runtime);

    // Chưa verify customer mà gọi mcp__novasmart__process_refund
    const unverifiedOutput = await invokePreToolUseHook(
      hooks,
      'mcp__novasmart__process_refund',
      { order_id: 'ORD-8821', amount: 100, reason: 'test' }
    );

    expect(unverifiedOutput.decision).toBe('block');
    expect(unverifiedOutput.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    if (unverifiedOutput.hookSpecificOutput?.hookEventName === 'PreToolUse') {
      expect(unverifiedOutput.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(unverifiedOutput.hookSpecificOutput.permissionDecisionReason).toContain('verified customer');
    }
  });

  it('PostToolUse hook should rewrite 62-field ERP output via updatedToolOutput and inject <case_facts> via additionalContext', async () => {
    const runtime = new NovaSmartSessionRuntime();
    const hooks = createNovaSmartSdkHooks(runtime);

    const rawErpOrder = mockOrders.find((o) => o.order_id === 'ORD-8821')!;
    const postOutput = await invokePostToolUseHook(
      hooks,
      'mcp__novasmart__lookup_order',
      { order_id: 'ORD-8821' },
      { isError: false, data: rawErpOrder }
    );

    expect(postOutput.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
    if (postOutput.hookSpecificOutput?.hookEventName === 'PostToolUse') {
      const updated = postOutput.hookSpecificOutput.updatedToolOutput as {
        isError: boolean;
        data: Record<string, unknown>;
      };
      expect(updated.data.status).toBe('DELIVERED');
      expect(updated.data).not.toHaveProperty('erp_warehouse_bin_code');
      expect(postOutput.hookSpecificOutput.additionalContext).toContain('<case_facts>');
      expect(postOutput.hookSpecificOutput.additionalContext).toContain('ORD-8821');
    }
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Run: `npm --prefix labs/scenario-1 test`
Expected: FAIL

- [ ] **Step 3: Hiện thực hóa `src/adapters/agent-sdk.ts`**
  - Sử dụng `createSdkMcpServer` và `tool()` từ `@anthropic-ai/claude-agent-sdk` để đăng ký toàn bộ 10 tools. Khi một tool trả về `result.isError === true`, trả về `{ isError: true, content: [{ type: 'text', text: JSON.stringify(result) }] }` đúng chuẩn MCP (Task 2.2).
  - Trong `createNovaSmartSdkHooks(runtime)`:
    - Hook `PreToolUse`: chuẩn hóa tên tool (bỏ tiền tố `mcp__novasmart__`), kiểm tra qua `runtime.gate` và `runtime.guard`. Nếu bị chặn, trả về `{ decision: 'block', reason, hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }`.
    - Hook `PostToolUse`: cập nhật trạng thái vào `runtime.gate.recordToolResult(...)`, cập nhật `runtime.caseFacts.ingestToolResult(...)`, chạy `normalizeAndTrimToolResult(...)` và trả về `{ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: trimmed, additionalContext: runtime.caseFacts.renderCaseFactsBlock() } }`.

- [ ] **Step 4: Chạy lại toàn bộ test suites để xác nhận PASS**
Run: `npm --prefix labs/scenario-1 test`
Expected: Toàn bộ 7 test suites PASS 100% offline.

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-1/src/adapters/agent-sdk.ts labs/scenario-1/__tests__/agent-sdk-adapter.test.ts
git commit -m "feat(scenario-1): implement Part B Claude Agent SDK adapter with MCP server and native hooks"
```

---

### Task 7: Storyline Runner Trực quan & Học liệu Ôn thi CCA-F (README + 5 Câu hỏi Trắc nghiệm MCQ)

**Files:**
- Create: `labs/scenario-1/run-story.ts`
- Create: `labs/scenario-1/README.md`

**Interfaces:**
- Produces: CLI script `labs/scenario-1/run-story.ts` (chạy trọn vẹn Hồi 1 -> Hồi 5B với bảng so sánh token trước/sau khi trim, log trạng thái Gate/Guard và Handoff Summary).
- Produces: Tài liệu hướng dẫn `labs/scenario-1/README.md` kèm 5 câu hỏi trắc nghiệm mô phỏng đề thi CCA-F.

- [ ] **Step 1: Hiện thực hóa `labs/scenario-1/run-story.ts`**
  - Diễn họa tuần tự 5 Hồi (Act 1, Act 2, Act 3, Act 4, Act 5A & Act 5B) của khách hàng Alex Trần.
  - Ở mỗi hồi, in rõ:
    - Câu hỏi của khách hàng.
    - Các khối `tool_use` được phát ra và `stop_reason` của từng vòng lặp.
    - Trạng thái của `PrerequisiteGate`, `ComplianceGuard`, dung lượng payload trước và sau `PostToolUse` Trimmer (ví dụ: giảm từ ~2,100 bytes xuống ~260 bytes), và khối `<case_facts>`.
    - Đối chiếu cách xử lý ở **Part A (Messages API)** và **Part B (Claude Agent SDK Hooks)**.

- [ ] **Step 2: Biên soạn `labs/scenario-1/README.md`**
  - Giải thích lý thuyết theo cấu trúc **Definition Anatomy**, **Root Cause Analysis**, và **Trade-offs** giữa tự viết vòng lặp bằng Messages API với dùng Claude Agent SDK.
  - Bổ sung **5 câu hỏi trắc nghiệm (Mini Exam Quiz)** bám sát các bẫy của Scenario 1 (kiểm tra `stop_reason`, `PostToolUse` normalization, `PreToolUse` `$500` threshold, xử lý trùng tên khách hàng, và phân biệt 3 triggers escalation) kèm lời giải chi tiết vì sao các đáp án nhiễu là sai.

- [ ] **Step 3: Chạy kiểm chứng toàn bộ Lab (Tests + Typecheck + Story Runner)**
Run: `npm --prefix labs/scenario-1 run typecheck && npm run lab:s1:test && npm run lab:s1:story`
Expected: Typecheck sạch lỗi, toàn bộ 7 bộ Vitest PASS, và Story Runner in trọn vẹn hành trình 5 Hồi.

- [ ] **Step 4: Commit**
```bash
git add labs/scenario-1/run-story.ts labs/scenario-1/README.md
git commit -m "docs(scenario-1): add interactive 5-act story runner and CCAF exam study guide"
```

---
*Made by Anh Tu - Share to be share*
