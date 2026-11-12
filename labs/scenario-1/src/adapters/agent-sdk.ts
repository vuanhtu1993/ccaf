/**
 * Adapter Part B: Claude Agent SDK Adapter (@anthropic-ai/claude-agent-sdk)
 *
 * Triển khai theo Task Statement 1.4, 1.5, 2.1, 2.2, 2.4 & 5.1 của đề thi CCA-F:
 * - Task 2.1 & 2.4: Khởi tạo In-Process MCP Server (@anthropic-ai/claude-agent-sdk createSdkMcpServer + tool)
 *   phơi bày 10 công cụ nghiệp vụ của NovaSmart với Zod validation schemas.
 * - Task 1.4 & 1.5: Đăng ký PreToolUse Hook chặn vi phạm thứ tự bước (PrerequisiteGate)
 *   và chặn vi phạm hạn mức $500 (ComplianceGuard) bằng cơ chế native:
 *     permissionDecision: 'deny'
 * - Task 1.5 & 5.1: Đăng ký PostToolUse Hook cắt gọt payload ERP (ContextTrimmer)
 *   qua updatedToolOutput, đồng thời cập nhật khối <case_facts> bất biến qua additionalContext.
 *
 * Made by Anh Tu - Share to be share
 */

import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallbackMatcher,
  type HookEvent,
  type PreToolUseHookInput,
  type PostToolUseHookInput,
  type SyncHookJSONOutput,
  type McpSdkServerConfigWithInstance,
  type HookInput,
  type Options,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

import { TOOL_DEFINITIONS, executeDomainTool } from '../domain/tools.js';
import { PrerequisiteGate } from '../domain/prerequisite-gate.js';
import { ComplianceGuard } from '../domain/compliance-guard.js';
import { normalizeAndTrimToolResult } from '../domain/context-trimmer.js';
import { CaseFactsManager } from '../domain/case-facts.js';
import { buildCustomerSupportSystemPrompt } from '../domain/system-prompt.js';
import { SessionInspector } from '../domain/session-inspector.js';
import type { StructuredToolResult, HandoffSummary } from '../domain/types.js';
import {
  resolveModelName,
  type AnthropicClientLike,
  type AgentTurnResult,
} from './messages-api.js';

/**
 * Quản lý trạng thái phiên làm việc (Session State) cho Agent SDK.
 *
 * Lưu ý phân định khái niệm (CCAF Architectural Clarity):
 * - State (Trạng thái): Lưu giữ PrerequisiteGate, ComplianceGuard, CaseFactsManager qua các lượt thoại.
 * - Runtime (Bộ thực thi): Do hàm query() từ @anthropic-ai/claude-agent-sdk đảm nhiệm toàn quyền.
 * - Config/Options: Tham số cấu hình truyền vào khi khởi tạo Adapter hoặc khi gọi query().
 */
export class NovaSmartSessionState {
  public readonly gate: PrerequisiteGate;
  public readonly guard: ComplianceGuard;
  public readonly caseFacts: CaseFactsManager;
  public readonly baseSystemPrompt: string;

  constructor(config?: {
    maxAutoRefundAmount?: number;
    baseSystemPrompt?: string;
  }) {
    this.gate = new PrerequisiteGate();
    this.guard = new ComplianceGuard({
      maxAutoRefundAmount: config?.maxAutoRefundAmount ?? 500,
    });
    this.caseFacts = new CaseFactsManager();
    this.baseSystemPrompt =
      config?.baseSystemPrompt ?? buildCustomerSupportSystemPrompt();
  }

  public reset(): void {
    this.gate.reset();
    this.caseFacts.reset();
  }
}

/**
 * Backward compatibility alias cho các test suite và scripts hiện hành
 */
export { NovaSmartSessionState as NovaSmartSessionRuntime };

/**
 * Chuẩn hóa tên MCP tool từ mcp__novasmart__<tool> hoặc novasmart__<tool> về <tool> thuần
 */
export function stripMcpPrefix(toolName: string): string {
  if (toolName.includes('__')) {
    return toolName.split('__').pop() || toolName;
  }
  return toolName;
}

/**
 * Khởi tạo In-Process MCP Server chuẩn SDK chứa toàn bộ 10 canonical tools (Task 2.1 & 2.4)
 */
export function createNovaSmartMcpServer(): McpSdkServerConfigWithInstance {
  const tools = [
    tool(
      'search_product_catalog',
      'Search technical specifications, features, and list prices for NovaSmart smart home products. Do NOT use this tool to check stock or inventory availability at physical stores.',
      {
        query: z.string().optional().describe('Product name or keyword to search'),
        category: z.string().optional().describe('Product category'),
      },
      async (args) => {
        const result = await executeDomainTool('search_product_catalog', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'check_inventory',
      'Check real-time stock quantity for a specific SKU at physical stores or districts. Do NOT use this tool for product specifications or feature descriptions.',
      {
        sku: z.string().describe('Product SKU code (e.g. ROBO-X1)'),
        district: z.string().describe('Target district (e.g. Quận 1, Quận 7)'),
      },
      async (args) => {
        const result = await executeDomainTool('check_inventory', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'lookup_store_location',
      'Find official NovaSmart retail store address, contact telephone, and opening hours by city district.',
      {
        district: z.string().describe('Target district to find nearby stores'),
      },
      async (args) => {
        const result = await executeDomainTool('lookup_store_location', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'validate_promo',
      'Check validity, discount percentage, and minimum order threshold for promotional codes.',
      {
        code: z.string().describe('Promotional discount voucher code (e.g. TECH20)'),
      },
      async (args) => {
        const result = await executeDomainTool('validate_promo', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'get_customer',
      'Lookup customer profile records in CRM by full name or phone number. May return zero, one, or multiple matching profiles when names are ambiguous.',
      {
        name: z.string().optional().describe('Full customer name'),
        phone: z.string().optional().describe('Customer telephone number'),
      },
      async (args) => {
        const result = await executeDomainTool('get_customer', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'lookup_order',
      'Retrieve comprehensive order details from the ERP system by order ID. Returns raw backend transaction record with 62 fields.',
      {
        order_id: z.string().describe('The unique order identifier (e.g. ORD-8821)'),
      },
      async (args) => {
        const result = await executeDomainTool('lookup_order', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'get_return_policy',
      'Retrieve official company return, refund, inspection, and price-adjustment policies.',
      {
        topic: z
          .string()
          .optional()
          .describe('Specific topic to retrieve (e.g. refund, inspection, price_matching)'),
      },
      async (args) => {
        const result = await executeDomainTool('get_return_policy', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'create_warranty_ticket',
      'File a warranty service ticket for defective, damaged, or malfunctioning hardware products.',
      {
        order_id: z.string().describe('Order ID associated with the defective item'),
        issue_description: z
          .string()
          .describe('Detailed description of the hardware malfunction or damage'),
      },
      async (args) => {
        const result = await executeDomainTool('create_warranty_ticket', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'process_refund',
      'Execute automated customer refund to original payment method. Subject to prerequisite identity verification, product return inspection approval, and maximum automatic refund threshold ($500).',
      {
        order_id: z.string().describe('Order ID to be refunded'),
        amount: z.number().describe('Refund amount in USD'),
        reason: z.string().describe('Business reason for the refund'),
      },
      async (args) => {
        const result = await executeDomainTool('process_refund', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
    tool(
      'escalate_to_human',
      'Escalate the session to a human support supervisor with a structured handoff summary when policy thresholds are exceeded, policy gaps occur, or when customer explicitly demands a human.',
      {
        customer_id: z
          .string()
          .describe('Customer identifier (or UNKNOWN if not identified)'),
        root_cause: z.string().describe('Summary of the underlying customer issue'),
        refund_amount_requested: z
          .number()
          .describe('Amount of refund requested in USD'),
        recommended_action: z
          .string()
          .describe('Suggested resolution action for the human agent'),
        trigger_reason: z
          .enum([
            'customer_requested_human',
            'policy_gap',
            'policy_threshold_exceeded',
          ])
          .describe('The architectural trigger that necessitated escalation'),
      },
      async (args) => {
        const result = await executeDomainTool('escalate_to_human', args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.isError ? result : result.data),
            },
          ],
          isError: result.isError,
        };
      }
    ),
  ];

  return createSdkMcpServer({
    name: 'novasmart',
    version: '1.0.0',
    tools,
  });
}

/**
 * Đăng ký native lifecycle hooks cho Claude Agent SDK (Task 1.4, 1.5, 5.1)
 */
export function createNovaSmartSdkHooks(
  state: NovaSmartSessionState
): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return {
    PreToolUse: [
      {
        matcher: 'mcp__novasmart__*',
        hooks: [
          async (input: HookInput): Promise<SyncHookJSONOutput> => {
            const preInput = input as PreToolUseHookInput;
            const normalizedToolName = stripMcpPrefix(preInput.tool_name);
            const toolInput = (preInput.tool_input ?? {}) as Record<
              string,
              unknown
            >;

            // 1. Kiểm tra PrerequisiteGate (Task 1.4)
            const gateDecision = state.gate.checkPreToolUse(
              normalizedToolName,
              toolInput
            );
            if (!gateDecision.allowed && gateDecision.errorResult) {
              return {
                decision: 'block',
                reason: gateDecision.errorResult.message,
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: JSON.stringify(
                    gateDecision.errorResult
                  ),
                },
              };
            }

            // 2. Kiểm tra ComplianceGuard (Task 1.5)
            const guardDecision = state.guard.checkPreToolUse(
              normalizedToolName,
              toolInput
            );
            if (!guardDecision.allowed && guardDecision.errorResult) {
              return {
                decision: 'block',
                reason: guardDecision.errorResult.message,
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: JSON.stringify(
                    guardDecision.errorResult
                  ),
                },
              };
            }

            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'allow',
              },
            };
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: 'mcp__novasmart__*',
        hooks: [
          async (input: HookInput): Promise<SyncHookJSONOutput> => {
            const postInput = input as PostToolUseHookInput;
            const normalizedToolName = stripMcpPrefix(postInput.tool_name);
            const rawResponse = postInput.tool_response;

            // Phân giải kết quả trả về từ tool (StructuredToolResult hoặc CallToolResult)
            let structuredResult: StructuredToolResult<unknown>;

            if (
              rawResponse &&
              typeof rawResponse === 'object' &&
              'isError' in rawResponse &&
              'data' in rawResponse
            ) {
              structuredResult = rawResponse as StructuredToolResult<unknown>;
            } else if (
              rawResponse &&
              typeof rawResponse === 'object' &&
              'content' in rawResponse
            ) {
              const mcpResult = rawResponse as {
                content?: Array<{ type: string; text?: string }>;
                isError?: boolean;
              };
              const textContent = mcpResult.content?.find(
                (c) => c.type === 'text'
              )?.text;
              try {
                const parsed = textContent ? JSON.parse(textContent) : {};
                if (
                  typeof parsed === 'object' &&
                  parsed !== null &&
                  'isError' in parsed
                ) {
                  structuredResult = parsed;
                } else if (mcpResult.isError) {
                  structuredResult = {
                    isError: true,
                    errorCategory: 'transient',
                    isRetryable: false,
                    message: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
                  };
                } else {
                  structuredResult = {
                    isError: false,
                    data: parsed,
                  };
                }
              } catch {
                if (mcpResult.isError) {
                  structuredResult = {
                    isError: true,
                    errorCategory: 'transient',
                    isRetryable: false,
                    message: textContent ?? 'Unknown tool error',
                  };
                } else {
                  structuredResult = {
                    isError: false,
                    data: textContent,
                  };
                }
              }
            } else {
              structuredResult = { isError: false, data: rawResponse };
            }

            // 1. Cắt gọt và chuẩn hóa dữ liệu ERP (Task 1.5 & 5.1)
            const trimmedResult = normalizeAndTrimToolResult(
              normalizedToolName,
              structuredResult
            );

            // 2. Nuôi dưỡng trạng thái Gate và trích xuất Case Facts (Task 1.4 & 5.1)
            state.gate.recordToolResult(normalizedToolName, structuredResult);
            state.caseFacts.ingestToolResult(
              normalizedToolName,
              trimmedResult
            );

            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'PostToolUse',
                updatedToolOutput: trimmedResult,
                additionalContext: state.caseFacts.renderCaseFactsBlock(),
              },
            };
          },
        ],
      },
    ],
  };
}

/**
 * Trình trợ giúp kiểm thử PreToolUse hook mà không cần chạy toàn bộ Agent loop
 */
export async function invokePreToolUseHook(
  hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<SyncHookJSONOutput> {
  const matchers = hooks.PreToolUse ?? [];
  for (const matcher of matchers) {
    for (const hook of matcher.hooks) {
      const input: PreToolUseHookInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'test_session',
        transcript_path: '/tmp/test_transcript',
        cwd: process.cwd(),
        tool_name: toolName,
        tool_input: toolInput,
        tool_use_id: `tu_test_${Date.now()}`,
      };
      const result = await hook(input as HookInput, input.tool_use_id, {
        signal: new AbortController().signal,
      });
      const syncResult = result as SyncHookJSONOutput;
      if (
        syncResult.decision === 'block' ||
        (syncResult.hookSpecificOutput?.hookEventName === 'PreToolUse' &&
          syncResult.hookSpecificOutput.permissionDecision === 'deny')
      ) {
        return syncResult;
      }
    }
  }
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  };
}

/**
 * Trình trợ giúp kiểm thử PostToolUse hook mà không cần chạy toàn bộ Agent loop
 */
export async function invokePostToolUseHook(
  hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResponse: unknown
): Promise<SyncHookJSONOutput> {
  const matchers = hooks.PostToolUse ?? [];
  for (const matcher of matchers) {
    for (const hook of matcher.hooks) {
      const input: PostToolUseHookInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'test_session',
        transcript_path: '/tmp/test_transcript',
        cwd: process.cwd(),
        tool_name: toolName,
        tool_input: toolInput,
        tool_response: toolResponse,
        tool_use_id: `tu_test_${Date.now()}`,
      };
      const result = await hook(input as HookInput, input.tool_use_id, {
        signal: new AbortController().signal,
      });
      return result as SyncHookJSONOutput;
    }
  }
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
    },
  };
}

/**
 * Tham số tùy chọn để xây dựng Options cho Claude Agent SDK (query())
 */
export interface BuildSdkOptionsParams {
  model?: string;
  baseSystemPrompt?: string;
  maxTurns?: number;
  sessionId?: string;
}

/**
 * Hàm factory chuẩn hóa tạo đối tượng Options cho Claude Agent SDK query()
 *
 * Nhiệm vụ kiến trúc (Architectural role):
 * - Kết hợp In-Process MCP Server (10 tools) và Native Hooks (PreToolUse/PostToolUse).
 * - Gắn Session State (PrerequisiteGate, ComplianceGuard, CaseFactsManager) vào vòng đời Hook.
 * - Trả về Options object duy nhất tương thích với hàm query({ prompt, options }).
 */
export function buildNovaSmartAgentSdkOptions(
  state: NovaSmartSessionState,
  params: BuildSdkOptionsParams = {}
): Options {
  const mcpServer = createNovaSmartMcpServer();
  const hooks = createNovaSmartSdkHooks(state);

  const sdkOptions: Options = {
    model: resolveModelName(params.model),
    maxTurns: params.maxTurns ?? 10,
    mcpServers: {
      novasmart: mcpServer,
    },
    hooks,
    allowedTools: ['mcp__novasmart__*'],
    permissionMode: 'default',
    systemPrompt: params.baseSystemPrompt ?? state.baseSystemPrompt,
    persistSession: false,
  };

  if (params.sessionId) {
    sdkOptions.resume = params.sessionId;
  }

  return sdkOptions;
}

/**
 * Cấu hình khởi tạo cho Adapter AgentSdkSupportAgent
 */
export interface AgentSdkAdapterConfig {
  client?: AnthropicClientLike;
  model?: string;
  baseSystemPrompt?: string;
  maxAutoRefundAmount?: number;
  maxTurns?: number;
  maxIterations?: number; // Hỗ trợ tương thích ngược với CLI & Story Runner
  debug?: boolean;
}

/**
 * Backward compatibility alias cho các script/test hiện hành
 */
export type AgentSdkSupportAgentOptions = AgentSdkAdapterConfig;

/**
 * Adapter Support Agent chạy theo chuẩn Claude Agent SDK Native Hooks & MCP Pipeline
 * Tận dụng toàn bộ Harness có sẵn của hàm query() từ @anthropic-ai/claude-agent-sdk.
 */
export class AgentSdkSupportAgent {
  private readonly model: string;
  private readonly baseSystemPrompt: string;
  private readonly maxTurns: number;
  private debug: boolean;
  private sessionId?: string;
  private readonly state: NovaSmartSessionState;
  private messages: Anthropic.MessageParam[] = [];
  private sessionToolsExecuted: string[] = [];
  private sessionBlockedTools: string[] = [];
  private lastHandoffSummary?: HandoffSummary;

  constructor(config: AgentSdkAdapterConfig = {}) {
    this.model = resolveModelName(config.model);
    this.baseSystemPrompt =
      config.baseSystemPrompt ?? buildCustomerSupportSystemPrompt();
    this.maxTurns = config.maxTurns ?? config.maxIterations ?? 10;
    this.debug = config.debug ?? process.env['DEBUG_LOOP'] === '1';

    this.state = new NovaSmartSessionState({
      maxAutoRefundAmount: config.maxAutoRefundAmount,
      baseSystemPrompt: this.baseSystemPrompt,
    });
  }

  public getAdapterName(): string {
    return 'Claude Agent SDK (Part B - Native Hooks & In-Process MCP)';
  }

  public getModel(): string {
    return this.model;
  }

  public setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  public isDebug(): boolean {
    return this.debug;
  }

  public getInspector(): SessionInspector {
    return new SessionInspector({
      messages: this.messages,
      gate: this.state.gate,
      guard: this.state.guard,
      caseFacts: this.state.caseFacts,
      toolsExecuted: this.sessionToolsExecuted,
      blockedTools: this.sessionBlockedTools,
      handoffSummary: this.lastHandoffSummary,
    });
  }

  public getGate(): PrerequisiteGate {
    return this.state.gate;
  }

  public getGuard(): ComplianceGuard {
    return this.state.guard;
  }

  public getCaseFacts(): CaseFactsManager {
    return this.state.caseFacts;
  }

  public getState(): NovaSmartSessionState {
    return this.state;
  }

  public getMessagesHistory(): Anthropic.MessageParam[] {
    return this.messages;
  }

  public reset(): void {
    this.state.reset();
    this.sessionId = undefined;
    this.messages = [];
    this.sessionToolsExecuted = [];
    this.sessionBlockedTools = [];
    this.lastHandoffSummary = undefined;
  }

  /**
   * Chạy lượt hội thoại hoàn toàn qua Claude Agent SDK Harness (query())
   *
   * Khác biệt cốt lõi với Messages API (Part A):
   * - KHÔNG có vòng lặp while (stop_reason === 'tool_use') thủ công.
   * - KHÔNG tự gọi messages.create().
   * - Toàn bộ vòng lặp, việc phân phối In-Process MCP tools và kích hoạt
   *   PreToolUse (permissionDecision: 'deny') / PostToolUse (updatedToolOutput)
   *   đều do Harness của hàm query() tự động quản lý ngầm.
   */
  public async runTurn(userInput: string): Promise<AgentTurnResult> {
    this.messages.push({ role: 'user', content: userInput });

    const textBlocks: string[] = [];
    const toolCallsExecuted: string[] = [];
    const blockedToolCalls: string[] = [];
    let iterations = 1;
    let escalated = false;
    let handoffSummary: HandoffSummary | undefined;

    // Chuẩn bị SDK Options chuẩn tắc từ factory function
    const sdkOptions = buildNovaSmartAgentSdkOptions(this.state, {
      model: this.model,
      baseSystemPrompt: this.baseSystemPrompt,
      maxTurns: this.maxTurns,
      sessionId: this.sessionId,
    });

    // ── GIAO TOÀN QUYỀN ĐIỀU PHỐI VÒNG LẶP CHO CLAUDE AGENT SDK HARNESS ──
    const stream = query({
      prompt: userInput,
      options: sdkOptions,
    });

    for await (const message of stream) {
      if (message.type === 'system' && message.subtype === 'init') {
        this.sessionId = message.session_id;
        if (this.debug) {
          console.log(
            `\n  \x1b[35m[Agent SDK Harness Init]\x1b[0m Session: ${message.session_id} | Model: ${message.model}`
          );
        }
      }

      if (message.type === 'assistant') {
        const assistantBlocks = message.message.content;
        for (const block of assistantBlocks) {
          if (block.type === 'text' && block.text.trim()) {
            textBlocks.push(block.text.trim());
          } else if (block.type === 'tool_use') {
            const cleanName = stripMcpPrefix(block.name);
            toolCallsExecuted.push(cleanName);
            this.sessionToolsExecuted.push(cleanName);
            if (this.debug) {
              console.log(
                `    \x1b[36m→ [SDK Harness Dispatched Tool]\x1b[0m ${block.name}`
              );
            }
          }
        }
      }

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          iterations = message.num_turns;
          if (message.permission_denials?.length) {
            for (const denial of message.permission_denials) {
              const cleanName = stripMcpPrefix(denial.tool_name);
              blockedToolCalls.push(cleanName);
              this.sessionBlockedTools.push(cleanName);
            }
          }
        }
      }
    }

    const finalText = textBlocks.join('\n\n');
    this.messages.push({ role: 'assistant', content: finalText });

    // Kiểm tra trạng thái Escalation từ CaseFacts hoặc HandOff
    if (this.sessionToolsExecuted.includes('escalate_to_human')) {
      escalated = true;
      handoffSummary = {
        handoff_id: `HDF-${Date.now()}`,
        timestamp_iso: new Date().toISOString(),
        customer_id: this.state.gate.getVerifiedCustomerId() ?? 'UNKNOWN',
        trigger_reason: 'policy_gap',
        root_cause: 'Chuyển giao chuyên viên xử lý qua Agent SDK',
        refund_amount_requested: 0,
        recommended_action: 'Xem xét và tiếp quản phiên hỗ trợ',
      };
    }

    return {
      text: finalText,
      iterations,
      toolCallsExecuted,
      blockedToolCalls,
      escalated,
      handoffSummary,
    };
  }
}

