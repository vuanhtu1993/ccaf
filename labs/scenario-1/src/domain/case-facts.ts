/**
 * Case Facts Manager (Persistent Transactional Facts Layer)
 *
 * Triển khai theo Task Statement 5.1 của đề thi CCA-F:
 * - "Extracting transactional facts (amounts, dates, order numbers, statuses)
 *   into a persistent 'case facts' block included in each prompt, outside
 *   summarized history" (Task 5.1 L1122)
 * - "Mitigating progressive summarization risks: avoiding vague condensation
 *   of critical numerical values, order identifiers and currency amounts" (Task 5.1 L1104)
 * - Khối <case_facts> luôn được đính kèm ở đầu hoặc cuối System Prompt,
 *   đảm bảo model không bao giờ quên mã đơn, số tiền hoặc ID khách hàng đã xác minh.
 *
 * Made by Anh Tu - Share to be share
 */

import type { StructuredToolResult } from './types.js';

export class CaseFactsManager {
  private facts = new Map<string, string>();

  /**
   * Tự động trích xuất các sự kiện giao dịch cốt lõi từ kết quả trả về của tool
   */
  public ingestToolResult(toolName: string, result: StructuredToolResult<unknown>): void {
    if (result.isError || !result.data) {
      return;
    }

    if (toolName === 'get_customer') {
      const data = result.data as {
        matches: number;
        customers: Array<{ customer_id: string; name: string; phone: string }>;
      };
      if (data.matches === 1 && data.customers.length === 1) {
        const cust = data.customers[0];
        this.facts.set('verified_customer_id', cust.customer_id);
        this.facts.set('customer_name', cust.name);
        this.facts.set('customer_phone', cust.phone);
      }
    }

    if (toolName === 'lookup_order') {
      const data = result.data as {
        order_id: string;
        total_amount: number;
        status?: string;
        order_status_code?: number;
      };
      if (data.order_id) {
        this.facts.set('order_id', data.order_id);
        this.facts.set('order_total_amount', `$${data.total_amount}`);
        if (data.status) {
          this.facts.set('order_status', data.status);
        }
      }
    }

    if (toolName === 'create_warranty_ticket') {
      const data = result.data as { ticket_id: string };
      if (data.ticket_id) {
        this.facts.set('warranty_ticket_id', data.ticket_id);
      }
    }

    if (toolName === 'process_refund') {
      const data = result.data as { refund_id: string; amount_refunded: number };
      if (data.refund_id) {
        this.facts.set('refund_id', data.refund_id);
        this.facts.set('refunded_amount', `$${data.amount_refunded}`);
      }
    }
  }

  public setFact(key: string, value: string): void {
    this.facts.set(key, value);
  }

  public getFact(key: string): string | undefined {
    return this.facts.get(key);
  }

  public getAllFacts(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.facts.entries()) {
      out[k] = v;
    }
    return out;
  }

  /**
   * Định dạng khối <case_facts> chuẩn XML để đưa vào prompt
   */
  public renderCaseFactsBlock(): string {
    if (this.facts.size === 0) {
      return '';
    }

    const lines: string[] = ['<case_facts>'];
    for (const [key, val] of this.facts.entries()) {
      lines.push(`${key}: ${val}`);
    }
    lines.push('</case_facts>');

    return lines.join('\n');
  }

  /**
   * Bơm khối <case_facts> vào System Prompt bên ngoài lịch sử chat hội thoại
   */
  public injectIntoSystemPrompt(basePrompt: string): string {
    const factsBlock = this.renderCaseFactsBlock();
    if (!factsBlock) {
      return basePrompt;
    }
    return `${basePrompt}\n\n${factsBlock}`;
  }

  public reset(): void {
    this.facts.clear();
  }
}

