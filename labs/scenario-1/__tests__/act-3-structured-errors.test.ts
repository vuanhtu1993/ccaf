import { describe, it, expect, beforeEach } from 'vitest';
import { executeDomainTool } from '../src/domain/tools.js';
import { injectFault, resetMockDb } from '../src/domain/mock-db.js';

describe('Act 3: Structured MCP Error Responses & Valid Empty Results (Task 2.2)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should return retryable transient error when fault is injected, then succeed on retry', async () => {
    injectFault('create_warranty_ticket', {
      remainingFailures: 1,
      errorCategory: 'transient',
      message: 'Upstream warranty service 503 Service Unavailable',
    });

    const first = await executeDomainTool('create_warranty_ticket', {
      order_id: 'ORD-8821',
      issue_description: 'Robot bị móp vỏ khi giao hàng',
    });

    expect(first.isError).toBe(true);
    if (first.isError) {
      expect(first.errorCategory).toBe('transient');
      expect(first.isRetryable).toBe(true);
      expect(first.message).toContain('503');
    }

    // Lần gọi thứ 2: Fault đã được consume, phải thành công
    const second = await executeDomainTool('create_warranty_ticket', {
      order_id: 'ORD-8821',
      issue_description: 'Robot bị móp vỏ khi giao hàng',
    });
    expect(second.isError).toBe(false);
    if (!second.isError) {
      expect((second.data as { ticket_id: string }).ticket_id).toMatch(/^WT-/);
    }
  });

  it('should return non-retryable validation error for invalid SKU format', async () => {
    const res = await executeDomainTool('check_inventory', {
      sku: '   ',
      district: 'Quận 1',
    });
    expect(res.isError).toBe(true);
    if (res.isError) {
      expect(res.errorCategory).toBe('validation');
      expect(res.isRetryable).toBe(false);
      expect(res.message).toContain('SKU');
    }
  });

  it('should distinguish valid empty result (isError: false, matches: 0) from access failure (Task 2.2 L535)', async () => {
    const emptyCustomer = await executeDomainTool('get_customer', {
      name: 'Người Không Tồn Tại',
    });
    expect(emptyCustomer.isError).toBe(false);
    if (!emptyCustomer.isError) {
      expect(emptyCustomer.data).toEqual({ matches: 0, customers: [] });
    }

    const emptyOrder = await executeDomainTool('lookup_order', {
      order_id: 'ORD-NON-EXISTENT',
    });
    expect(emptyOrder.isError).toBe(false);
    if (!emptyOrder.isError) {
      expect(emptyOrder.data).toBeNull();
    }
  });
});

