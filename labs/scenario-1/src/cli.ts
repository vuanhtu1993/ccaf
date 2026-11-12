/**
 * Interactive Terminal CLI cho Scenario 1: Customer Support Resolution Agent
 *
 * Hỗ trợ chuyển đổi linh hoạt giữa 2 Adapters:
 * 1. Part A: MessagesApiSupportAgent (Manual while loop @anthropic-ai/sdk)
 * 2. Part B: AgentSdkSupportAgent (Native hooks & In-process MCP @anthropic-ai/claude-agent-sdk)
 *
 * Tích hợp SessionInspector hiển thị minh bạch 2 vùng dữ liệu:
 * - Vùng 1: LLM Context Window (Claude đọc được: system prompt, <case_facts>, messages)
 * - Vùng 2: Harness Application State (Claude không thấy: PrerequisiteGate, ComplianceGuard)
 *
 * Made by Anh Tu - Share to be share
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  MessagesApiSupportAgent,
  type AgentTurnResult,
} from './adapters/messages-api.js';
import { AgentSdkSupportAgent } from './adapters/agent-sdk.js';
import { SessionInspector } from './domain/session-inspector.js';
import { resetMockDb, setOrderInspectionStatus } from './domain/mock-db.js';

// ANSI color escape codes
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
  bgDark: '\x1b[48;5;236m',
};

export interface SupportAgent {
  runTurn(userInput: string): Promise<AgentTurnResult>;
  getModel(): string;
  getAdapterName(): string;
  getInspector(): SessionInspector;
  setDebug(enabled: boolean): void;
  isDebug(): boolean;
  reset(): void;
}

type AdapterType = 'api' | 'sdk';

function createAgent(type: AdapterType, debug: boolean): SupportAgent {
  if (type === 'sdk') {
    return new AgentSdkSupportAgent({ debug });
  }
  return new MessagesApiSupportAgent({ debug });
}

function printBanner(adapterName: string, modelName: string): void {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       CCAF SCENARIO 1: CUSTOMER SUPPORT RESOLUTION AGENT (CLI REPL)          ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       NovaSmart Ecosystem • Lựa chọn linh hoạt giữa 2 Adapters (API / SDK)   ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`${c.gray}Active Adapter: ${c.bold}${c.yellow}${adapterName}${c.reset}`);
  console.log(`${c.gray}Model active  : ${c.bold}${c.green}${modelName}${c.reset}${c.gray} • Gõ ${c.yellow}:help${c.gray} để xem lệnh tắt | ${c.yellow}:switch${c.gray} đổi Adapter${c.reset}\n`);
}

function printHelp(): void {
  console.log(`\n${c.bold}=== DANH SÁCH LỆNH TẮT HỆ THỐNG & ĐỔI ADAPTER ===${c.reset}`);
  console.log(`  ${c.yellow}:adapter api${c.reset}  -> Chuyển sang Adapter Part A (Claude Messages API manual loop)`);
  console.log(`  ${c.yellow}:adapter sdk${c.reset}  -> Chuyển sang Adapter Part B (Claude Agent SDK native hooks)`);
  console.log(`  ${c.yellow}:switch${c.reset}       -> Chuyển đổi nhanh qua lại giữa Messages API và Agent SDK`);
  console.log(`  ${c.yellow}:inspect${c.reset}      -> [HOẶC :memory] Xem toàn bộ trạng thái phiên qua SessionInspector`);
  console.log(`  ${c.yellow}:facts${c.reset}        -> Xem riêng nội dung khối <case_facts> ghim trong Prompt`);
  console.log(`  ${c.yellow}:gate${c.reset}         -> Xem trạng thái PrerequisiteGate (verified customer, inspection)`);
  console.log(`  ${c.yellow}:debug${c.reset}        -> Bật/tắt chế độ in log chi tiết từng vòng lặp`);
  console.log(`  ${c.yellow}:reset${c.reset}        -> Đặt lại phiên hội thoại và khôi phục Mock Database`);
  console.log(`  ${c.yellow}:exit${c.reset}         -> Thoát khỏi CLI (hoặc :quit)`);

  console.log(`\n${c.bold}=== DANH SÁCH KỊCH BẢN MẪU (5 ACTS CỦA ALEX TRẦN) ===${c.reset}`);
  console.log(`  ${c.yellow}:act1${c.reset}   -> [Act 1] Hỏi tồn kho Q1 + Mã TECH20 + Giờ mở cửa (Multi-intent song song)`);
  console.log(`  ${c.yellow}:act2${c.reset}   -> [Act 2] Tra cứu đơn ORD-8821 của Alex Trần (Mơ hồ danh tính & Cắt gọt ERP)`);
  console.log(`  ${c.yellow}:act3${c.reset}   -> [Act 3] Báo robot móp vỏ tạo bảo hành (Lỗi 503 tạm thời & Tự phục hồi)`);
  console.log(`  ${c.yellow}:act4${c.reset}   -> [Act 4] Đòi hoàn tiền sớm & Khớp giá sàn đối thủ (Chặn Gate & Policy Gap)`);
  console.log(`  ${c.yellow}:act5a${c.reset}  -> [Act 5A] Hoàn toàn bộ $650 (Compliance Guard chặn hoàn tiền > $500)`);
  console.log(`  ${c.yellow}:act5b${c.reset}  -> [Act 5B] Đòi gặp quản lý tức thì (Escalate ngay lập tức không điều tra)\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let activeAdapterType: AdapterType = args.includes('--adapter=sdk') || args.includes('-a=sdk') ? 'sdk' : 'api';
  let debugMode = true;

  resetMockDb();
  let agent: SupportAgent = createAgent(activeAdapterType, debugMode);

  printBanner(agent.getAdapterName(), agent.getModel());

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const promptBadge = activeAdapterType === 'sdk' ? `${c.magenta}[SDK]${c.reset}` : `${c.blue}[API]${c.reset}`;
      const rawInput = await rl.question(`${c.bold}${c.green}User ${promptBadge}> ${c.reset}`);
      const trimmed = rawInput.trim();

      if (!trimmed) continue;

      if (trimmed === ':exit' || trimmed === ':quit') {
        console.log(`\n${c.cyan}Tạm biệt! Chúc bạn ôn thi CCAF thành công.${c.reset}\n`);
        break;
      }

      if (trimmed === ':help') {
        printHelp();
        continue;
      }

      if (trimmed === ':switch') {
        activeAdapterType = activeAdapterType === 'api' ? 'sdk' : 'api';
        resetMockDb();
        agent = createAgent(activeAdapterType, debugMode);
        console.log(`\n${c.green}✓ Đã chuyển sang Adapter: ${c.bold}${agent.getAdapterName()}${c.reset}\n`);
        continue;
      }

      if (trimmed === ':adapter api') {
        activeAdapterType = 'api';
        resetMockDb();
        agent = createAgent(activeAdapterType, debugMode);
        console.log(`\n${c.green}✓ Đã kích hoạt Adapter Part A: ${c.bold}${agent.getAdapterName()}${c.reset}\n`);
        continue;
      }

      if (trimmed === ':adapter sdk') {
        activeAdapterType = 'sdk';
        resetMockDb();
        agent = createAgent(activeAdapterType, debugMode);
        console.log(`\n${c.green}✓ Đã kích hoạt Adapter Part B: ${c.bold}${agent.getAdapterName()}${c.reset}\n`);
        continue;
      }

      if (trimmed === ':reset') {
        resetMockDb();
        agent = createAgent(activeAdapterType, debugMode);
        console.log(`\n${c.green}✓ Đã đặt lại phiên làm việc mới và reset Mock Database.${c.reset}\n`);
        continue;
      }

      if (trimmed === ':inspect' || trimmed === ':memory') {
        console.log(`\n${agent.getInspector().renderBox()}\n`);
        continue;
      }

      if (trimmed === ':facts') {
        const inspector = agent.getInspector();
        console.log(`\n${c.blue}${c.bold}=== PERSISTENT CASE FACTS BLOCK (Task 5.1) ===${c.reset}`);
        console.log(inspector.renderBox());
        console.log('');
        continue;
      }

      if (trimmed === ':gate') {
        console.log(`\n${agent.getInspector().renderBox()}\n`);
        continue;
      }

      if (trimmed === ':debug') {
        debugMode = !debugMode;
        agent.setDebug(debugMode);
        console.log(
          `\n${c.magenta}✓ Đã ${debugMode ? 'BẬT' : 'TẮT'} chế độ Debug Trace vòng lặp.${c.reset}\n`
        );
        continue;
      }

      // Ánh xạ các kịch bản mẫu
      let promptToSend = trimmed;
      if (trimmed === ':act1') {
        promptToSend =
          'Cho mình hỏi robot ROBO-X1 ở Quận 1 còn hàng không? Mã TECH20 còn dùng được không và chi nhánh mở cửa đến mấy giờ?';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 1 (Multi-intent & Parallel Tools)...${c.reset}`);
      } else if (trimmed === ':act2') {
        promptToSend = 'Tôi là Alex Trần, SĐT 0901234567, kiểm tra đơn hàng ORD-8821 giúp tôi.';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 2 (Định danh khách hàng & Cắt gọt 62 fields ERP)...${c.reset}`);
      } else if (trimmed === ':act3') {
        promptToSend = 'Robot X1 của tôi vừa mở hộp đã bị móp vỏ ở cạnh trái. Hãy tạo phiếu bảo hành giúp tôi.';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 3 (Lỗi mạng tạm thời & Tự phục hồi)...${c.reset}`);
      } else if (trimmed === ':act4') {
        promptToSend = 'Hoàn tiền gấp đơn ORD-8821 này cho tôi, hoặc khớp giá sàn S đang bán rẻ hơn các bạn $50!';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 4 (Chặn PrerequisiteGate & Khớp giá đối thủ)...${c.reset}`);
      } else if (trimmed === ':act5a') {
        setOrderInspectionStatus('ORD-8821', 'PASSED');
        promptToSend = 'Đơn ORD-8821 đã kiểm định PASSED rồi. Hãy hoàn lại toàn bộ $650 cho tôi.';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 5A (Compliance Guard chặn hoàn tiền > $500)...${c.reset}`);
      } else if (trimmed === ':act5b') {
        promptToSend = 'Tôi không muốn chat với AI nữa. Cho tôi gặp quản lý hỗ trợ ngay lập tức!';
        console.log(`${c.gray}→ Kích hoạt kịch bản Act 5B (Khách đòi người thật -> Escalate tức thì)...${c.reset}`);
      }

      console.log(`${c.dim}Đang xử lý qua [${agent.getAdapterName()}]...${c.reset}`);
      const startTime = Date.now();

      try {
        const turnResult = await agent.runTurn(promptToSend);
        const elapsed = Date.now() - startTime;

        console.log(`\n${c.bold}${c.cyan}NovaSmart Support Agent (${activeAdapterType.toUpperCase()}):${c.reset}`);
        console.log(turnResult.text || `${c.gray}(Không có văn bản phản hồi)${c.reset}`);

        // In hộp chẩn đoán SessionInspector
        console.log(`\n${c.gray}┌─── [PHÂN TÍCH LƯỢT CHẠY (${activeAdapterType.toUpperCase()})] ──────────────────────────────────────┐${c.reset}`);
        console.log(`${c.gray}│${c.reset} 🔄 ${c.bold}Lượt lặp & Thời gian :${c.reset} ${turnResult.iterations} lượt lặp (${elapsed}ms)`);
        console.log(`${c.gray}│${c.reset} 🛠️  ${c.bold}Tools đã thực thi    :${c.reset} ${turnResult.toolCallsExecuted.map((t) => `${c.green}${t}${c.reset}`).join(', ') || 'None'}`);
        if (turnResult.blockedToolCalls.length > 0) {
          console.log(`${c.gray}│${c.reset} 🛑 ${c.bold}${c.red}Tools bị chặn cứng   :${c.reset} ${turnResult.blockedToolCalls.map((t) => `${c.red}${t}${c.reset}`).join(', ')}`);
        }
        if (turnResult.escalated && turnResult.handoffSummary) {
          console.log(`${c.gray}│${c.reset} 🚨 ${c.bold}${c.magenta}Chuyển giao quản lý  :${c.reset} ${turnResult.handoffSummary.trigger_reason} (ID: ${turnResult.handoffSummary.handoff_id})`);
        }
        console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────┘${c.reset}`);

        // Nếu bật chế độ debug, tự động in SessionInspector chi tiết sau mỗi lượt
        if (debugMode) {
          console.log(`\n${agent.getInspector().renderBox()}\n`);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`\n${c.red}${c.bold}✗ Lỗi khi thực thi Agent:${c.reset} ${errorMsg}`);
        console.log(`${c.gray}Gợi ý: Kiểm tra biến môi trường ANTHROPIC_API_KEY trong file .env.${c.reset}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
