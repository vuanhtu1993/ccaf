/**
 * Unit Test Suite: Part B — Claude Agent SDK Adapter (@anthropic-ai/claude-agent-sdk)
 *
 * Kiểm tra các tính năng cốt lõi theo Task Statement 1.5, 2.1, 2.2 & 5.1:
 * - Khởi tạo In-Process MCP Server với 10 tools nghiệp vụ
 * - PreToolUse Hook: Chặn vi phạm thứ tự (PrerequisiteGate) và vi phạm hạn mức (ComplianceGuard)
 * - PostToolUse Hook: Cắt gọt dữ liệu ERP (ContextTrimmer) và cập nhật <case_facts> (CaseFactsManager)
 *
 * Made by Anh Tu - Share to be share
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNovaSmartMcpServer,
  createNovaSmartSdkHooks,
  NovaSmartSessionState,
  NovaSmartSessionRuntime,
  buildNovaSmartAgentSdkOptions,
  invokePreToolUseHook,
  invokePostToolUseHook,
} from '../src/adapters/agent-sdk.js';
import { resetMockDb, mockOrders } from '../src/domain/mock-db.js';

describe('Part B — Claude Agent SDK Adapter: MCP Server & Native Hooks (Task 1.5, 2.1, 2.4, 5.1)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('should create an in-process SDK MCP server named novasmart', () => {
    const server = createNovaSmartMcpServer();
    expect(server).toBeDefined();
    expect(server.type).toBe('sdk');
    expect(server.name).toBe('novasmart');
    expect(server.instance).toBeDefined();
  });

  it('buildNovaSmartAgentSdkOptions should assemble complete SDK query options', () => {
    const state = new NovaSmartSessionState();
    const sdkOptions = buildNovaSmartAgentSdkOptions(state, {
      model: 'haiku',
      maxTurns: 5,
      sessionId: 'sess_test_123',
    });

    expect(sdkOptions.model).toBe('claude-haiku-5-5');
    expect(sdkOptions.maxTurns).toBe(5);
    expect(sdkOptions.resume).toBe('sess_test_123');
    expect(sdkOptions.mcpServers?.['novasmart']).toBeDefined();
    expect(sdkOptions.hooks?.PreToolUse).toBeDefined();
    expect(sdkOptions.hooks?.PostToolUse).toBeDefined();
    expect(sdkOptions.allowedTools).toContain('mcp__novasmart__*');
    expect(sdkOptions.systemPrompt).toContain('NovaSmart');
  });

  it('PreToolUse hook should return permissionDecision: deny when refund prerequisites are missing', async () => {
    const runtime = new NovaSmartSessionRuntime();
    const hooks = createNovaSmartSdkHooks(runtime);

    // Chưa xác minh danh tính khách hàng mà gọi mcp__novasmart__process_refund
    const unverifiedOutput = await invokePreToolUseHook(
      hooks,
      'mcp__novasmart__process_refund',
      { order_id: 'ORD-8821', amount: 100, reason: 'test' }
    );

    expect(unverifiedOutput.decision).toBe('block');
    expect(unverifiedOutput.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    if (unverifiedOutput.hookSpecificOutput?.hookEventName === 'PreToolUse') {
      expect(unverifiedOutput.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(unverifiedOutput.hookSpecificOutput.permissionDecisionReason).toContain('verified customer');
    }
  });

  it('PreToolUse hook should return permissionDecision: deny when lookup_order is called before customer verification', async () => {
    const runtime = new NovaSmartSessionRuntime();
    const hooks = createNovaSmartSdkHooks(runtime);

    // Chưa xác minh danh tính khách hàng mà gọi mcp__novasmart__lookup_order
    const unverifiedLookup = await invokePreToolUseHook(
      hooks,
      'mcp__novasmart__lookup_order',
      { order_id: 'ORD-8821' }
    );

    expect(unverifiedLookup.decision).toBe('block');
    expect(unverifiedLookup.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    if (unverifiedLookup.hookSpecificOutput?.hookEventName === 'PreToolUse') {
      expect(unverifiedLookup.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(unverifiedLookup.hookSpecificOutput.permissionDecisionReason).toContain('verified customer');
    }
  });

  it('PreToolUse hook should return permissionDecision: deny when refund exceeds $500 even if customer is verified', async () => {
    const runtime = new NovaSmartSessionRuntime();
    // Giả lập khách hàng đã xác minh và đơn hàng đã kiểm định PASSED
    runtime.gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    runtime.gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        return_inspection_status: 'PASSED',
      },
    });

    const hooks = createNovaSmartSdkHooks(runtime);
    const exceedOutput = await invokePreToolUseHook(
      hooks,
      'mcp__novasmart__process_refund',
      { order_id: 'ORD-8821', amount: 650, reason: 'test' }
    );

    expect(exceedOutput.decision).toBe('block');
    if (exceedOutput.hookSpecificOutput?.hookEventName === 'PreToolUse') {
      expect(exceedOutput.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(exceedOutput.hookSpecificOutput.permissionDecisionReason).toContain('escalate_to_human');
    }
  });

  it('PreToolUse hook should return permissionDecision: allow when all prerequisites and compliance rules pass', async () => {
    const runtime = new NovaSmartSessionRuntime();
    runtime.gate.recordToolResult('get_customer', {
      isError: false,
      data: {
        matches: 1,
        customers: [{ customer_id: 'CUST-001', name: 'Alex Trần', phone: '0901234567' }],
      },
    });
    runtime.gate.recordToolResult('lookup_order', {
      isError: false,
      data: {
        order_id: 'ORD-8821',
        return_inspection_status: 'PASSED',
      },
    });

    const hooks = createNovaSmartSdkHooks(runtime);
    const allowedOutput = await invokePreToolUseHook(
      hooks,
      'mcp__novasmart__process_refund',
      { order_id: 'ORD-8821', amount: 100, reason: 'valid refund' }
    );

    expect(allowedOutput.continue).toBe(true);
    if (allowedOutput.hookSpecificOutput?.hookEventName === 'PreToolUse') {
      expect(allowedOutput.hookSpecificOutput.permissionDecision).toBe('allow');
    }
  });

  it('PostToolUse hook should rewrite 62-field ERP output via updatedToolOutput and inject <case_facts> via additionalContext', async () => {
    const runtime = new NovaSmartSessionRuntime();
    const hooks = createNovaSmartSdkHooks(runtime);

    const rawErpOrder = mockOrders.find((o) => o.order_id === 'ORD-8821')!;
    const postOutput = await invokePostToolUseHook(
      hooks,
      'mcp__novasmart__lookup_order',
      { order_id: 'ORD-8821' },
      { isError: false, data: rawErpOrder }
    );

    expect(postOutput.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
    if (postOutput.hookSpecificOutput?.hookEventName === 'PostToolUse') {
      const updated = postOutput.hookSpecificOutput.updatedToolOutput as {
        isError: boolean;
        data: Record<string, unknown>;
      };
      expect(updated.data.status).toBe('DELIVERED');
      expect(updated.data).not.toHaveProperty('erp_warehouse_bin_code');
      expect(postOutput.hookSpecificOutput.additionalContext).toContain('<case_facts>');
      expect(postOutput.hookSpecificOutput.additionalContext).toContain('ORD-8821');
    }
  });
});

