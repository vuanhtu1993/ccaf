import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAndTrimToolResult } from '../src/domain/context-trimmer.js';
import { CaseFactsManager } from '../src/domain/case-facts.js';
import { executeDomainTool } from '../src/domain/tools.js';
import { resetMockDb } from '../src/domain/mock-db.js';

describe('Act 2: PostToolUse Data Normalization, Trimming & Case Facts Persistence (Task 1.5 & 5.1)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should trim 62 flat ERP fields down to 5 essential fields and normalize Unix timestamp + numeric status code', async () => {
    const rawResult = await executeDomainTool('lookup_order', { order_id: 'ORD-8821' });
    expect(rawResult.isError).toBe(false);

    const rawJsonLength = JSON.stringify(rawResult).length;
    const trimmedResult = normalizeAndTrimToolResult('lookup_order', rawResult);
    const trimmedJsonLength = JSON.stringify(trimmedResult).length;

    expect(trimmedResult.isError).toBe(false);
    if (!trimmedResult.isError) {
      const data = trimmedResult.data as Record<string, unknown>;
      expect(Object.keys(data)).toEqual([
        'order_id',
        'status',
        'total_amount',
        'delivery_date_iso',
        'return_eligibility',
      ]);
      expect(data.status).toBe('DELIVERED'); // normalized from order_status_code: 3
      expect(String(data.delivery_date_iso)).toMatch(/^\d{4}-\d{2}-\d{2}T/); // normalized from Unix timestamp
      expect(data).not.toHaveProperty('erp_warehouse_bin_code');
    }

    // Chứng minh tiết kiệm > 70% dung lượng token/ký tự (Task 5.1)
    expect(trimmedJsonLength).toBeLessThan(rawJsonLength * 0.3);
  });

  it('should automatically extract transactional Case Facts from tool results into a persistent block', async () => {
    const facts = new CaseFactsManager();

    const custResult = await executeDomainTool('get_customer', { phone: '0901234567' });
    const orderResult = await executeDomainTool('lookup_order', { order_id: 'ORD-8821' });

    facts.ingestToolResult('get_customer', custResult);
    facts.ingestToolResult('lookup_order', orderResult);

    const prompt = facts.injectIntoSystemPrompt('Base System Prompt');
    expect(prompt).toContain('<case_facts>');
    expect(prompt).toContain('verified_customer_id: CUST-001');
    expect(prompt).toContain('order_id: ORD-8821');
    expect(prompt).toContain('order_total_amount: $650');
  });
});

