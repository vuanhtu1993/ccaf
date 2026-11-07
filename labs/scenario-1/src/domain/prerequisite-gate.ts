/**
 * State-Driven Prerequisite Gate
 *
 * Triển khai theo Task Statement 1.4 của đề thi CCA-F:
 * - "Implement programmatic prerequisites that block downstream tool calls until
 *   prerequisite steps have completed (e.g., blocking process_refund until
 *   get_customer has returned a verified customer ID)"
 * - Trạng thái của Gate được cập nhật TỰ ĐỘNG từ kết quả trả về của Tool
 *   (bảo đảm tính tất định, không dựa vào hallucination hay lời tự xưng của LLM).
 *
 * Made by Anh Tu - Share to be share
 */

import type { StructuredToolResult, StructuredErrorResult } from './types.js';

export interface PreToolDecision {
  allowed: boolean;
  errorResult?: StructuredErrorResult;
}

export class PrerequisiteGate {
  private verifiedCustomerId: string | null = null;
  private inspectedOrders = new Set<string>();

  /**
   * Cập nhật trạng thái Gate dựa trên kết quả thực thi tool (Deterministic State Tracking)
   */
  public recordToolResult(toolName: string, result: StructuredToolResult<unknown>): void {
    if (result.isError) return;

    if (toolName === 'get_customer') {
      const data = result.data as { matches: number; customers: Array<{ customer_id: string }> };
      // Chỉ khi tìm thấy ĐÚNG 1 khách hàng duy nhất thì mới mở khóa verifiedCustomerId
      if (data && data.matches === 1 && data.customers.length === 1) {
        this.verifiedCustomerId = data.customers[0].customer_id;
      } else {
        // Nếu có 0 hoặc > 1 kết quả (trùng tên), trạng thái vẫn là chưa xác minh (Task 5.2)
        this.verifiedCustomerId = null;
      }
    }

    if (toolName === 'lookup_order') {
      const data = result.data as {
        order_id: string;
        return_inspection_status?: string;
        return_eligibility?: { return_inspection_status?: string };
      } | null;

      if (data) {
        const inspectionStatus =
          data.return_inspection_status ?? data.return_eligibility?.return_inspection_status;
        if (inspectionStatus === 'PASSED') {
          this.inspectedOrders.add(data.order_id);
        }
      }
    }
  }

  /**
   * Kiểm tra điều kiện tiên quyết trước khi thực thi tool (PreToolUse Check)
   */
  public checkPreToolUse(
    toolName: string,
    input: Record<string, unknown>
  ): PreToolDecision {
    if (toolName === 'process_refund') {
      // 1. Kiểm tra định danh khách hàng (Task 1.4 L356)
      if (!this.verifiedCustomerId) {
        return {
          allowed: false,
          errorResult: {
            isError: true,
            errorCategory: 'business',
            isRetryable: false,
            message:
              'Cannot process refund: A verified customer ID is required. Customer identity has not been verified. You must call get_customer with an unambiguous identifier (such as phone number) first.',
            suggestedAction: 'clarify_with_user',
          },
        };
      }

      // 2. Kiểm tra điều kiện kiểm định hàng trả về (Product Inspection)
      const orderId = String(input['order_id'] ?? '').trim();
      if (!this.inspectedOrders.has(orderId)) {
        return {
          allowed: false,
          errorResult: {
            isError: true,
            errorCategory: 'business',
            isRetryable: false,
            message: `Cannot process refund: Product return inspection has not PASSED for order ${orderId}. Policy requires hardware inspection verification before funds can be released.`,
            suggestedAction: 'clarify_with_user',
          },
        };
      }
    }

    return { allowed: true };
  }

  public getVerifiedCustomerId(): string | null {
    return this.verifiedCustomerId;
  }

  public isOrderInspected(orderId: string): boolean {
    return this.inspectedOrders.has(orderId);
  }

  public reset(): void {
    this.verifiedCustomerId = null;
    this.inspectedOrders.clear();
  }
}
