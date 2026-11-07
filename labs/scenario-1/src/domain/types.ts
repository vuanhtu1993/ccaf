/**
 * Domain Types cho Scenario 1: Customer Support Resolution Agent
 * Tuân thủ chuẩn đề thi CCA-F (Claude Certified Architect - Foundations)
 *
 * Made by Anh Tu - Share to be share
 */

/**
 * 4 phân loại lỗi chuẩn theo Task Statement 2.2 của CCA-F:
 * - transient: Lỗi tạm thời (timeout, 503, network glitch) -> có thể thử lại (isRetryable: true).
 * - validation: Dữ liệu đầu vào sai định dạng -> không thể thử lại (isRetryable: false).
 * - business: Vi phạm quy tắc nghiệp vụ/chính sách -> không thể thử lại (isRetryable: false).
 * - permission: Quyền truy cập bị từ chối -> không thể thử lại (isRetryable: false).
 */
export type ErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

export interface StructuredSuccessResult<T> {
  isError: false;
  data: T;
}

export interface StructuredErrorResult {
  isError: true;
  errorCategory: ErrorCategory;
  isRetryable: boolean;
  message: string;
  suggestedAction?: 'escalate_to_human' | 'clarify_with_user' | 'retry_later';
}

export type StructuredToolResult<T> = StructuredSuccessResult<T> | StructuredErrorResult;

export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Đơn hàng ERP thô từ hệ thống Legacy với 62 trường phẳng.
 * Minh họa tình trạng "Context Pollution" (Task 5.1).
 */
export interface RawErpOrder {
  order_id: string;
  customer_id: string;
  total_amount: number;
  currency: string;
  delivery_timestamp: number; // Unix epoch timestamp (seconds)
  order_status_code: number; // 1 = PROCESSING, 2 = SHIPPED, 3 = DELIVERED, 4 = RETURNED
  return_inspection_status: 'PENDING' | 'PASSED' | 'FAILED';
  items: OrderItem[];

  // 54 trường ERP kỹ thuật phụ trợ (gây ô nhiễm context nếu không cắt gọt)
  erp_company_code: string;
  erp_fiscal_year: number;
  erp_gl_account_id: string;
  erp_cost_center: string;
  erp_profit_center: string;
  erp_plant_id: string;
  erp_storage_location: string;
  erp_warehouse_bin_code: string;
  erp_carrier_code: string;
  erp_carrier_contract_ref: string;
  erp_shipping_method: string;
  erp_shipping_route_id: string;
  erp_incoterms: string;
  erp_payment_terms_code: string;
  erp_tax_code: string;
  erp_tax_jurisdiction: string;
  erp_vat_registration_number: string;
  erp_credit_check_status: string;
  erp_customs_declaration_no: string;
  erp_tariff_code: string;
  erp_export_license_id: string;
  erp_exchange_rate_fixed: number;
  erp_settlement_currency: string;
  erp_clearing_doc_number: string;
  erp_dunning_level: number;
  erp_payment_block_reason: string;
  erp_order_reason_code: string;
  erp_sales_district: string;
  erp_sales_group: string;
  erp_sales_office: string;
  erp_pricing_procedure: string;
  erp_condition_record_no: string;
  erp_discount_calc_rule: string;
  erp_rebate_group_id: string;
  erp_freight_cost_center: string;
  erp_handling_unit_id: string;
  erp_bill_of_lading: string;
  erp_master_tracking_num: string;
  erp_customs_clearance_date: string;
  erp_import_duty_amount: number;
  erp_excise_duty_amount: number;
  erp_ledger_group: string;
  erp_segment_id: string;
  erp_profitability_segment: string;
  erp_wbs_element: string;
  erp_sales_org_unit: string;
  erp_distribution_channel: string;
  erp_division_code: string;
  erp_customer_account_group: string;
  erp_reconciliation_account: string;
  erp_cash_discount_days: number;
  erp_baseline_date_calc: string;
  erp_posting_period: number;
  erp_document_header_text: string;
}

/**
 * Đơn hàng sau khi được PostToolUse Hook cắt gọt (Task 1.5, 5.1).
 * Giảm từ 62 fields xuống còn 5 fields cốt lõi.
 */
export interface TrimmedOrder {
  order_id: string;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'RETURNED';
  total_amount: number;
  delivery_date_iso: string;
  return_eligibility: {
    items: OrderItem[];
    return_inspection_status: 'PENDING' | 'PASSED' | 'FAILED';
  };
}

/**
 * 3 Triggers Escalation chuẩn theo Task Statement 5.2 của CCA-F
 */
export type EscalationTrigger =
  | 'customer_requested_human' // Khách yêu cầu đích danh gặp người thật
  | 'policy_gap' // Chính sách công ty im lặng hoặc không quy định tình huống
  | 'policy_threshold_exceeded'; // Vượt ngưỡng tài chính tự động ($500)

/**
 * Bản tóm tắt chuyển giao con người có cấu trúc (Task 1.4 L363)
 */
export interface HandoffSummary {
  handoff_id: string;
  customer_id: string;
  root_cause: string;
  refund_amount_requested: number;
  recommended_action: string;
  trigger_reason: EscalationTrigger;
  timestamp_iso: string;
}

export interface StoreLocation {
  store_id: string;
  name: string;
  district: string;
  address: string;
  phone: string;
  open_hours: string;
}

export interface Promotion {
  code: string;
  discount_percent: number;
  min_order_amount: number;
  description: string;
  active: boolean;
}

export interface ProductCatalogItem {
  sku: string;
  name: string;
  category: string;
  description: string;
  specs: Record<string, string>;
  price: number;
}

export interface InventoryRecord {
  sku: string;
  district: string;
  in_stock: number;
  warehouse_name: string;
}

export interface WarrantyTicket {
  ticket_id: string;
  order_id: string;
  issue_description: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  created_at_iso: string;
}

