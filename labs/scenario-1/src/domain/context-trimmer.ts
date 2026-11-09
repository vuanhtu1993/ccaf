/**
 * PostToolUse Data Normalizer & Context Trimmer
 *
 * Triển khai theo Task Statement 1.5 & 5.1 của đề thi CCA-F:
 * - "Implementing PostToolUse hooks to normalize heterogeneous data formats
 *   (Unix timestamps, ISO 8601, numeric status codes) from different MCP tools
 *   before the agent processes them" (Task 1.5 L384)
 * - "Trimming verbose tool outputs to only relevant fields before they accumulate
 *   in context (e.g., keeping only return-relevant fields from order lookups)" (Task 5.1 L1129)
 * - "Mitigating 'Lost in the middle' effect and token exhaustion" (Task 5.1 L1109)
 *
 * Made by Anh Tu - Share to be share
 */

import type { StructuredToolResult, RawErpOrder, TrimmedOrder } from './types.js';

const STATUS_CODE_MAP: Record<number, 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'RETURNED'> = {
  1: 'PROCESSING',
  2: 'SHIPPED',
  3: 'DELIVERED',
  4: 'RETURNED',
};

/**
 * Cắt gọt và chuẩn hóa dữ liệu trả về từ tool trước khi đưa vào context hội thoại.
 * Tiết kiệm hơn 70% dung lượng payload, chuyển Unix timestamp sang ISO-8601,
 * và chuyển mã trạng thái số sang chữ tường minh.
 */
export function normalizeAndTrimToolResult(
  toolName: string,
  result: StructuredToolResult<unknown>
): StructuredToolResult<unknown> {
  // 1. Nếu tool trả về lỗi, giữ nguyên để agent đọc error metadata
  if (result.isError) {
    return result;
  }

  // 2. Chuẩn hóa & cắt gọt cho lookup_order (từ 62 fields xuống 5 fields)
  if (toolName === 'lookup_order') {
    const rawOrder = result.data as RawErpOrder | null;
    if (!rawOrder) {
      return result;
    }

    const normalizedStatus = STATUS_CODE_MAP[rawOrder.order_status_code] ?? 'DELIVERED';
    const deliveryDateIso = new Date(rawOrder.delivery_timestamp * 1000).toISOString();

    const trimmed: TrimmedOrder = {
      order_id: rawOrder.order_id,
      status: normalizedStatus,
      total_amount: rawOrder.total_amount,
      delivery_date_iso: deliveryDateIso,
      return_eligibility: {
        items: rawOrder.items,
        return_inspection_status: rawOrder.return_inspection_status,
      },
    };

    return {
      isError: false,
      data: trimmed,
    };
  }

  return result;
}

