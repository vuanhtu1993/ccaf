/**
 * Interactive Terminal CLI cho Scenario 1: Customer Support Resolution Agent
 *
 * Sử dụng node:readline/promises để giao tiếp trực tiếp với MessagesApiSupportAgent,
 * kết hợp bộ định dạng trực quan (Pedagogical Terminal Inspector) hiển thị chi tiết:
 * - Số lượt vòng lặp (Iterations & stop_reason)
 * - Tools được thực thi & Tools bị chốt chặn (Gate / Guard)
 * - Khối dữ liệu giao dịch bất biến <case_facts>
 * - Bản tóm tắt chuyển giao con người (Structured Handoff Summary)
 *
 * Made by Anh Tu - Share to be share
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MessagesApiSupportAgent } from './adapters/messages-api.js';
import { resetMockDb, setOrderInspectionStatus } from './domain/mock-db.js';

// ANSI color escape codes (Không cần cài thêm thư viện bên ngoài)
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

function printBanner(): void {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       CCAF SCENARIO 1: CUSTOMER SUPPORT RESOLUTION AGENT (CLI REPL)          ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       NovaSmart Ecosystem • Powered by Claude Messages API                   ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`${c.gray}Tác giả: Anh Tú (IT Lecturer) • Gõ ${c.yellow}:help${c.gray} để xem danh sách lệnh tắt mẫu${c.reset}\n`);
}

function printHelp(): void {
  console.log(`\n${c.bold}=== DANH SÁCH LỆNH TẮT & KỊCH BẢN MẪU (5 ACTS) ===${c.reset}`);
  console.log(`  ${c.yellow}:act1${c.reset}   -> [Act 1] Hỏi tồn kho Q1 + Mã TECH20 + Giờ mở cửa (Multi-intent song song)`);
  console.log(`  ${c.yellow}:act2${c.reset}   -> [Act 2] Tra cứu đơn ORD-8821 của Alex Trần (Mơ hồ danh tính & Cắt gọt ERP)`);
  console.log(`  ${c.yellow}:act3${c.reset}   -> [Act 3] Báo robot móp vỏ tạo bảo hành (Lỗi 503 tạm thời & Tự phục hồi)`);
  console.log(`  ${c.yellow}:act4${c.reset}   -> [Act 4] Đòi hoàn tiền sớm & Khớp giá sàn đối thủ (Chặn Gate & Policy Gap)`);
  console.log(`  ${c.yellow}:act5a${c.reset}  -> [Act 5A] Hoàn toàn bộ $650 (Compliance Guard chặn hoàn tiền > $500)`);
  console.log(`  ${c.yellow}:act5b${c.reset}  -> [Act 5B] Đòi gặp quản lý tức thì (Escalate ngay lập tức không điều tra)`);
  console.log(`  ${c.yellow}:facts${c.reset}  -> Xem nội dung khối <case_facts> hiện tại`);
  console.log(`  ${c.yellow}:gate${c.reset}   -> Xem trạng thái của PrerequisiteGate (verified customer, inspection)`);
  console.log(`  ${c.yellow}:reset${c.reset}  -> Đặt lại phiên hội thoại và khôi phục Mock Database`);
  console.log(`  ${c.yellow}:exit${c.reset}   -> Thoát khỏi CLI (hoặc :quit)\n`);
}

async function main(): Promise<void> {
  printBanner();

  let agent = new MessagesApiSupportAgent();
  resetMockDb();

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const rawInput = await rl.question(`${c.bold}${c.green}User > ${c.reset}`);
      const trimmed = rawInput.trim();

      if (!trimmed) continue;

      // Xử lý các lệnh tắt hệ thống
      if (trimmed === ':exit' || trimmed === ':quit') {
        console.log(`\n${c.cyan}Tạm biệt! Chúc bạn ôn thi CCAF thành công.${c.reset}\n`);
        break;
      }

      if (trimmed === ':help') {
        printHelp();
        continue;
      }

      if (trimmed === ':reset') {
        resetMockDb();
        agent = new MessagesApiSupportAgent();
        console.log(`\n${c.green}✓ Đã đặt lại phiên làm việc mới và reset Mock Database.${c.reset}\n`);
        continue;
      }

      if (trimmed === ':facts') {
        const factsBlock = agent.getCaseFacts().renderCaseFactsBlock();
        console.log(`\n${c.blue}${c.bold}=== PERSISTENT CASE FACTS BLOCK (Task 5.1) ===${c.reset}`);
        console.log(factsBlock || `${c.gray}(Chưa có sự kiện giao dịch nào được ghi nhận)${c.reset}`);
        console.log('');
        continue;
      }

      if (trimmed === ':gate') {
        console.log(`\n${c.yellow}${c.bold}=== PREREQUISITE GATE STATUS (Task 1.4) ===${c.reset}`);
        console.log(`  Verified Customer ID : ${c.cyan}${agent.getGate().getVerifiedCustomerId() ?? 'null (Chưa xác minh)'}${c.reset}`);
        console.log(`  Order ORD-8821 Pass  : ${c.cyan}${agent.getGate().isOrderInspected('ORD-8821') ? 'PASSED' : 'PENDING'}${c.reset}\n`);
        continue;
      }

      // Ánh xạ các kịch bản mẫu
      let promptToSend = trimmed;
      if (trimmed === ':act1') {
        promptToSend = 'Cho mình hỏi robot ROBO-X1 ở Quận 1 còn hàng không? Mã TECH20 còn dùng được không và chi nhánh mở cửa đến mấy giờ?';
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

      // Gọi Agent
      console.log(`${c.dim}Đang xử lý qua Claude Agent Loop...${c.reset}`);
      const startTime = Date.now();

      try {
        const turnResult = await agent.runTurn(promptToSend);
        const elapsed = Date.now() - startTime;

        // In phản hồi của Assistant
        console.log(`\n${c.bold}${c.cyan}NovaSmart Support Agent:${c.reset}`);
        console.log(turnResult.text || `${c.gray}(Không có văn bản phản hồi)${c.reset}`);

        // In Hộp Sư phạm Inspector Box
        console.log(`\n${c.gray}┌─── [INSPECTOR PHÂN TÍCH KIẾN TRÚC CLAUDE] ─────────────────────────────────────────┐${c.reset}`);
        console.log(`${c.gray}│${c.reset} 🔄 ${c.bold}Vòng lặp stop_reason (Task 1.1):${c.reset} ${turnResult.iterations} lượt lặp (${elapsed}ms)`);
        
        if (turnResult.toolCallsExecuted.length > 0) {
          console.log(`${c.gray}│${c.reset} 🛠️  ${c.bold}Tools đã thực thi:${c.reset} ${turnResult.toolCallsExecuted.map(t => `${c.green}${t}${c.reset}`).join(', ')}`);
        } else {
          console.log(`${c.gray}│${c.reset} 🛠️  ${c.bold}Tools đã thực thi:${c.reset} ${c.dim}Không có${c.reset}`);
        }

        if (turnResult.blockedToolCalls.length > 0) {
          console.log(`${c.gray}│${c.reset} 🛑 ${c.bold}${c.red}Tools bị chặn (Gate/Guard):${c.reset} ${turnResult.blockedToolCalls.map(t => `${c.red}${t}${c.reset}`).join(', ')}`);
        }

        const facts = agent.getCaseFacts().getAllFacts();
        const factKeys = Object.keys(facts);
        if (factKeys.length > 0) {
          console.log(`${c.gray}│${c.reset} 📌 ${c.bold}Case Facts hiện hành (Task 5.1):${c.reset} ${factKeys.map(k => `${k}=${facts[k]}`).join(', ')}`);
        }

        if (turnResult.escalated && turnResult.handoffSummary) {
          const h = turnResult.handoffSummary;
          console.log(`${c.gray}│${c.reset} 🚨 ${c.bold}${c.magenta}KÍCH HOẠT CHUYỂN GIAO QUẢN LÝ (ESCALATION - Task 5.2):${c.reset}`);
          console.log(`${c.gray}│${c.reset}    • Mã chuyển giao : ${c.yellow}${h.handoff_id}${c.reset}`);
          console.log(`${c.gray}│${c.reset}    • Lý do trigger  : ${c.magenta}${h.trigger_reason}${c.reset}`);
          console.log(`${c.gray}│${c.reset}    • Nguyên nhân gốc: ${h.root_cause}`);
          console.log(`${c.gray}│${c.reset}    • Hành động đề xuất: ${h.recommended_action}`);
        }

        console.log(`${c.gray}└────────────────────────────────────────────────────────────────────────────────────┘${c.reset}\n`);

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
