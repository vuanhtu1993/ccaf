import { describe, it, expect, beforeEach } from 'vitest';
import {
  MessagesApiSupportAgent,
  ScriptedMockAnthropicClient,
} from '../src/adapters/messages-api.js';
import { resetMockDb, setOrderInspectionStatus } from '../src/domain/mock-db.js';
import type { HandoffSummary } from '../src/domain/types.js';

describe('Part A — Messages API Agentic Loop & All 3 Escalation Triggers (Task 1.1, 1.4, 1.5, 5.2)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('Act 1: should execute parallel tool_use blocks and append all tool_results in a single user message', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'check_inventory', input: { sku: 'ROBO-X1', district: 'Quận 1' } },
          { type: 'tool_use', id: 'tu_2', name: 'validate_promo', input: { code: 'TECH20' } },
          { type: 'tool_use', id: 'tu_3', name: 'lookup_store_location', input: { district: 'Quận 1' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Quận 1 còn 5 máy, mã TECH20 giảm 20%, mở cửa 8:00-22:00.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Kiểm tra tồn kho ROBO-X1 Q1, mã TECH20 và giờ mở cửa.');

    expect(turn.iterations).toBe(2);
    expect(turn.toolCallsExecuted).toEqual([
      'check_inventory',
      'validate_promo',
      'lookup_store_location',
    ]);

    // Kiểm tra message lịch sử thứ 3 (user message chứa kết quả tool) phải gom đủ 3 tool_result blocks (Task 1.1)
    const history = agent.getMessagesHistory();
    const toolResultMsg = history[2];
    expect(toolResultMsg.role).toBe('user');
    expect(Array.isArray(toolResultMsg.content)).toBe(true);
    expect((toolResultMsg.content as unknown[]).length).toBe(3);
  });

  it('Act 4: should block premature refund via PrerequisiteGate and escalate on competitor price-match policy gap', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_cust', name: 'get_customer', input: { phone: '0901234567' } },
          { type: 'tool_use', id: 'tu_ord', name: 'lookup_order', input: { order_id: 'ORD-8821' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          // Cố gọi hoàn tiền khi return_inspection_status đang là PENDING
          { type: 'tool_use', id: 'tu_ref', name: 'process_refund', input: { order_id: 'ORD-8821', amount: 200, reason: 'Khách đòi hoàn ngay' } },
          { type: 'tool_use', id: 'tu_pol', name: 'get_return_policy', input: { topic: 'price_matching' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_esc',
            name: 'escalate_to_human',
            input: {
              customer_id: 'CUST-001',
              root_cause: 'Khách yêu cầu khớp giá sàn đối thủ S (Policy Gap) và đòi hoàn tiền khi chưa kiểm định',
              refund_amount_requested: 200,
              recommended_action: 'Xem xét ngoại lệ khớp giá sàn S và hướng dẫn kiểm định hàng lỗi',
              trigger_reason: 'policy_gap',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Đã chuyển chuyên viên xử lý ngoại lệ chính sách khớp giá.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Hoàn tiền ngay hoặc khớp giá sàn S cho tôi!');

    expect(turn.blockedToolCalls).toContain('process_refund');
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('policy_gap');
  });

  it('Act 5A: should intercept refund > $500 via ComplianceGuard and redirect to escalate_to_human', async () => {
    setOrderInspectionStatus('ORD-8821', 'PASSED');

    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'get_customer', input: { phone: '0901234567' } },
          { type: 'tool_use', id: 'tu_2', name: 'lookup_order', input: { order_id: 'ORD-8821' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_3', name: 'process_refund', input: { order_id: 'ORD-8821', amount: 650, reason: 'Hàng lỗi đã kiểm định' } },
        ],
      },
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_4',
            name: 'escalate_to_human',
            input: {
              customer_id: 'CUST-001',
              root_cause: 'Khoản hoàn tiền $650 vượt hạn mức tự động $500',
              refund_amount_requested: 650,
              recommended_action: 'Phê duyệt hoàn tiền $650 cho đơn ORD-8821 đã kiểm định PASSED',
              trigger_reason: 'policy_threshold_exceeded',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Khoản hoàn $650 vượt hạn mức $500, đã chuyển quản lý phê duyệt.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Hoàn toàn bộ $650 cho đơn ORD-8821 giúp tôi.');

    expect(turn.blockedToolCalls).toEqual(['process_refund']);
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('policy_threshold_exceeded');
    expect(turn.handoffSummary?.refund_amount_requested).toBe(650);
  });

  it('Act 5B: should honor explicit human request IMMEDIATELY without calling investigation or refund tools', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_human',
            name: 'escalate_to_human',
            input: {
              customer_id: 'UNKNOWN_OR_PENDING',
              root_cause: 'Khách hàng yêu cầu trực tiếp gặp quản lý con người ngay lập tức',
              refund_amount_requested: 0,
              recommended_action: 'Tiếp nhận hội thoại trực tiếp theo yêu cầu khách hàng',
              trigger_reason: 'customer_requested_human',
            },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Tôi đã kết nối ngay với quản lý hỗ trợ cho bạn.' }],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Cho tôi gặp quản lý ngay lập tức!');

    // Tuyệt đối không có tool điều tra nào được gọi trước escalate_to_human (Task 5.2 L1173)
    expect(turn.toolCallsExecuted).toEqual(['escalate_to_human']);
    expect(turn.escalated).toBe(true);
    expect(turn.handoffSummary?.trigger_reason).toBe('customer_requested_human');
  });

  it('Act 2 / Claude 5.5 Regression: should strip thinking blocks from assistant message history when case_facts mutates system prompt', async () => {
    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'thinking',
            thinking: 'Cần xác minh khách hàng Alex Trần và đơn ORD-8821.',
            signature: 'sig_bound_to_initial_system_prompt',
          },
          { type: 'tool_use', id: 'tu_cust', name: 'get_customer', input: { phone: '0901234567' } },
          { type: 'tool_use', id: 'tu_ord', name: 'lookup_order', input: { order_id: 'ORD-8821' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'thinking',
            thinking: 'Đã có kết quả tra cứu đơn hàng.',
            signature: 'sig_bound_to_updated_system_prompt',
          },
          { type: 'text', text: 'Đơn hàng ORD-8821 của anh Alex Trần đã giao thành công (DELIVERED).' },
        ],
      },
    ]);

    const agent = new MessagesApiSupportAgent({ client: mockClient });
    const turn = await agent.runTurn('Tôi là Alex Trần, SĐT 0901234567, kiểm tra đơn hàng ORD-8821 giúp tôi.');

    expect(turn.iterations).toBe(2);
    expect(agent.getCaseFacts().getFact('order_status')).toBe('DELIVERED');

    // Đảm bảo không còn khối thinking nào nằm trong lịch sử hội thoại gửi lại lên API
    const assistantMsg1 = agent.getMessagesHistory()[1];
    expect(Array.isArray(assistantMsg1.content)).toBe(true);
    const blockTypes = (assistantMsg1.content as Array<{ type: string }>).map((b) => b.type);
    expect(blockTypes).not.toContain('thinking');
    expect(blockTypes).toEqual(['tool_use', 'tool_use']);
  });
});

