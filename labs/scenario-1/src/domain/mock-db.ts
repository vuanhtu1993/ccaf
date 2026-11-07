/**
 * Mock ERP & CRM Database cho NovaSmart Ecosystem
 *
 * Thiết kế cho bài thi CCA-F:
 * 1. Tái hiện bài toán Mơ hồ danh tính (Ambiguity Resolution - Task 5.2): 2 khách hàng trùng tên Alex Trần.
 * 2. Tái hiện dữ liệu ERP cồng kềnh 62 fields (Context Pollution - Task 5.1).
 * 3. Hỗ trợ Fault Injection tách biệt khỏi Tool Input Schema (Task 2.1 & 2.2).
 * 4. Tái hiện Lỗ hổng chính sách (Policy Gap - Task 5.2).
 *
 * Made by Anh Tu - Share to be share
 */

import type {
  Customer,
  RawErpOrder,
  StoreLocation,
  Promotion,
  ProductCatalogItem,
  InventoryRecord,
  WarrantyTicket,
  ErrorCategory,
} from './types.js';

export interface InjectedFault {
  remainingFailures: number;
  errorCategory: ErrorCategory;
  message: string;
}

// ── 1. Mock Data Source ───────────────────────────────────────────────

const INITIAL_CUSTOMERS: Customer[] = [
  {
    customer_id: 'CUST-001',
    name: 'Alex Trần',
    phone: '0901234567',
    email: 'alex.tran.q1@example.com',
    address: '123 Lê Lợi, Phường Bến Nghé',
    district: 'Quận 1',
  },
  {
    customer_id: 'CUST-002',
    name: 'Alex Trần',
    phone: '0987654321',
    email: 'alex.tran.q7@example.com',
    address: '456 Nguyễn Lương Bằng, Tân Phú',
    district: 'Quận 7',
  },
  {
    customer_id: 'CUST-003',
    name: 'Linh Nguyễn',
    phone: '0912345678',
    email: 'linh.nguyen@example.com',
    address: '789 Điện Biên Phủ, Phường 22',
    district: 'Bình Thạnh',
  },
];

const INITIAL_ORDERS: RawErpOrder[] = [
  {
    order_id: 'ORD-8821',
    customer_id: 'CUST-001',
    total_amount: 650,
    currency: 'USD',
    delivery_timestamp: 1762300800, // Unix timestamp: 2025-11-05T00:00:00.000Z
    order_status_code: 3, // 3 = DELIVERED
    return_inspection_status: 'PENDING',
    items: [
      {
        sku: 'ROBO-X1',
        name: 'Robot Hút Bụi NovaSmart Clean X1 Pro',
        quantity: 1,
        unit_price: 650,
      },
    ],

    // 54 fields kỹ thuật ERP thô
    erp_company_code: 'VN10',
    erp_fiscal_year: 2025,
    erp_gl_account_id: 'GL-410020-REVENUE',
    erp_cost_center: 'CC-HCM-NORTH-01',
    erp_profit_center: 'PC-CONSUMER-ROBOTICS',
    erp_plant_id: 'PL-SG-01',
    erp_storage_location: 'SL-FINISHED-GOODS',
    erp_warehouse_bin_code: 'WH-BIN-A12-R4-T2',
    erp_carrier_code: 'VNPOST-EXP',
    erp_carrier_contract_ref: 'CTR-2024-VNP-9981',
    erp_shipping_method: 'EXP_SURFACE_DELIVERY',
    erp_shipping_route_id: 'RT-SGN-INNER-01',
    erp_incoterms: 'DDP-DELIVERED_DUTY_PAID',
    erp_payment_terms_code: 'PT-NET-30D',
    erp_tax_code: 'VAT-10-STANDARD',
    erp_tax_jurisdiction: 'TAX-JUR-VN-HCM',
    erp_vat_registration_number: 'VAT-0312998877',
    erp_credit_check_status: 'CREDIT-APPROVED-RISK-LOW',
    erp_customs_declaration_no: 'CD-2025-11-884920',
    erp_tariff_code: 'HS-8508-11-00',
    erp_export_license_id: 'EL-NOT-APPLICABLE',
    erp_exchange_rate_fixed: 25450,
    erp_settlement_currency: 'VND',
    erp_clearing_doc_number: 'CLR-DOC-2025-00918',
    erp_dunning_level: 0,
    erp_payment_block_reason: 'NONE',
    erp_order_reason_code: 'DIRECT_ECOMMERCE_WEB',
    erp_sales_district: 'SD-HCM-URBAN',
    erp_sales_group: 'SG-ONLINE-RETAIL',
    erp_sales_office: 'SO-SGN-HEADQUARTER',
    erp_pricing_procedure: 'PRC-STD-VN-RETAIL-01',
    erp_condition_record_no: 'CR-90812491',
    erp_discount_calc_rule: 'DISC-NET-AFTER-TAX',
    erp_rebate_group_id: 'RBG-RETAIL-TIER1',
    erp_freight_cost_center: 'FC-LOGISTICS-LASTMILE',
    erp_handling_unit_id: 'HU-8849102-PALLET',
    erp_bill_of_lading: 'BOL-VN-2025-9921',
    erp_master_tracking_num: 'TRK-9948201948VN',
    erp_customs_clearance_date: '2025-10-30',
    erp_import_duty_amount: 0,
    erp_excise_duty_amount: 0,
    erp_ledger_group: '0L-LEADING-LEDGER',
    erp_segment_id: 'SEG-SMART-HOME',
    erp_profitability_segment: 'PSA-B2C-VIETNAM',
    erp_wbs_element: 'WBS-NONE-OPERATIONAL',
    erp_sales_org_unit: 'SOU-VN-DIRECT',
    erp_distribution_channel: 'DC-ONLINE-STORE',
    erp_division_code: 'DIV-HOME-APPLIANCES',
    erp_customer_account_group: 'CAG-INDIVIDUAL-RETAIL',
    erp_reconciliation_account: 'REC-ACC-112000',
    erp_cash_discount_days: 0,
    erp_baseline_date_calc: 'POSTING_DATE',
    erp_posting_period: 11,
    erp_document_header_text: 'WEB-ORDER-ORD-8821-NOVASMART',
  },
];

const INITIAL_CATALOG: ProductCatalogItem[] = [
  {
    sku: 'ROBO-X1',
    name: 'Robot Hút Bụi NovaSmart Clean X1 Pro',
    category: 'Robot hút bụi',
    description: 'Lực hút 6000Pa, lau xoay kép 180 vòng/phút, tự động giặt giẻ và sấy khô bằng khí nóng.',
    specs: {
      suction_power: '6000Pa',
      navigation: 'LiDAR LDS 4.0 + AI Camera 3D',
      battery: '5200mAh (hoạt động liên tục 180 phút)',
      warranty_months: '24 tháng chính hãng',
    },
    price: 650,
  },
  {
    sku: 'AIR-MAX',
    name: 'Máy Lọc Không Khí NovaSmart PureAir Max',
    category: 'Máy lọc không khí',
    description: 'Màng lọc HEPA H13 diện tích phòng 60m2, cảm biến bụi mịn PM2.5 hiển thị thời gian thực.',
    specs: {
      coverage: '60m2',
      filter_type: 'HEPA H13 + Than hoạt tính',
      noise_level: '24dB (chế độ ngủ)',
    },
    price: 280,
  },
];

const INITIAL_STORES: StoreLocation[] = [
  {
    store_id: 'STORE-Q1',
    name: 'NovaSmart Flagship Store Quận 1',
    district: 'Quận 1',
    address: '68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
    phone: '028 3822 9999',
    open_hours: '08:00 - 22:00 (Tất cả các ngày trong tuần)',
  },
  {
    store_id: 'STORE-Q7',
    name: 'NovaSmart Experience Center Quận 7',
    district: 'Quận 7',
    address: '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM',
    phone: '028 5411 8888',
    open_hours: '09:00 - 21:30 (Tất cả các ngày trong tuần)',
  },
];

const INITIAL_PROMOS: Promotion[] = [
  {
    code: 'TECH20',
    discount_percent: 20,
    min_order_amount: 200,
    description: 'Giảm 20% cho đơn hàng thiết bị thông minh từ $200 trở lên trong tháng này.',
    active: true,
  },
  {
    code: 'WELCOME50',
    discount_percent: 50,
    min_order_amount: 1000,
    description: 'Giảm 50% cho khách hàng mới với đơn trên $1000 (đã hết hạn).',
    active: false,
  },
];

const INITIAL_INVENTORY: InventoryRecord[] = [
  {
    sku: 'ROBO-X1',
    district: 'Quận 1',
    in_stock: 5,
    warehouse_name: 'Kho Flagship Quận 1',
  },
  {
    sku: 'ROBO-X1',
    district: 'Quận 7',
    in_stock: 12,
    warehouse_name: 'Kho Experience Center Quận 7',
  },
  {
    sku: 'AIR-MAX',
    district: 'Quận 1',
    in_stock: 8,
    warehouse_name: 'Kho Flagship Quận 1',
  },
];

/**
 * Văn bản Chính sách Bảo hành & Đổi trả chính thức của NovaSmart
 * Minh họa bài toán Policy Gap (Task 5.2):
 * - Có chính sách hoàn tiền khi hàng lỗi kỹ thuật sau kiểm định.
 * - Có chính sách điều chỉnh giá độc quyền TRÊN WEBSITE novasmart.vn (trong vòng 7 ngày nếu giảm giá).
 * - HOÀN TOÀN IM LẶNG về việc khớp giá sàn đối thủ (Shopee, sàn S, Lazada, v.v.).
 */
export const returnPolicyText = `
CHÍNH SÁCH ĐỔI TRẢ, BẢO HÀNH VÀ GIÁ CỦA NOVASMART (Phiên bản 2025.2)

1. ĐIỀU KIỆN ĐỔI TRẢ VÀ HOÀN TIỀN:
- Khách hàng được quyền yêu cầu đổi trả hoặc hoàn tiền trong vòng 15 ngày kể từ ngày nhận hàng.
- BẮT BUỘC: Hàng hóa phải trải qua bước kiểm định kỹ thuật (inspection) tại trung tâm bảo hành NovaSmart. Chỉ các đơn hàng có trạng thái kiểm định "PASSED" (xác nhận lỗi từ nhà sản xuất) mới đủ điều kiện thực hiện hoàn tiền.
- Hạn mức hoàn tiền tự động qua hệ thống số là tối đa $500. Các giao dịch hoàn tiền trên $500 phải do Quản lý Bộ phận phê duyệt thủ công.

2. CHÍNH SÁCH ĐIỀU CHỈNH GIÁ (PRICE ADJUSTMENT):
- NovaSmart cam kết bảo vệ quyền lợi người tiêu dùng: Nếu sản phẩm quý khách đã mua tại novasmart.vn giảm giá trên chính website novasmart.vn trong vòng 7 ngày kể từ ngày giao hàng, chúng tôi sẽ hoàn trả phần tiền chênh lệch vào ví tài khoản.
- LƯU Ý QUAN TRỌNG: Chính sách bảo đảm giá này CHỈ ÁP DỤNG cho giá niêm yết chính thức trên hệ thống website novasmart.vn.
(Chính sách hiện tại không có điều khoản áp dụng đối với các sàn thương mại điện tử hoặc đối thủ bán lẻ bên thứ ba).
`;

// ── 2. Mutable State & Helper Functions ───────────────────────────────

export let mockCustomers: Customer[] = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
export let mockOrders: RawErpOrder[] = JSON.parse(JSON.stringify(INITIAL_ORDERS));
export let mockCatalog: ProductCatalogItem[] = JSON.parse(JSON.stringify(INITIAL_CATALOG));
export let mockStores: StoreLocation[] = JSON.parse(JSON.stringify(INITIAL_STORES));
export let mockPromos: Promotion[] = JSON.parse(JSON.stringify(INITIAL_PROMOS));
export let mockInventory: InventoryRecord[] = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
export let mockWarrantyTickets: WarrantyTicket[] = [];

const faultRegistry = new Map<string, InjectedFault>();

export function injectFault(toolName: string, fault: InjectedFault): void {
  faultRegistry.set(toolName, { ...fault });
}

export function consumeFault(toolName: string): InjectedFault | null {
  const fault = faultRegistry.get(toolName);
  if (!fault || fault.remainingFailures <= 0) {
    return null;
  }
  fault.remainingFailures -= 1;
  if (fault.remainingFailures <= 0) {
    faultRegistry.delete(toolName);
  } else {
    faultRegistry.set(toolName, fault);
  }
  return fault;
}

export function resetFaults(): void {
  faultRegistry.clear();
}

export function setOrderInspectionStatus(
  orderId: string,
  status: 'PENDING' | 'PASSED' | 'FAILED'
): void {
  const order = mockOrders.find((o) => o.order_id === orderId);
  if (order) {
    order.return_inspection_status = status;
  }
}

export function resetMockDb(): void {
  mockCustomers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
  mockOrders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
  mockCatalog = JSON.parse(JSON.stringify(INITIAL_CATALOG));
  mockStores = JSON.parse(JSON.stringify(INITIAL_STORES));
  mockPromos = JSON.parse(JSON.stringify(INITIAL_PROMOS));
  mockInventory = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
  mockWarrantyTickets = [];
  resetFaults();
}

