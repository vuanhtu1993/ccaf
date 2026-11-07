/**
 * Compliance Guard (Tool Call Interception Hook)
 *
 * Triển khai theo Task Statement 1.5 của đề thi CCA-F:
 * - "Implementing tool call interception hooks that block policy-violating actions
 *   (e.g., refunds exceeding $500) and redirect to alternative workflows (e.g., human escalation)"
 * - "Choosing hooks over prompt-based enforcement when business rules require guaranteed compliance"
 * - Tính tất định 100%: Dù System Prompt có bị jailbreak hay injection,
 *   Code Hook tại runtime vẫn chặn đứng giao dịch tài chính vượt hạn mức.
 *
 * Made by Anh Tu - Share to be share
 */

import type { PreToolDecision } from './prerequisite-gate.js';

export interface ComplianceGuardOptions {
  maxAutoRefundAmount?: number;
}

export class ComplianceGuard {
  private readonly maxAutoRefundAmount: number;

  constructor(options: ComplianceGuardOptions = {}) {
    this.maxAutoRefundAmount = options.maxAutoRefundAmount ?? 500;
  }

  public checkPreToolUse(
    toolName: string,
    input: Record<string, unknown>
  ): PreToolDecision {
    if (toolName === 'process_refund') {
      const amount = Number(input['amount'] ?? 0);

      // Chặn cứng runtime mọi khoản hoàn tiền vượt hạn mức $500 (Task 1.5 L388)
      if (amount > this.maxAutoRefundAmount) {
        return {
          allowed: false,
          errorResult: {
            isError: true,
            errorCategory: 'business',
            isRetryable: false,
            message: `Compliance violation: Refund amount of $${amount} exceeds the automated maximum authorization limit of $${this.maxAutoRefundAmount}. This operation cannot be completed autonomously and must be redirected to a human supervisor for manual approval.`,
            suggestedAction: 'escalate_to_human',
          },
        };
      }
    }

    return { allowed: true };
  }

  public getMaxLimit(): number {
    return this.maxAutoRefundAmount;
  }
}

