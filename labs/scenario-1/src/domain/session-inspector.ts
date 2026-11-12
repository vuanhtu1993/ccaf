/**
 * Session Inspector (Công cụ Sư phạm & Quan sát Trạng thái Phiên)
 *
 * ⚠️ LƯU Ý SƯ PHẠM QUAN TRỌNG (PEDAGOGICAL NOTICE):
 * "SessionInspector" KHÔNG PHẢI là một khái niệm hay Design Pattern chính thức
 * trong đề thi Claude Certified Architect – Foundations (CCAF).
 *
 * Trong đề thi CCAF, các cơ chế kiểm soát được Anthropic phân định độc lập theo từng Task:
 * - Task 1.4: Programmatic Prerequisites (PrerequisiteGate: chặn thứ tự gọi tool)
 * - Task 1.5: Deterministic Compliance Guardrails (ComplianceGuard: chặn hạn mức $500)
 * - Task 1.5 & 5.1: Post-tool Trimming & Persistent <case_facts> block trong prompt
 * - Task 5.1: Complete Conversation History (mảng messages)
 *
 * Module này được xây dựng như một công cụ chẩn đoán (Diagnostic & Observability Tool)
 * giúp Giảng viên và Học viên phân biệt rạch ròi 2 vùng dữ liệu hoàn toàn khác bản chất:
 *
 * 1. LLM CONTEXT WINDOW (Những gì Claude ĐỌC ĐƯỢC):
 *    - system prompt (chứa chỉ dẫn và khối <case_facts> được tiêm động).
 *    - mảng messages (lịch sử hội thoại user/assistant và tool_result).
 *    - Model là stateless; nếu dữ liệu không nằm trong context window thì model HOÀN TOÀN KHÔNG BIẾT.
 *
 * 2. HARNESS / APPLICATION STATE (Những gì Claude KHÔNG THỂ THẤY):
 *    - PrerequisiteGate (verifiedCustomerId, inspectedOrders).
 *    - ComplianceGuard (maxAutoRefundAmount = 500).
 *    - Nằm ở tầng code máy chủ (TypeScript runtime), đảm bảo tính tất định (deterministic),
 *      không bao giờ phụ thuộc vào việc LLM có "nhớ" hay "tự giác" tuân thủ hay không.
 *
 * Made by Anh Tu - Share to be share
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { PrerequisiteGate } from './prerequisite-gate.js';
import type { ComplianceGuard } from './compliance-guard.js';
import type { CaseFactsManager } from './case-facts.js';
import type { HandoffSummary } from './types.js';

export interface SessionInspectorSources {
  messages: Anthropic.MessageParam[];
  gate: PrerequisiteGate;
  guard: ComplianceGuard;
  caseFacts: CaseFactsManager;
  toolsExecuted?: string[];
  blockedTools?: string[];
  handoffSummary?: HandoffSummary;
}

export class SessionInspector {
  constructor(private readonly sources: SessionInspectorSources) {}

  /**
   * Định dạng giao diện Terminal hiển thị rạch ròi 2 vùng State của hệ thống
   */
  public renderBox(): string {
    const { messages, gate, guard, caseFacts, toolsExecuted = [], blockedTools = [], handoffSummary } =
      this.sources;

    let userMsgCount = 0;
    let assistantMsgCount = 0;
    let estimatedTokens = 0;

    for (const msg of messages) {
      if (msg.role === 'user') userMsgCount++;
      if (msg.role === 'assistant') assistantMsgCount++;
      const textLen =
        typeof msg.content === 'string'
          ? msg.content.length
          : JSON.stringify(msg.content).length;
      estimatedTokens += Math.ceil(textLen / 4);
    }

    const facts = caseFacts.getAllFacts();
    const factEntries = Object.entries(facts);

    const verifiedId = gate.getVerifiedCustomerId();
    const isInspected = gate.isOrderInspected('ORD-8821');
    const maxRefund = guard.getMaxLimit();

    const lines: string[] = [];

    lines.push('┌─── [SESSION STATE INSPECTOR - CHẨN ĐOÁN TRẠNG THÁI HỆ THỐNG] ─────────────────────┐');
    lines.push('│ 👁️  VÙNG 1: LLM CONTEXT WINDOW (Dữ liệu Claude THẤY & ĐỌC ĐƯỢC)                    │');
    lines.push(`│    • Lịch sử hội thoại  : ${messages.length} messages (${userMsgCount} User, ${assistantMsgCount} Assistant)`);
    lines.push(`│    • Kích thước ước tính: ~${estimatedTokens} tokens trong Context Window`);
    lines.push('│    • Persistent Facts   : [Khối <case_facts> ghim vào System Prompt]');
    if (factEntries.length === 0) {
      lines.push('│      ↳ (Chưa có dữ liệu giao dịch nào được ghi nhận)');
    } else {
      for (const [k, v] of factEntries) {
        lines.push(`│      ↳ ${k.padEnd(21, ' ')}: ${v}`);
      }
    }
    lines.push('│                                                                                    │');
    lines.push('│ 🛡️  VÙNG 2: HARNESS APPLICATION STATE (Trạng thái mã nguồn Claude KHÔNG THẤY)      │');
    lines.push(`│    • PrerequisiteGate   : verifiedCustomerId = ${verifiedId ? `✅ "${verifiedId}"` : '❌ null (Chưa xác minh)'}`);
    lines.push(`│    • Kiểm định đơn hàng : ORD-8821 = ${isInspected ? '✅ PASSED' : '⏳ PENDING'}`);
    lines.push(`│    • ComplianceGuard    : Hạn mức tối đa = $${maxRefund} (Vượt quá là chặn cứng)`);
    lines.push('│                                                                                    │');
    lines.push('│ 📊 VÙNG 3: NHẬT KÝ THỰC THI (Execution & Interception Audit)                       │');
    lines.push(`│    • Tools đã thực thi  : ${toolsExecuted.join(', ') || 'Chưa gọi tool nào'}`);
    if (blockedTools.length > 0) {
      lines.push(`│    • Tools bị chặn cứng : 🛑 ${blockedTools.join(', ')} (Bảo vệ bởi Gate/Guard)`);
    }
    if (handoffSummary) {
      lines.push(`│    • Chuyển giao quản lý: 🚨 ${handoffSummary.trigger_reason} (Mã: ${handoffSummary.handoff_id})`);
      lines.push(`│      ↳ Lý do: ${handoffSummary.root_cause}`);
    } else {
      lines.push('│    • Chuyển giao quản lý: Không (Phiên tự giải quyết - Autonomous)');
    }
    lines.push('└────────────────────────────────────────────────────────────────────────────────────┘');

    return lines.join('\n');
  }
}

