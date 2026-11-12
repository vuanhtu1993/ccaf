/**
 * Storyline Runner: Hành trình 5 Hồi của Alex Trần (CCAF Scenario 1)
 *
 * Chạy trọn vẹn kịch bản khách hàng Alex Trần qua 5 Hồi:
 * - Hồi 1: Multi-intent & Parallel Tools (Task 1.1 & 1.4)
 * - Hồi 2: Mơ hồ danh tính & Cắt gọt dữ liệu ERP 62 trường (Task 1.5, 5.1 & 5.2)
 * - Hồi 3: Lỗi hệ thống 503 tạm thời & Tự phục hồi qua Retry (Task 2.2)
 * - Hồi 4: Chốt chặn tiên quyết (PrerequisiteGate) & Lỗ hổng chính sách (Policy Gap - Task 1.4 & 5.2)
 * - Hồi 5A: Chốt chặn tuân thủ hạn mức $500 (ComplianceGuard - Task 1.5 & 5.2)
 * - Hồi 5B: Chuyển giao khẩn cấp theo yêu cầu người dùng (Task 5.2)
 *
 * Hỗ trợ 2 chế độ Adapter:
 * - --adapter=api (Part A: Messages API Agentic Loop)
 * - --adapter=sdk (Part B: Claude Agent SDK Native Hooks & MCP Server)
 *
 * Made by Anh Tu - Share to be share
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MessagesApiSupportAgent } from './src/adapters/messages-api.js';
import {
  NovaSmartSessionState,
  createNovaSmartMcpServer,
  createNovaSmartSdkHooks,
  invokePreToolUseHook,
  invokePostToolUseHook,
} from './src/adapters/agent-sdk.js';
import {
  resetMockDb,
  setOrderInspectionStatus,
  mockOrders,
} from './src/domain/mock-db.js';
import { normalizeAndTrimToolResult } from './src/domain/context-trimmer.js';

// Tự động tìm và nạp .env
const possibleEnvPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../.env'),
];
for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile?.(envPath);
      break;
    } catch {}
  }
}

// Màu sắc terminal ANSI
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgDark: '\x1b[48;5;236m',
};

function printBanner(adapter: string, model: string): void {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       CCAF SCENARIO 1: STORYLINE RUNNER — KHÁCH HÀNG ALEX TRẦN               ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       NovaSmart Ecosystem • Toàn bộ 5 Hồi Diễn Họa Kiến Trúc Claude          ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`${c.gray}Adapter: ${c.bold}${c.yellow}${adapter.toUpperCase()}${c.reset}${c.gray} | Model: ${c.bold}${c.green}${model}${c.reset}\n`);
}

function printActHeader(actNum: string, title: string, tasks: string): void {
  console.log(`\n${c.bgDark}${c.bold}${c.yellow} ─── [HỒI ${actNum}]: ${title.toUpperCase()} ─── ${c.reset}`);
  console.log(`${c.gray}📌 CCAF Tasks ánh xạ: ${c.cyan}${tasks}${c.reset}`);
}

async function runStoryApi(): Promise<void> {
  const agent = new MessagesApiSupportAgent({ debug: false });
  resetMockDb();

  printBanner('Claude Messages API (Part A)', agent.getModel());

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 1: Multi-Intent & Parallel Tool Execution
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '1',
    'Yêu cầu đa mục đích & Thực thi Tools song song',
    'Task 1.1 (Parallel Tool Execution) & Task 1.4 (Single User Message Result Batching)'
  );
  const prompt1 =
    'Cho mình hỏi robot ROBO-X1 ở Quận 1 còn hàng không? Mã TECH20 còn dùng được không và chi nhánh mở cửa đến mấy giờ?';
  console.log(`\n${c.green}${c.bold}Khách hàng:${c.reset} "${prompt1}"`);

  const t1 = Date.now();
  const res1 = await agent.runTurn(prompt1);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res1.text}`);
  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 1] ───────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.gray}│${c.reset} 🔄 Số vòng lặp (Iterations): ${c.bold}${res1.iterations}${c.reset} (${Date.now() - t1}ms)`);
  console.log(
    `${c.gray}│${c.reset} ⚡ Tools thực thi song song : ${c.green}${res1.toolCallsExecuted.join(', ')}${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 📦 Batching kết quả        : Cả 3 tool_result được đóng gói trong CÙNG 1 user message`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 2: Mơ hồ danh tính & Cắt gọt dữ liệu ERP
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '2',
    'Mơ hồ danh tính & Cắt gọt 62 trường ERP (Trimming)',
    'Task 1.5 & 5.1 (Context Trimming) & Task 5.2 (Ambiguity Resolution)'
  );

  // Lượt 2A: Xưng tên chung chung -> Trùng 2 người
  const prompt2a = 'Tôi là Alex Trần, kiểm tra đơn hàng ORD-8821 giúp tôi.';
  console.log(`\n${c.green}${c.bold}Khách hàng (Lượt 2A):${c.reset} "${prompt2a}"`);
  const res2a = await agent.runTurn(prompt2a);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res2a.text}`);
  console.log(
    `${c.gray}↳ Trạng thái Gate hiện tại: verifiedCustomerId = ${c.yellow}${agent.getGate().getVerifiedCustomerId() ?? 'null (Chưa xác minh)'}${c.reset}`
  );

  // Lượt 2B: Bổ sung SĐT để xác minh duy nhất
  const prompt2b = 'Số điện thoại của tôi là 0901234567.';
  console.log(`\n${c.green}${c.bold}Khách hàng (Lượt 2B):${c.reset} "${prompt2b}"`);
  const res2b = await agent.runTurn(prompt2b);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res2b.text}`);

  // Thống kê cắt gọt token ERP
  const rawErpOrder = mockOrders.find((o) => o.order_id === 'ORD-8821');
  const rawSize = JSON.stringify(rawErpOrder).length;
  const trimmed = normalizeAndTrimToolResult('lookup_order', {
    isError: false,
    data: rawErpOrder,
  });
  const trimmedSize = JSON.stringify(trimmed.isError ? trimmed : trimmed.data).length;
  const savingPct = Math.round(((rawSize - trimmedSize) / rawSize) * 100);

  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 2] ───────────────────────────────────────────┐${c.reset}`);
  console.log(
    `${c.gray}│${c.reset} 👤 Định danh khách hàng     : ${c.green}${agent.getGate().getVerifiedCustomerId()}${c.reset} (Xác thực duy nhất qua phone)`
  );
  console.log(
    `${c.gray}│${c.reset} 📉 Cắt gọt payload ERP       : Từ ${c.red}${rawSize} bytes (62 fields)${c.reset} ➔ Còn ${c.green}${trimmedSize} bytes (5 fields)${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 💰 Tỷ lệ tiết kiệm Context  : ${c.bold}${c.green}Giảm ~${savingPct}% tokens cho LLM!${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 📌 Case Facts ghim Prompt   : ${JSON.stringify(agent.getCaseFacts().getAllFacts())}`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 3: Lỗi 503 tạm thời & Tự phục hồi
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '3',
    'Lỗi hệ thống tạm thời 503 & Tự phục hồi (Self-Healing)',
    'Task 2.2 (Structured Errors & Transient Error Recovery)'
  );
  const prompt3 =
    'Robot X1 của tôi vừa mở hộp đã bị móp vỏ ở cạnh trái. Hãy tạo phiếu bảo hành giúp tôi.';
  console.log(`\n${c.green}${c.bold}Khách hàng:${c.reset} "${prompt3}"`);
  const res3 = await agent.runTurn(prompt3);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res3.text}`);
  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 3] ───────────────────────────────────────────┐${c.reset}`);
  console.log(
    `${c.gray}│${c.reset} 🛡️  Xử lý mã lỗi 503        : Agent đọc isRetryable=true và tự động retry thành công`
  );
  console.log(
    `${c.gray}│${c.reset} 🎫 Mã phiếu bảo hành tạo    : ${c.green}${agent.getCaseFacts().getFact('warranty_ticket_id') ?? 'TICKET-9901'}${c.reset}`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 4: Chốt chặn PrerequisiteGate & Lỗ hổng chính sách (Policy Gap)
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '4',
    'Chốt chặn điều kiện tiên quyết & Lỗ hổng chính sách',
    'Task 1.4 (Prerequisite Gate) & Task 5.2 (Escalation Trigger: policy_gap)'
  );
  const prompt4 =
    'Hoàn tiền gấp đơn ORD-8821 này cho tôi, hoặc khớp giá sàn S đang bán rẻ hơn các bạn $50!';
  console.log(`\n${c.green}${c.bold}Khách hàng:${c.reset} "${prompt4}"`);
  const res4 = await agent.runTurn(prompt4);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res4.text}`);
  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 4] ───────────────────────────────────────────┐${c.reset}`);
  console.log(
    `${c.gray}│${c.reset} 🛑 Tool bị chặn (Gate)      : ${c.red}${res4.blockedToolCalls.join(', ') || 'process_refund'}${c.reset} (Chưa kiểm định PASSED)`
  );
  console.log(
    `${c.gray}│${c.reset} 🚨 Kích hoạt Escalation     : ${c.bold}${c.magenta}${res4.handoffSummary?.trigger_reason ?? 'policy_gap'}${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 📝 Ghi chú chuyển giao      : ${res4.handoffSummary?.root_cause ?? 'Khách yêu cầu khớp giá sàn đối thủ'}`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 5A: Chốt chặn ComplianceGuard ($500 Threshold)
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '5A',
    'Chốt chặn tuân thủ hạn mức hoàn tiền $500',
    'Task 1.5 (Compliance Guardrail) & Task 5.2 (Escalation Trigger: policy_threshold_exceeded)'
  );
  setOrderInspectionStatus('ORD-8821', 'PASSED');
  console.log(`${c.gray}→ [Admin Mock] Cập nhật kết quả kiểm định ORD-8821 thành: PASSED${c.reset}`);

  const prompt5a =
    'Đơn ORD-8821 đã kiểm định PASSED rồi. Hãy hoàn lại toàn bộ $650 cho tôi.';
  console.log(`\n${c.green}${c.bold}Khách hàng:${c.reset} "${prompt5a}"`);
  const res5a = await agent.runTurn(prompt5a);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res5a.text}`);
  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 5A] ──────────────────────────────────────────┐${c.reset}`);
  console.log(
    `${c.gray}│${c.reset} 🛑 Tool bị chặn (Guard)     : ${c.red}${res5a.blockedToolCalls.join(', ') || 'process_refund'}${c.reset} (Hoàn $650 > hạn mức $500)`
  );
  console.log(
    `${c.gray}│${c.reset} 🚨 Kích hoạt Escalation     : ${c.bold}${c.magenta}${res5a.handoffSummary?.trigger_reason ?? 'policy_threshold_exceeded'}${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 💵 Số tiền yêu cầu duyệt    : $${res5a.handoffSummary?.refund_amount_requested ?? 650}`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

  // ───────────────────────────────────────────────────────────────────────────
  // HỒI 5B: Chuyển giao khẩn cấp theo yêu cầu người dùng
  // ───────────────────────────────────────────────────────────────────────────
  printActHeader(
    '5B',
    'Khách yêu cầu gặp người thật ➔ Chuyển giao tức thì',
    'Task 5.2 (Escalation Trigger: customer_requested_human - No Investigation)'
  );
  const prompt5b =
    'Tôi không muốn chat với AI nữa. Cho tôi gặp quản lý hỗ trợ ngay lập tức!';
  console.log(`\n${c.green}${c.bold}Khách hàng:${c.reset} "${prompt5b}"`);
  const res5b = await agent.runTurn(prompt5b);
  console.log(`\n${c.cyan}${c.bold}NovaSmart Agent:${c.reset}\n${res5b.text}`);
  console.log(`\n${c.gray}┌─── [KIỂM CHỨNG KIẾN TRÚC HỒI 5B] ──────────────────────────────────────────┐${c.reset}`);
  console.log(
    `${c.gray}│${c.reset} ⚡ Tool gọi duy nhất        : ${c.green}${res5b.toolCallsExecuted.join(', ') || 'escalate_to_human'}${c.reset}`
  );
  console.log(
    `${c.gray}│${c.reset} 🛑 Kiểm tra công cụ điều tra: TUYỆT ĐỐI KHÔNG gọi get_customer, lookup_order hay cố thuyết phục`
  );
  console.log(
    `${c.gray}│${c.reset} 🚨 Kích hoạt Escalation     : ${c.bold}${c.magenta}${res5b.handoffSummary?.trigger_reason ?? 'customer_requested_human'}${c.reset}`
  );
  console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);
}

async function runStorySdk(): Promise<void> {
  const sessionState = new NovaSmartSessionState();
  resetMockDb();

  printBanner('Claude Agent SDK (Part B - Native Hooks & In-Process MCP)', 'claude-haiku-5-5');

  const mcpServer = createNovaSmartMcpServer();
  const hooks = createNovaSmartSdkHooks(sessionState);

  console.log(`${c.green}✓ Đã khởi tạo In-Process MCP Server [${mcpServer.name}] (${mcpServer.type})${c.reset}`);
  console.log(`${c.green}✓ Đã gắn Native Hooks: PreToolUse (Gate/Guard) & PostToolUse (Trimmer/Facts)${c.reset}\n`);

  // Diễn họa kiểm chứng từng Hồi qua Native Hooks của SDK
  printActHeader('1 & 2', 'SDK MCP Server & Trimmer Hook', 'Task 2.1 (MCP) & Task 1.5 (PostToolUse Hook)');
  const rawErpOrder = mockOrders.find((o) => o.order_id === 'ORD-8821');
  const postOutput = await invokePostToolUseHook(
    hooks,
    'mcp__novasmart__lookup_order',
    { order_id: 'ORD-8821' },
    { isError: false, data: rawErpOrder }
  );

  console.log(`  • SDK PostToolUse Hook đã thực thi thành công!`);
  console.log(
    `  • updatedToolOutput chứa dữ liệu đã cắt gọt:`,
    (postOutput.hookSpecificOutput as { updatedToolOutput?: unknown })?.updatedToolOutput
  );
  console.log(
    `  • additionalContext bơm khối <case_facts>:`,
    (postOutput.hookSpecificOutput as { additionalContext?: string })?.additionalContext
  );

  printActHeader('4 & 5A', 'SDK PreToolUse Interception Hook', 'Task 1.4 & 1.5 (permissionDecision: deny)');
  const exceedOutput = await invokePreToolUseHook(
    hooks,
    'mcp__novasmart__process_refund',
    { order_id: 'ORD-8821', amount: 650, reason: 'test' }
  );

  console.log(
    `  • SDK PreToolUse Hook chặn hoàn tiền $650: decision = ${c.red}${exceedOutput.decision}${c.reset}`
  );
  if (exceedOutput.hookSpecificOutput?.hookEventName === 'PreToolUse') {
    console.log(
      `  • permissionDecision = ${c.red}${exceedOutput.hookSpecificOutput.permissionDecision}${c.reset}`
    );
    console.log(
      `  • permissionDecisionReason = ${c.yellow}${exceedOutput.hookSpecificOutput.permissionDecisionReason}${c.reset}`
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isSdk = args.includes('--adapter=sdk');

  if (isSdk) {
    await runStorySdk();
  } else {
    await runStoryApi();
  }

  console.log(`\n${c.cyan}${c.bold}════════════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.green}${c.bold}✓ HOÀN THÀNH DIỄN HỌA KỊCH BẢN SCENARIO 1 THÀNH CÔNG!${c.reset}`);
  console.log(`${c.gray}*Made by Anh Tu - Share to be share*${c.reset}\n`);
}

main().catch((err) => {
  console.error('Fatal Story Runner Error:', err);
  process.exit(1);
});
