import { describe, it, expect } from 'vitest';
import { PrerequisiteGate } from '../src/domain/prerequisite-gate.js';
import { ComplianceGuard } from '../src/domain/compliance-guard.js';

describe('Act 4 & 5A: State-Driven Prerequisite Gate & Compliance Interception (Task 1.4 & 1.5)', () => {
  it('should NOT verify customer when get_customer returns 2 ambiguous matches', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 2,
        customers: [
          { customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' },
          { customer_id: 'CUST-002', name: 'Alex Trần', phone: '0987654321' },
        ],
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.errorCategory).toBe('business');
    expect(decision.errorResult?.isRetryable).toBe(false);
    expect(decision.errorResult?.message).toContain('verified customer');
  });

  it('should block process_refund when customer is verified but order return_inspection_status is PENDING', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        customer_id: 'CUST-001',
        return_inspection_status: 'PENDING',
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.message).toContain('inspection');
  });

  it('should allow process_refund once customer is uniquely verified AND order inspection is PASSED', () => {
    const gate = new PrerequisiteGate();
    gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        customer_id: 'CUST-001',
        return_inspection_status: 'PASSED',
      },
    });

    const decision = gate.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 100,
    });
    expect(decision.allowed).toBe(true);
  });

  it('should intercept and block refunds exceeding $500 with escalation redirect guidance', () => {
    const guard = new ComplianceGuard({ maxAutoRefundAmount: 500 });
    const decision = guard.checkPreToolUse('process_refund', {
      order_id: 'ORD-8821',
      amount: 650,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorResult?.errorCategory).toBe('business');
    expect(decision.errorResult?.isRetryable).toBe(false);
    expect(decision.errorResult?.suggestedAction).toBe('escalate_to_human');
  });
});

