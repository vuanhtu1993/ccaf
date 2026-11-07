import { describe, it, expect, beforeEach } from 'vitest';
import { TOOL_DEFINITIONS, executeDomainTool } from '../src/domain/tools.js';
import { resetMockDb } from '../src/domain/mock-db.js';

describe('Act 1: Tool Descriptions, Boundaries & Multi-Intent Informational Tools (Task 2.1)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should define all 10 canonical tools with clear boundary instructions between similar tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual([
      'search_product_catalog',
      'check_inventory',
      'lookup_store_location',
      'validate_promo',
      'get_customer',
      'lookup_order',
      'get_return_policy',
      'create_warranty_ticket',
      'process_refund',
      'escalate_to_human',
    ]);

    const catalogTool = TOOL_DEFINITIONS.find((t) => t.name === 'search_product_catalog')!;
    const inventoryTool = TOOL_DEFINITIONS.find((t) => t.name === 'check_inventory')!;

    // Exercise 1 requirement (Task 2.1): differentiate similar tools with explicit boundary explanations
    expect(catalogTool.description).toContain('Do NOT use this tool to check stock');
    expect(inventoryTool.description).toContain('Do NOT use this tool for product specifications');
  });

  it('should execute informational tools for store location, inventory and promo code', async () => {
    const [inv, promo, store] = await Promise.all([
      executeDomainTool('check_inventory', { sku: 'ROBO-X1', district: 'Quận 1' }),
      executeDomainTool('validate_promo', { code: 'TECH20' }),
      executeDomainTool('lookup_store_location', { district: 'Quận 1' }),
    ]);

    expect(inv.isError).toBe(false);
    if (!inv.isError) {
      expect(inv.data).toMatchObject({
        sku: 'ROBO-X1',
        in_stock: 5,
      });
    }

    expect(promo.isError).toBe(false);
    if (!promo.isError) {
      expect(promo.data).toMatchObject({
        code: 'TECH20',
        discount_percent: 20,
      });
    }

    expect(store.isError).toBe(false);
    if (!store.isError) {
      expect(store.data).toMatchObject({
        district: 'Quận 1',
        store_id: 'STORE-Q1',
      });
    }
  });
});

