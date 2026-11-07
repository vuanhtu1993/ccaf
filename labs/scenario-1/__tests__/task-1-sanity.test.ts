import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockCustomers,
  mockOrders,
  injectFault,
  consumeFault,
  resetMockDb,
  returnPolicyText,
} from '../src/domain/mock-db.js';

describe('Task 1: Domain Types, Mock ERP Database & Fault Injection', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should have exactly 2 customers named Alex Trần for ambiguity resolution (Task 5.2)', () => {
    const matches = mockCustomers.filter((c) => c.name === 'Alex Trần');
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.phone)).toEqual(['0901234567', '0987654321']);
  });

  it('should store ORD-8821 as a flat 62-field ERP record with Unix timestamp and numeric status code (Task 1.5 & 5.1)', () => {
    const order = mockOrders.find((o) => o.order_id === 'ORD-8821');
    expect(order).toBeDefined();
    expect(order?.total_amount).toBe(650);
    expect(typeof order?.delivery_timestamp).toBe('number');
    expect(order?.order_status_code).toBe(3); // 3 = DELIVERED
    expect(order?.return_inspection_status).toBe('PENDING');
    expect(Object.keys(order!).length).toBeGreaterThanOrEqual(62);
  });

  it('should support programmatic fault injection without polluting tool input schemas (Task 2.1 & 2.2)', () => {
    injectFault('create_warranty_ticket', {
      remainingFailures: 1,
      errorCategory: 'transient',
      message: 'ERP Warranty Service connection timed out after 3000ms',
    });

    const firstAttempt = consumeFault('create_warranty_ticket');
    expect(firstAttempt?.errorCategory).toBe('transient');

    const secondAttempt = consumeFault('create_warranty_ticket');
    expect(secondAttempt).toBeNull();
  });

  it('should provide a return policy that addresses own-site adjustments but is silent on competitor price matching (Task 5.2)', () => {
    expect(returnPolicyText).toContain('novasmart.vn');
    expect(returnPolicyText.toLowerCase()).not.toContain('sàn s');
  });
});

