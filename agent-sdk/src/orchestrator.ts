/**
 * Orchestrator chạy trên Agent SDK.
 *
 * Đây là tầng 2 của sơ đồ: agent loop có sẵn, ta chỉ cấu hình.
 * Năm thứ được minh hoạ trong một file, mỗi thứ là một "concept card" sống:
 *
 *   1. query()          -> agent loop đóng gói sẵn
 *   2. agents           -> subagent lập trình được (Record<string, AgentDefinition>)
 *   3. hooks            -> callback TypeScript thay cho shell command
 *   4. mcpServers       -> dùng lại chính MCP server stdio của repo
 *   5. settingSources   -> quyết định file cấu hình nào được nạp
 *   +  createSdkMcpServer/tool -> MCP server trong cùng tiến trình
 *
 * Chạy:
 *   npm --prefix agent-sdk run start            # hỏi tự do
 *   npm --prefix agent-sdk run start:study      # buổi học
 *   npm --prefix agent-sdk run start:exam       # đề thi thử
 *
 * Cần ANTHROPIC_API_KEY trong môi trường hoặc trong ../.env
 */

import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type {
  AgentDefinition,
  HookCallbackMatcher,
  Options,
  SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** agent-sdk/dist -> agent-sdk -> repo root */
const REPO_ROOT = path.resolve(here, '..', '..');
const MCP_SERVER_ENTRY = path.join(REPO_ROOT, 'mcp-server', 'dist', 'index.js');

/** Một tầng trong sơ đồ — cũng là nhãn dùng trong thông báo lỗi. */
type Mode = 'free' | 'study' | 'exam';

/**
 * Nhận diện nguồn xác thực đang dùng.
 *
 * Trả về `null` khi không thấy biến môi trường nào — nhưng điều đó KHÔNG có
 * nghĩa là không xác thực được: credential có thể đã nằm trong keychain từ
 * `/login`, và ta không đọc được keychain. Vì vậy hàm này chỉ dùng để *hiển thị*,
 * không bao giờ dùng để chặn. CLI là nguồn chân lý cuối cùng.
 */
function detectCredential(): string | null {
  const env = process.env;

  // Lưu ý: ANTHROPIC_API_KEY khi có mặt sẽ GHI ĐÈ subscription đã /login.
  if (env['ANTHROPIC_API_KEY']) return 'ANTHROPIC_API_KEY (tính tiền theo token)';
  if (env['CLAUDE_CODE_OAUTH_TOKEN']) return 'CLAUDE_CODE_OAUTH_TOKEN (subscription)';
  if (env['CLAUDE_CODE_USE_BEDROCK']) return 'Amazon Bedrock';
  if (env['CLAUDE_CODE_USE_VERTEX']) return 'Google Vertex AI';
  return null;
}

function printAuthGuidance(): void {
  console.error('Không thấy thông tin xác thực trong biến môi trường.\n');
  console.error('Claude Code nhận MỘT trong các nguồn sau:\n');
  console.error('  1. /login                   đăng nhập claude.ai');
  console.error('                              (cần Pro / Max / Team / Enterprise)');
  console.error('  2. CLAUDE_CODE_OAUTH_TOKEN  token 1 năm, tạo bằng `claude setup-token`');
  console.error('                              (cũng cần Pro / Max / Team / Enterprise)');
  console.error('  3. ANTHROPIC_API_KEY        key từ Console, trả theo token');
  console.error('                              (KHÔNG cần subscription — nạp credit là dùng được)');
  console.error('  4. Bedrock / Vertex         qua CLAUDE_CODE_USE_BEDROCK / _VERTEX\n');
  console.error('Đặt key trong .env (đã gitignore) dạng: ANTHROPIC_API_KEY=sk-ant-...\n');
  console.error('Không cần credit để học: npm run check  (44 check offline)');
}

/**
 * Dịch lỗi thô của CLI thành gợi ý hành động.
 *
 * Ba lỗi dưới đây trông rất khác nhau nhưng người dùng thường không phân biệt
 * được "key sai" với "key đúng nhưng hết tiền" — nên nói rõ từng trường hợp.
 */
function authHintFor(rawText: string): string | null {
  const text = rawText.toLowerCase();

  if (text.includes('credit balance is too low') || text.includes('purchase credits')) {
    return 'Key hợp lệ nhưng tài khoản CHƯA CÓ CREDIT. Vào Console → Plans & Billing → Purchase credits.';
  }
  if (text.includes('invalid api key') || text.includes('invalid x-api-key')) {
    return 'Key sai hoặc đã bị thu hồi. Kiểm tra lại giá trị trong .env (không có dấu nháy, không khoảng trắng).';
  }
  if (text.includes('not logged in') || text.includes('please run /login')) {
    return 'Chưa xác thực. Chạy `claude /login`, hoặc đặt ANTHROPIC_API_KEY trong .env.';
  }
  if (text.includes('rate_limit') || text.includes('429')) {
    return 'Bị giới hạn tần suất. Chờ một lát rồi chạy lại.';
  }
  if (text.includes('model') && text.includes('not found')) {
    return 'Model trong options không khả dụng với tài khoản này. Thử đổi `model` trong buildOptions().';
  }
  return null;
}


function readMode(): Mode {
  const arg = process.argv[2];
  if (arg === 'study' || arg === 'exam') return arg;
  return 'free';
}

// ── 1. Subagent: AgentDefinition bắt buộc có description + prompt ───────

const AGENTS: Record<string, AgentDefinition> = {
  'layer-cartographer': {
    description:
      'Maps any Claude capability across the four layers (API, Agent SDK, Claude Code, MCP) with concrete file paths. Use before teaching a concept so the answer cites real files.',
    prompt: [
      'You are a read-only cartographer for a Claude architecture study repo.',
      'For the requested capability, produce exactly four blocks: Claude API, Agent SDK, Claude Code, MCP.',
      'For each block give the mechanism (what you write vs what is provided) and ONE real file path',
      'from this repo that demonstrates it. Verify each path exists before citing it.',
      'If a layer does not apply, write "khong ap dung" and one sentence of why.',
      'Reply in Vietnamese. Never edit files.',
    ].join('\n'),
    tools: ['Read', 'Grep', 'Glob'],
    // Preload skill để agent có sẵn quy trình, không phải tự khám phá.
    skills: ['daily-study'],
    maxTurns: 5,
  },
};

// ── 2. Hook callback: cùng event với CLI, khác cơ chế ───────────────────

const pretoolGuard: HookCallbackMatcher = {
  matcher: 'Bash',
  hooks: [
    async (input) => {
      if (input.hook_event_name !== 'PreToolUse') return {};
      const raw = input.tool_input;
      const command =
        typeof raw === 'object' && raw !== null
          ? String((raw as Record<string, unknown>)['command'] ?? '')
          : '';

      if (/(^|\s)rm\s+-rf\s+(\/|~)/.test(command) || /git\s+push\s+(--force|-f)\b/.test(command)) {
        // Ở SDK, "block" là tương đương exit 2 ở CLI.
        return {
          decision: 'block',
          reason: `Hook SDK chặn lệnh nguy hiểm: ${command}`,
        };
      }
      return {};
    },
  ],
};

const lifecycleLogger: HookCallbackMatcher = {
  hooks: [
    async (input) => {
      if (input.hook_event_name === 'SessionStart') {
        console.error(`[hook] session bắt đầu: ${input.session_id}`);
      }
      if (input.hook_event_name === 'SubagentStop') {
        console.error('[hook] một subagent vừa xong');
      }
      return {};
    },
  ],
};

// ── 3. MCP trong cùng tiến trình: tool viết bằng TypeScript ─────────────

const repoMapServer = createSdkMcpServer({
  name: 'repo-map',
  version: '0.1.0',
  instructions: 'Truy vấn cấu trúc repo CCA-F: tầng nào đang nằm ở file nào.',
  tools: [
    tool(
      'where_is_layer',
      'Trả về đường dẫn thật trong repo chứa cấu hình của một tầng kiến trúc.',
      { layer: z.enum(['api', 'agent-sdk', 'claude-code', 'mcp']) },
      async ({ layer }) => {
        const map: Record<string, string[]> = {
          api: ['docs/architecture.md'],
          'agent-sdk': ['agent-sdk/src/orchestrator.ts', 'agent-sdk/package.json'],
          'claude-code': [
            'CLAUDE.md',
            '.claude/settings.json',
            '.claude/rules/architecture.md',
            '.claude/skills/daily-study/SKILL.md',
            '.claude/hooks/guard-dangerous.sh',
            '.claude/agents/architecture-reviewer.md',
          ],
          mcp: ['.mcp.json', 'mcp-server/src/index.ts', 'mcp-server/package.json'],
        };
        const files = map[layer] ?? [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ layer, files, count: files.length }, null, 2),
            },
          ],
        };
      },
      { annotations: { readOnlyHint: true } }
    ),
  ],
});

// ── 4. Options: nơi mọi thứ hội tụ ──────────────────────────────────────

function buildOptions(mode: Mode): Options {
  return {
    // Nạp cấu hình từ repo. Bỏ 'project' thì .claude/skills, .claude/rules
    // và .claude/agents biến mất khỏi phiên — đây là điểm thi hay hỏi.
    settingSources: ['user', 'project'],

    // Không mở rộng allowedTools: chỉ pre-approve đúng thứ cần.
    allowedTools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__cca-coach__*', 'mcp__repo-map__*'],
    disallowedTools: ['Write', 'Edit', 'NotebookEdit'],

    permissionMode: 'default',
    // Model đổi được qua biến môi trường để so sánh chi phí mà không sửa code.
    // Mặc định 'sonnet': hợp với việc suy luận kiến trúc. Dùng 'haiku' khi chỉ
    // cần tra cứu/ôn tập — nhưng đọc docs/pricing trước: Haiku 5.5 có bậc giá
    // tăng 5x khi prompt vượt 100k token.
    model: process.env['ANTHROPIC_MODEL'] ?? process.env['CCA_MODEL'] ?? 'haiku',
    maxTurns: 25,

    // Hai loại MCP server trong cùng một phiên: stdio (process riêng)
    // và in-process (createSdkMcpServer).
    mcpServers: {
      'cca-coach': {
        type: 'stdio',
        command: process.execPath,
        args: [MCP_SERVER_ENTRY],
      },
      'repo-map': repoMapServer,
    },

    agents: AGENTS,

    hooks: {
      PreToolUse: [pretoolGuard],
      SessionStart: [lifecycleLogger],
      SubagentStop: [lifecycleLogger],
    },

    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: [
        'Bạn đang chạy như orchestrator của repo học CCA-F.',
        'Luôn phân biệt rõ 4 tầng: Claude API, Agent SDK, Claude Code, MCP.',
        'Với mỗi khái niệm, chỉ ra file thật trong repo minh hoạ nó.',
        'Dùng MCP tool cca-coach cho nội dung ôn thi, không tự bịa câu hỏi.',
        `Mode hiện tại: ${mode}.`,
      ].join('\n'),
    },
  };
}

function promptFor(mode: Mode): string {
  if (mode === 'study') {
    return [
      'Chạy một buổi học 45 phút.',
      '1. Gọi mcp__cca-coach__list_concepts để xem repo có gì, tóm tắt 4 tầng.',
      '2. Giao cho subagent layer-cartographer việc map 1 concept sang 4 tầng.',
      '3. Gọi mcp__cca-coach__generate_quiz với count 5, tự trả lời, chấm bằng grade_answer.',
      '4. Kết luận: concept nào đã hiểu, concept nào cần học lại.',
    ].join('\n');
  }
  if (mode === 'exam') {
    return [
      'Chạy đề thi thử 12 câu.',
      'Gọi mcp__cca-coach__generate_quiz với count 12 và balanced true.',
      'Hiển thị từng câu một, tự trả lời từng câu, rồi gọi grade_answer cho từng câu.',
      'Cuối cùng gọi score_report và in báo cáo theo domain.',
    ].join('\n');
  }
  return [
    'Giải thích sự khác nhau giữa 4 tầng trong repo này.',
    'Dùng mcp__repo-map__where_is_layer cho từng tầng để lấy đường dẫn thật,',
    'và dùng mcp__cca-coach__list_concepts để lấy concept tương ứng.',
  ].join('\n');
}

// ── 5. Vòng lặp xử lý message ───────────────────────────────────────────

/**
 * Cờ chống báo lỗi hai lần: `query()` vừa yield một result message lỗi,
 * vừa throw sau đó. Không có cờ này, người dùng thấy cùng một lỗi in 2 lần.
 */
let errorReported = false;

function reportError(text: string): void {
  if (errorReported) return;
  errorReported = true;
  console.error(`✗ lỗi: ${text}`);
  const hint = authHintFor(text);
  if (hint) console.error(`  → ${hint}`);
  process.exitCode = 1;
}

function printMessage(message: SDKMessage): void {
  switch (message.type) {
    case 'system': {
      if (message.subtype === 'init') {
        console.log(`▸ phiên ${message.session_id}`);
        console.log(`  model: ${message.model}`);
        console.log(`  tools: ${message.tools.length}`);
        console.log(`  agents: ${message.agents?.join(', ') || '(không có)'}`);
        console.log(
          `  mcp: ${message.mcp_servers.map((server) => `${server.name}:${server.status}`).join(', ')}`
        );
        console.log();
      }
      break;
    }

    case 'assistant': {
      for (const block of message.message.content) {
        if (block.type === 'text' && block.text.trim().length > 0) {
          console.log(block.text.trim());
          console.log();
        } else if (block.type === 'tool_use') {
          console.log(`  ⚙ ${block.name}`);
        }
      }
      break;
    }

    case 'result': {
      console.log('─'.repeat(60));

      // Narrow theo subtype TRƯỚC: chỉ SDKResultSuccess mới có field `result`.
      if (message.subtype === 'success') {
        // QUAN TRỌNG: subtype 'success' KHÔNG có nghĩa là thành công.
        // Khi lượt kết thúc bằng một lỗi API, CLI vẫn trả subtype 'success'
        // nhưng is_error = true và `result` chứa chính nội dung lỗi.
        // Bỏ qua is_error sẽ in ra dấu ✓ trong khi thực tế đã thất bại.
        if (message.is_error) {
          reportError(message.result || 'không rõ nguyên nhân');
          break;
        }

        console.log(
          `✓ xong · ${message.num_turns} turn · $${message.total_cost_usd.toFixed(4)}`
        );
        if (message.permission_denials.length > 0) {
          console.log(`  bị từ chối ${message.permission_denials.length} lần`);
        }
        break;
      }

      console.error(`✗ dừng sớm: ${message.subtype}`);
      if (message.stop_reason) console.error(`  stop_reason: ${message.stop_reason}`);
      console.error('  → Kiểm thử offline: npm run check');
      process.exitCode = 1;
      break;
    }

    default:
      break;
  }
}

async function main(): Promise<void> {
  const mode = readMode();

  // Không chặn khi thiếu biến môi trường: credential có thể nằm trong keychain
  // từ /login. Chỉ cảnh báo, rồi để CLI tự quyết định (và ta bắt lỗi ở dưới).
  const credential = detectCredential();
  if (credential) {
    console.log(`▸ mode: ${mode}`);
    console.log(`▸ repo: ${REPO_ROOT}`);
    console.log(`▸ auth: ${credential}`);
    console.log(`▸ model: ${process.env['ANTHROPIC_MODEL'] ?? process.env['CCA_MODEL'] ?? 'haiku (mặc định)'}`);
  } else {
    console.error('! Không thấy ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN trong môi trường.');
    console.error('! Vẫn thử chạy — có thể CLI đã có phiên /login.\n');
    console.log(`▸ mode: ${mode}`);
    console.log(`▸ repo: ${REPO_ROOT}`);
    console.log('▸ auth: (để CLI tự xác định)');
  }
  console.log();

  try {
    for await (const message of query({ prompt: promptFor(mode), options: buildOptions(mode) })) {
      printMessage(message);
    }
  } catch (error: unknown) {
    // SDK ném lỗi khi CLI thoát bất thường (không có credential, sai model,
    // mạng hỏng). In gợi ý đúng thay vì stack trace thô.
    const text = error instanceof Error ? error.message : String(error);
    console.error();
    reportError(text);
    if (!errorReported) console.error(text);
    console.error('  → Kiểm thử offline (không cần credit): npm run check');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Orchestrator lỗi:', error);
  process.exitCode = 1;
});
