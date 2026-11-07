/**
 * 10 Canonical Tools cho Scenario 1: Customer Support Resolution Agent
 *
 * Thiết kế theo chuẩn CCAF:
 * - Task 2.1: Tool Descriptions, Ranh giới rõ ràng giữa các tool tương đồng
 *   (đặc biệt cặp search_product_catalog vs check_inventory theo Exercise 1).
 * - Task 2.2: Structured Error Responses (isError, errorCategory, isRetryable)
 *   và phân biệt kết quả rỗng hợp lệ (valid empty results) với lỗi truy cập.
 *
 * Made by Anh Tu - Share to be share
 */

import type {
  StructuredToolResult,
  ProductCatalogItem,
  StoreLocation,
  Promotion,
  WarrantyTicket,
  HandoffSummary,
  EscalationTrigger,
} from './types.js';
import {
  mockCatalog,
  mockInventory,
  mockStores,
  mockPromos,
  mockCustomers,
  mockOrders,
  mockWarrantyTickets,
  returnPolicyText,
  consumeFault,
} from './mock-db.js';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Danh mục 10 Tools chuẩn hóa của NovaSmart (Source of Truth)
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_product_catalog',
    description:
      'Search technical specifications, features, and list prices for NovaSmart smart home products. Do NOT use this tool to check stock or inventory availability at physical stores.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product name or keyword to search' },
        category: { type: 'string', description: 'Product category' },
      },
    },
  },
  {
    name: 'check_inventory',
    description:
      'Check real-time stock quantity for a specific SKU at physical stores or districts. Do NOT use this tool for product specifications or feature descriptions.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Product SKU code (e.g. ROBO-X1)' },
        district: { type: 'string', description: 'Target district (e.g. Quận 1, Quận 7)' },
      },
      required: ['sku', 'district'],
    },
  },
  {
    name: 'lookup_store_location',
    description:
      'Find official NovaSmart retail store address, contact telephone, and opening hours by city district.',
    input_schema: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Target district to find nearby stores' },
      },
      required: ['district'],
    },
  },
  {
    name: 'validate_promo',
    description:
      'Check validity, discount percentage, and minimum order threshold for promotional codes.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Promotional discount voucher code (e.g. TECH20)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'get_customer',
    description:
      'Lookup customer profile records in CRM by full name or phone number. May return zero, one, or multiple matching profiles when names are ambiguous.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full customer name' },
        phone: { type: 'string', description: 'Customer telephone number' },
      },
    },
  },
  {
    name: 'lookup_order',
    description:
      'Retrieve comprehensive order details from the ERP system by order ID. Returns raw backend transaction record with 62 fields.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'The unique order identifier (e.g. ORD-8821)' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'get_return_policy',
    description:
      'Retrieve official company return, refund, inspection, and price-adjustment policies.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Specific topic to retrieve (e.g. refund, inspection, price_matching)',
        },
      },
    },
  },
  {
    name: 'create_warranty_ticket',
    description:
      'File a warranty service ticket for defective, damaged, or malfunctioning hardware products.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID associated with the defective item' },
        issue_description: {
          type: 'string',
          description: 'Detailed description of the hardware malfunction or damage',
        },
      },
      required: ['order_id', 'issue_description'],
    },
  },
  {
    name: 'process_refund',
    description:
      'Execute automated customer refund to original payment method. Subject to prerequisite identity verification, product return inspection approval, and maximum automatic refund threshold ($500).',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID to be refunded' },
        amount: { type: 'number', description: 'Refund amount in USD' },
        reason: { type: 'string', description: 'Business reason for the refund' },
      },
      required: ['order_id', 'amount', 'reason'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate the session to a human support supervisor with a structured handoff summary when policy thresholds are exceeded, policy gaps occur, or when customer explicitly demands a human.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer identifier (or UNKNOWN if not identified)' },
        root_cause: { type: 'string', description: 'Summary of the underlying customer issue' },
        refund_amount_requested: { type: 'number', description: 'Amount of refund requested in USD' },
        recommended_action: { type: 'string', description: 'Suggested resolution action for the human agent' },
        trigger_reason: {
          type: 'string',
          enum: ['customer_requested_human', 'policy_gap', 'policy_threshold_exceeded'],
          description: 'The architectural trigger that necessitated escalation',
        },
      },
      required: [
        'customer_id',
        'root_cause',
        'refund_amount_requested',
        'recommended_action',
        'trigger_reason',
      ],
    },
  },
];

/**
 * Thực thi tool ở tầng Domain (Pure TypeScript)
 * Đóng vai trò là hạt nhân tái sử dụng cho cả Messages API và Agent SDK
 */
export async function executeDomainTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<StructuredToolResult<unknown>> {
  // 1. Kiểm tra Fault Injection trước tiên (Task 2.1 & 2.2)
  const fault = consumeFault(toolName);
  if (fault) {
    return {
      isError: true,
      errorCategory: fault.errorCategory,
      isRetryable: fault.errorCategory === 'transient',
      message: fault.message,
      suggestedAction: fault.errorCategory === 'transient' ? 'retry_later' : undefined,
    };
  }

  // 2. Dispatch theo từng tool
  switch (toolName) {
    case 'search_product_catalog': {
      const query = String(input['query'] ?? '').trim().toLowerCase();
      const category = String(input['category'] ?? '').trim().toLowerCase();

      let results: ProductCatalogItem[] = mockCatalog;
      if (query) {
        results = results.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query)
        );
      }
      if (category) {
        results = results.filter((p) => p.category.toLowerCase().includes(category));
      }
      return { isError: false, data: results };
    }

    case 'check_inventory': {
      const sku = String(input['sku'] ?? '').trim();
      const district = String(input['district'] ?? '').trim();

      if (!sku) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'SKU code is required and cannot be blank.',
        };
      }
      if (!district) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'District is required and cannot be blank.',
        };
      }

      const match = mockInventory.find(
        (inv) =>
          inv.sku.toLowerCase() === sku.toLowerCase() &&
          inv.district.toLowerCase() === district.toLowerCase()
      );

      if (!match) {
        return {
          isError: false,
          data: {
            sku,
            district,
            in_stock: 0,
            warehouse_name: 'Không tìm thấy kho hàng tại khu vực này',
          },
        };
      }

      return { isError: false, data: match };
    }

    case 'lookup_store_location': {
      const district = String(input['district'] ?? '').trim();
      if (!district) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'District is required to find store locations.',
        };
      }

      const store = mockStores.find((s) =>
        s.district.toLowerCase().includes(district.toLowerCase())
      );

      if (!store) {
        return {
          isError: false,
          data: {
            district,
            matches: 0,
            message: `Không có chi nhánh NovaSmart nào tại ${district}. Chi nhánh gần nhất: Flagship Quận 1.`,
          },
        };
      }

      return { isError: false, data: store };
    }

    case 'validate_promo': {
      const code = String(input['code'] ?? '').trim().toUpperCase();
      if (!code) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'Promo code is required.',
        };
      }

      const promo = mockPromos.find((p) => p.code.toUpperCase() === code);
      if (!promo) {
        return {
          isError: false,
          data: {
            code,
            valid: false,
            message: `Mã khuyến mãi ${code} không tồn tại hoặc đã hết hạn.`,
          },
        };
      }

      if (!promo.active) {
        return {
          isError: false,
          data: {
            code,
            valid: false,
            message: `Mã khuyến mãi ${code} đã hết hạn sử dụng.`,
          },
        };
      }

      return { isError: false, data: promo };
    }

    case 'get_customer': {
      const name = String(input['name'] ?? '').trim().toLowerCase();
      const phone = String(input['phone'] ?? '').trim();

      if (!name && !phone) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'At least one identifier (name or phone) must be provided.',
        };
      }

      let matches = mockCustomers;
      if (phone) {
        matches = matches.filter((c) => c.phone === phone);
      } else if (name) {
        matches = matches.filter((c) => c.name.toLowerCase().includes(name));
      }

      // Valid empty result: isError: false, matches: 0 (Task 2.2 L535)
      return {
        isError: false,
        data: {
          matches: matches.length,
          customers: matches,
        },
      };
    }

    case 'lookup_order': {
      const orderId = String(input['order_id'] ?? '').trim().toUpperCase();
      if (!orderId) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'Order ID is required.',
        };
      }

      const order = mockOrders.find((o) => o.order_id === orderId);
      // Valid empty result: isError: false, data: null (Task 2.2 L535)
      if (!order) {
        return {
          isError: false,
          data: null,
        };
      }

      return { isError: false, data: order };
    }

    case 'get_return_policy': {
      return {
        isError: false,
        data: {
          policy: returnPolicyText,
          version: '2025.2',
        },
      };
    }

    case 'create_warranty_ticket': {
      const orderId = String(input['order_id'] ?? '').trim();
      const issue = String(input['issue_description'] ?? '').trim();

      if (!orderId || !issue) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'Both order_id and issue_description are required to create a warranty ticket.',
        };
      }

      const ticket: WarrantyTicket = {
        ticket_id: `WT-${9000 + mockWarrantyTickets.length + 1}`,
        order_id: orderId,
        issue_description: issue,
        status: 'OPEN',
        created_at_iso: new Date().toISOString(),
      };
      mockWarrantyTickets.push(ticket);

      return {
        isError: false,
        data: ticket,
      };
    }

    case 'process_refund': {
      const orderId = String(input['order_id'] ?? '').trim();
      const amount = Number(input['amount'] ?? 0);
      const reason = String(input['reason'] ?? '').trim();

      if (!orderId || amount <= 0 || !reason) {
        return {
          isError: true,
          errorCategory: 'validation',
          isRetryable: false,
          message: 'order_id, positive amount, and reason are required for refund.',
        };
      }

      return {
        isError: false,
        data: {
          refund_id: `REF-${Date.now()}`,
          order_id: orderId,
          amount_refunded: amount,
          currency: 'USD',
          status: 'PROCESSED',
          timestamp_iso: new Date().toISOString(),
        },
      };
    }

    case 'escalate_to_human': {
      const customerId = String(input['customer_id'] ?? 'UNKNOWN');
      const rootCause = String(input['root_cause'] ?? '');
      const refundAmount = Number(input['refund_amount_requested'] ?? 0);
      const action = String(input['recommended_action'] ?? '');
      const trigger = String(input['trigger_reason'] ?? 'customer_requested_human') as EscalationTrigger;

      const summary: HandoffSummary = {
        handoff_id: `ESC-${Date.now()}`,
        customer_id: customerId,
        root_cause: rootCause,
        refund_amount_requested: refundAmount,
        recommended_action: action,
        trigger_reason: trigger,
        timestamp_iso: new Date().toISOString(),
      };

      return {
        isError: false,
        data: summary,
      };
    }

    default:
      return {
        isError: true,
        errorCategory: 'validation',
        isRetryable: false,
        message: `Unknown tool name: ${toolName}`,
      };
  }
}

