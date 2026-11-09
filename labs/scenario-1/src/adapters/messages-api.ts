/**
 * Adapter Part A: Vòng lặp Agentic thuần Claude Messages API (@anthropic-ai/sdk)
 *
 * Triển khai theo Task Statement 1.1, 1.4, 1.5, 5.1 & 5.2 của đề thi CCA-F:
 * - Task 1.1: Tự tay hiện thực hóa vòng lặp điều phối:
 *     while (response.stop_reason === 'tool_use')
 *   và kết thúc khi response.stop_reason === 'end_turn'.
 * - Task 1.1 & 1.4: Gom toàn bộ kết quả của các tool được gọi song song
 *   vào CÙNG MỘT message của user (Tool Result Block Array).
 * - Task 1.4 & 1.5: Đặt các chốt chặn PrerequisiteGate và ComplianceGuard
 *   ngay trước khi thực thi tool (PreToolUse Interception).
 * - Task 1.5 & 5.1: Cắt gọt và chuẩn hóa dữ liệu qua normalizeAndTrimToolResult
 *   trước khi đưa vào lịch sử hội thoại, đồng thời neo giữ CaseFacts vào prompt.
 *
 * Made by Anh Tu - Share to be share
 */

import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, executeDomainTool } from '../domain/tools.js';
import { PrerequisiteGate } from '../domain/prerequisite-gate.js';
import { ComplianceGuard } from '../domain/compliance-guard.js';
import { normalizeAndTrimToolResult } from '../domain/context-trimmer.js';
import { CaseFactsManager } from '../domain/case-facts.js';
import { buildCustomerSupportSystemPrompt } from '../domain/system-prompt.js';
import type { HandoffSummary } from '../domain/types.js';

export interface MockContentBlockText {
  type: 'text';
  text: string;
  citations?: Anthropic.TextCitation[] | null;
}

export interface MockContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export type MockContentBlock = MockContentBlockText | MockContentBlockToolUse;

export interface MockMessageScript {
  stop_reason?: Anthropic.Message['stop_reason'];
  content?: MockContentBlock[];
}

export interface AnthropicClientLike {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming
    ): Promise<Anthropic.Message>;
  };
}

/**
 * Scripted Mock Client cho phép kiểm thử kịch bản đa lượt (Multi-turn Scripted Testing)
 * 100% offline mà không cần API Key thật (Task 1.1 Kata)
 */
export class ScriptedMockAnthropicClient implements AnthropicClientLike {
  private scriptQueue: MockMessageScript[];

  constructor(script: MockMessageScript[]) {
    this.scriptQueue = [...script];
  }

  public async create(
    _options: Anthropic.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Message> {
    const nextResponse = this.scriptQueue.shift();
    if (!nextResponse) {
      throw new Error('ScriptedMockAnthropicClient: Hết kịch bản mock phản hồi.');
    }

    const normalizedContent: Anthropic.ContentBlock[] = (nextResponse.content ?? []).map((b) => {
      if (b.type === 'text') {
        return {
          type: 'text',
          text: b.text,
          citations: b.citations ?? null,
        };
      }
      return b as Anthropic.ContentBlock;
    });

    const defaultMsg: Anthropic.Message = {
      id: `msg_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'message',
      role: 'assistant',
      content: normalizedContent,
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: nextResponse.stop_reason ?? 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 50,
        output_tokens: 50,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    };

    return defaultMsg;
  }

  public get messages() {
    return {
      create: this.create.bind(this),
    };
  }
}

export interface MessagesApiSupportAgentOptions {
  client?: AnthropicClientLike;
  model?: string;
  baseSystemPrompt?: string;
  maxAutoRefundAmount?: number;
  maxIterations?: number;
}

export interface AgentTurnResult {
  text: string;
  iterations: number;
  toolCallsExecuted: string[];
  blockedToolCalls: string[];
  escalated: boolean;
  handoffSummary?: HandoffSummary;
}

export class MessagesApiSupportAgent {
  private readonly client: AnthropicClientLike;
  private readonly model: string;
  private readonly baseSystemPrompt: string;
  private readonly maxIterations: number;

  private readonly gate: PrerequisiteGate;
  private readonly guard: ComplianceGuard;
  private readonly caseFacts: CaseFactsManager;
  private messages: Anthropic.MessageParam[] = [];

  constructor(options: MessagesApiSupportAgentOptions = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? 'claude-3-5-sonnet-20241022';
    this.baseSystemPrompt =
      options.baseSystemPrompt ?? buildCustomerSupportSystemPrompt();
    this.maxIterations = options.maxIterations ?? 10; // Secondary safety cap

    this.gate = new PrerequisiteGate();
    this.guard = new ComplianceGuard({
      maxAutoRefundAmount: options.maxAutoRefundAmount ?? 500,
    });
    this.caseFacts = new CaseFactsManager();
  }

  /**
   * Vòng lặp Agentic Loop được viết thủ công (Task 1.1)
   */
  public async runTurn(userInput: string): Promise<AgentTurnResult> {
    this.messages.push({ role: 'user', content: userInput });

    let iterations = 0;
    let escalated = false;
    let handoffSummary: HandoffSummary | undefined;
    const toolCallsExecuted: string[] = [];
    const blockedToolCalls: string[] = [];
    let finalText = '';

    while (iterations < this.maxIterations) {
      iterations++;

      // 1. Tiêm khối <case_facts> vào System Prompt ở mỗi lượt (Task 5.1)
      const fullSystemPrompt = this.caseFacts.injectIntoSystemPrompt(
        this.baseSystemPrompt
      );

      // 2. Gửi request tới Claude API
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: fullSystemPrompt,
        tools: TOOL_DEFINITIONS as Anthropic.ToolUnion[],
        messages: this.messages,
      });

      // 3. Nối phản hồi của Assistant vào lịch sử hội thoại
      this.messages.push({ role: 'assistant', content: response.content });

      // 4. Kiểm tra stop_reason (Task 1.1 Core Pattern)
      if (response.stop_reason === 'end_turn') {
        finalText = this.extractTextFromContent(response.content);
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

        // Duyệt qua tất cả các tool được Claude yêu cầu gọi trong lượt này
        for (const block of toolUseBlocks) {
          toolCallsExecuted.push(block.name);
          const toolInput = block.input as Record<string, unknown>;

          // A. Chốt chặn Prerequisite Gate & Compliance Guard (Task 1.4 & 1.5)
          const gateDecision = this.gate.checkPreToolUse(block.name, toolInput);
          const guardDecision = this.guard.checkPreToolUse(block.name, toolInput);

          const failedDecision = !gateDecision.allowed
            ? gateDecision
            : !guardDecision.allowed
              ? guardDecision
              : null;

          if (failedDecision && failedDecision.errorResult) {
            blockedToolCalls.push(block.name);
            toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: block.id,
              is_error: true,
              content: JSON.stringify(failedDecision.errorResult),
            });
            continue;
          }

          // B. Thực thi tool nghiệp vụ (Task 2.1)
          const rawResult = await executeDomainTool(block.name, toolInput);

          // C. Nuôi dưỡng trạng thái cho Gate và trích xuất Case Facts (Task 1.4 & 5.1)
          this.gate.recordToolResult(block.name, rawResult);
          this.caseFacts.ingestToolResult(block.name, rawResult);

          // D. Nhận diện kích hoạt Escalation (Task 5.2)
          if (block.name === 'escalate_to_human' && !rawResult.isError) {
            escalated = true;
            handoffSummary = rawResult.data as HandoffSummary;
          }

          // E. PostToolUse Trimmer & Normalizer (Task 1.5 & 5.1)
          const trimmedResult = normalizeAndTrimToolResult(block.name, rawResult);

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(
              trimmedResult.isError ? trimmedResult : trimmedResult.data
            ),
          });
        }

        // F. GOM TẤT CẢ KẾT QUẢ TOOL VÀO 1 USER MESSAGE DUY NHẤT (Task 1.1 L234-250)
        this.messages.push({
          role: 'user',
          content: toolResultBlocks,
        });

        // Tiếp tục vòng lặp sang lượt tiếp theo để Claude đọc tool results
        continue;
      }

      // Xử lý các stop_reason khác (như max_tokens)
      finalText = this.extractTextFromContent(response.content);
      break;
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

  private extractTextFromContent(content: Anthropic.ContentBlock[]): string {
    return content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  public getMessagesHistory(): Anthropic.MessageParam[] {
    return this.messages;
  }

  public getGate(): PrerequisiteGate {
    return this.gate;
  }

  public getGuard(): ComplianceGuard {
    return this.guard;
  }

  public getCaseFacts(): CaseFactsManager {
    return this.caseFacts;
  }
}
