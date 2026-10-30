import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  CONCEPTS,
  CONCEPT_BY_ID,
  QUIZ_BY_ID,
  QUIZ_ITEMS,
} from './knowledge.js';
import {
  DOMAINS,
  DOMAIN_LAYER,
  LAYER_LABELS,
  type Concept,
  type Difficulty,
  type Domain,
  type GradedAnswer,
  type Layer,
  type QuizItem,
} from './types.js';

/**
 * MCP server "cca-coach" — chạy trên stdio.
 *
 * Ba primitive được dùng:
 *   - tool:     list_concepts, get_concept, generate_quiz, grade_answer, score_report, audit_kb
 *   - resource: cca://glossary (toàn bộ concept), cca://domains (bản đồ domain -> layer)
 *   - prompt:   study-session, exam-brief
 *
 * Lưu ý sống còn: KHÔNG được ghi gì ra stdout ngoài JSON-RPC.
 * Mọi log phải đi qua console.error.
 */

const SERVER_NAME = 'cca-coach';
const SERVER_VERSION = '0.1.0';

/** JSON đẹp, gọn, để đọc trong tool result. */
function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Rút gọn concept cho listing, tránh làm ngập context của model. */
function briefConcept(concept: Concept): Record<string, unknown> {
  return {
    id: concept.id,
    title: concept.title,
    layer: concept.layer,
    layerLabel: LAYER_LABELS[concept.layer],
    summary: concept.summary,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = pool[i];
    const b = pool[j];
    if (a !== undefined && b !== undefined) {
      pool[i] = b;
      pool[j] = a;
    }
  }
  return pool;
}

function pickQuiz(items: readonly QuizItem[], count: number): QuizItem[] {
  return shuffle(items).slice(0, Math.max(0, count));
}

/** Chọn đề cân bằng theo domain: chia đều rồi bù phần dư cho các domain còn lại. */
function pickBalanced(items: readonly QuizItem[], count: number): QuizItem[] {
  const buckets = DOMAINS.map((domain) =>
    shuffle(items.filter((item) => item.domain === domain))
  );
  const result: QuizItem[] = [];
  let round = 0;

  while (result.length < count) {
    let addedThisRound = 0;
    for (const bucket of buckets) {
      const next = bucket[round];
      if (next !== undefined && result.length < count) {
        result.push(next);
        addedThisRound += 1;
      }
    }
    if (addedThisRound === 0) break;
    round += 1;
  }
  return result;
}

function buildGlossaryMarkdown(): string {
  const lines: string[] = [
    '# Glossary — kiến trúc Claude (CCA-F)',
    '',
    `Tổng: ${CONCEPTS.length} concept trong 4 tầng.`,
    '',
  ];

  for (const layer of Object.keys(LAYER_LABELS) as Layer[]) {
    const group = CONCEPTS.filter((concept) => concept.layer === layer);
    if (group.length === 0) continue;
    lines.push(`## ${LAYER_LABELS[layer]}`, '');
    for (const concept of group) {
      lines.push(`### ${concept.title}`, '', `\`${concept.id}\``, '', concept.summary, '');
      lines.push(`Nguồn: ${concept.sources.map((s) => `\`${s}\``).join(', ')}`, '');
    }
  }
  return lines.join('\n');
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// ── Tools ───────────────────────────────────────────────────────────────

server.registerTool(
  'list_concepts',
  {
    title: 'Liệt kê concept',
    description:
      'Liệt kê concept ôn thi, lọc theo tầng (layer). Dùng để biết repo đang có tri thức gì trước khi hỏi sâu.',
    inputSchema: {
      layer: z
        .enum(['api', 'agent-sdk', 'claude-code', 'mcp'])
        .optional()
        .describe('Chỉ lấy concept thuộc tầng này. Bỏ trống để lấy tất cả.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ layer }) => {
    const filtered = layer ? CONCEPTS.filter((concept) => concept.layer === layer) : CONCEPTS;
    return {
      content: [
        {
          type: 'text',
          text: toJson({ count: filtered.length, concepts: filtered.map(briefConcept) }),
        },
      ],
    };
  }
);

server.registerTool(
  'get_concept',
  {
    title: 'Chi tiết một concept',
    description:
      'Trả về đầy đủ một concept: tóm tắt, tầng, nguồn, và các câu quiz liên quan (ẩn đáp án). Dùng khi người học hỏi về một khái niệm cụ thể.',
    inputSchema: {
      id: z.string().min(1).describe('Concept id, ví dụ "cc-hooks-exit-codes".'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id }) => {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) {
      const prefix = id.split('-')[0] ?? '';
      const suggestion = CONCEPTS.map((c) => c.id)
        .filter((candidate) => candidate.includes(prefix))
        .slice(0, 5);
      return {
        content: [
          {
            type: 'text',
            text: toJson({
              error: `Không tìm thấy concept "${id}".`,
              goiY: suggestion.length > 0 ? suggestion : 'Dùng list_concepts để xem danh sách.',
            }),
          },
        ],
        isError: true,
      };
    }

    const related = QUIZ_ITEMS.filter((item) => item.conceptId === concept.id).map((item) => ({
      id: item.id,
      difficulty: item.difficulty,
      question: item.question,
    }));

    return {
      content: [{ type: 'text', text: toJson({ concept, quizLienQuan: related }) }],
    };
  }
);

server.registerTool(
  'generate_quiz',
  {
    title: 'Sinh đề quiz',
    description:
      'Sinh câu hỏi từ quiz bank. Dùng balanced=true để trải đều 4 domain (chế độ thi thử), hoặc lọc theo domain/difficulty để luyện một chủ đề.',
    inputSchema: {
      count: z.number().int().min(1).max(40).default(5).describe('Số câu cần sinh.'),
      domain: z
        .enum(['api-fundamentals', 'agent-design', 'claude-code-config', 'mcp-integration'])
        .optional()
        .describe('Chỉ lấy câu thuộc domain này.'),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Độ khó mong muốn.'),
      balanced: z
        .boolean()
        .default(false)
        .describe('true = chia đều cho 4 domain, bỏ qua domain/difficulty.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ count, domain, difficulty, balanced }) => {
    let pool: readonly QuizItem[] = QUIZ_ITEMS;
    if (domain) pool = pool.filter((item) => item.domain === domain);
    if (difficulty) pool = pool.filter((item) => item.difficulty === difficulty);

    if (pool.length === 0) {
      return {
        content: [{ type: 'text', text: toJson({ error: 'Không có câu nào khớp bộ lọc.' }) }],
        isError: true,
      };
    }

    const selected = balanced && !domain ? pickBalanced(pool, count) : pickQuiz(pool, count);

    // Không trả answerIndex/explanation: đề phải được chấm qua grade_answer.
    return {
      content: [
        {
          type: 'text',
          text: toJson({
            requested: count,
            returned: selected.length,
            questions: selected.map((item) => ({
              id: item.id,
              domain: item.domain,
              difficulty: item.difficulty,
              question: item.question,
              options: item.options,
            })),
            huongDan: 'Gửi câu trả lời qua grade_answer với quizId + selectedIndex.',
          }),
        },
      ],
    };
  }
);

server.registerTool(
  'grade_answer',
  {
    title: 'Chấm một câu',
    description:
      'Chấm một câu trả lời theo đáp án chuẩn trong quiz bank. Luôn dùng tool này thay vì tự chấm, để điểm số không bị lệch.',
    inputSchema: {
      quizId: z.string().min(1).describe('id của câu hỏi, ví dụ "q-cc-08".'),
      selectedIndex: z.number().int().min(0).max(3).describe('Phương án đã chọn, 0..3 (A..D).'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ quizId, selectedIndex }) => {
    const item = QUIZ_BY_ID.get(quizId);
    if (!item) {
      return {
        content: [{ type: 'text', text: toJson({ error: `Không có câu hỏi "${quizId}".` }) }],
        isError: true,
      };
    }

    const graded: GradedAnswer = {
      quizId: item.id,
      correct: selectedIndex === item.answerIndex,
      correctIndex: item.answerIndex,
      explanation: item.explanation,
    };
    const letters = ['A', 'B', 'C', 'D'];

    return {
      content: [
        {
          type: 'text',
          text: toJson({
            ...graded,
            dapAnDung: letters[item.answerIndex],
            banChon: letters[selectedIndex],
            conceptId: item.conceptId,
          }),
        },
      ],
    };
  }
);

server.registerTool(
  'score_report',
  {
    title: 'Báo cáo điểm theo domain',
    description:
      'Nhận toàn bộ câu trả lời của một đề và trả về điểm tổng, điểm từng domain, và danh sách câu sai kèm giải thích. Dùng ở cuối buổi thi thử.',
    inputSchema: {
      answers: z
        .array(
          z.object({
            quizId: z.string().min(1),
            selectedIndex: z.number().int().min(0).max(3),
          })
        )
        .min(1)
        .describe('Mảng câu trả lời.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ answers }) => {
    const perDomain = new Map<Domain, { correct: number; total: number }>();
    for (const domain of DOMAINS) perDomain.set(domain, { correct: 0, total: 0 });

    const wrong: Array<Record<string, unknown>> = [];
    let correctTotal = 0;
    let considered = 0;

    for (const answer of answers) {
      const item = QUIZ_BY_ID.get(answer.quizId);
      if (!item) {
        wrong.push({ quizId: answer.quizId, error: 'không có trong quiz bank' });
        continue;
      }
      considered += 1;
      const bucket = perDomain.get(item.domain);
      if (bucket) bucket.total += 1;
      if (answer.selectedIndex === item.answerIndex) {
        correctTotal += 1;
        if (bucket) bucket.correct += 1;
      } else {
        wrong.push({
          quizId: item.id,
          domain: item.domain,
          banChon: answer.selectedIndex,
          dapAnDung: item.answerIndex,
          conceptId: item.conceptId,
          explanation: item.explanation,
        });
      }
    }

    const domains = DOMAINS.map((domain) => {
      const bucket = perDomain.get(domain) ?? { correct: 0, total: 0 };
      return {
        domain,
        layer: DOMAIN_LAYER[domain],
        correct: bucket.correct,
        total: bucket.total,
        percent: bucket.total === 0 ? 0 : Math.round((bucket.correct / bucket.total) * 1000) / 10,
      };
    });

    const weakest = domains
      .filter((entry) => entry.total > 0)
      .sort((a, b) => a.percent - b.percent)[0];

    return {
      content: [
        {
          type: 'text',
          text: toJson({
            tong: {
              dung: correctTotal,
              tong: considered,
              percent: considered === 0 ? 0 : Math.round((correctTotal / considered) * 1000) / 10,
            },
            theoDomain: domains,
            cauSai: wrong,
            uuTienOn: weakest
              ? `${weakest.domain} (${weakest.percent}%) — chạy /daily-study ${weakest.layer}`
              : 'không đủ dữ liệu',
          }),
        },
      ],
    };
  }
);

server.registerTool(
  'audit_kb',
  {
    title: 'Kiểm tra tính toàn vẹn của KB',
    description:
      'Kiểm tra các bất biến của knowledge base: concept mồ côi, quiz trỏ tới concept không tồn tại, domain không khớp layer, số phương án khác 4. Dùng sau khi sửa knowledge.ts.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const problems: string[] = [];

    for (const concept of CONCEPTS) {
      const hasQuiz = QUIZ_ITEMS.some((item) => item.conceptId === concept.id);
      if (!hasQuiz) problems.push(`concept mồ côi (không có quiz): ${concept.id}`);
    }

    for (const item of QUIZ_ITEMS) {
      const concept = CONCEPT_BY_ID.get(item.conceptId);
      if (!concept) {
        problems.push(`${item.id} trỏ tới concept không tồn tại: ${item.conceptId}`);
        continue;
      }
      const expectedLayer = DOMAIN_LAYER[item.domain];
      if (expectedLayer !== concept.layer) {
        problems.push(
          `${item.id} có domain ${item.domain} (ứng với layer ${expectedLayer}) nhưng concept ${concept.id} thuộc layer ${concept.layer}`
        );
      }
      if (item.options.length !== 4) {
        problems.push(`${item.id} có ${item.options.length} phương án, phải đúng 4`);
      }
      if (item.explanation.trim().length < 20) {
        problems.push(`${item.id} thiếu giải thích đủ dài`);
      }
    }

    const byLayer: Record<string, number> = {};
    for (const concept of CONCEPTS) {
      byLayer[concept.layer] = (byLayer[concept.layer] ?? 0) + 1;
    }
    const byDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const item of QUIZ_ITEMS) byDifficulty[item.difficulty] += 1;

    return {
      content: [
        {
          type: 'text',
          text: toJson({
            ok: problems.length === 0,
            concepts: CONCEPTS.length,
            quizItems: QUIZ_ITEMS.length,
            theoLayer: byLayer,
            theoDoKho: byDifficulty,
            problems,
          }),
        },
      ],
    };
  }
);

// ── Resources ───────────────────────────────────────────────────────────

server.registerResource(
  'glossary',
  'cca://glossary',
  {
    title: 'Glossary kiến trúc Claude',
    description: 'Toàn bộ concept, nhóm theo 4 tầng, kèm nguồn. Dạng markdown để đọc trực tiếp.',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: buildGlossaryMarkdown() }],
  })
);

server.registerResource(
  'domains',
  'cca://domains',
  {
    title: 'Bản đồ domain -> layer',
    description: 'Ánh xạ 4 domain ôn thi sang 4 tầng kiến trúc, kèm số concept và số câu hỏi.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: toJson(
          DOMAINS.map((domain) => ({
            domain,
            layer: DOMAIN_LAYER[domain],
            layerLabel: LAYER_LABELS[DOMAIN_LAYER[domain]],
            concepts: CONCEPTS.filter((concept) => concept.layer === DOMAIN_LAYER[domain]).length,
            quizItems: QUIZ_ITEMS.filter((item) => item.domain === domain).length,
          }))
        ),
      },
    ],
  })
);

// ── Prompts ─────────────────────────────────────────────────────────────

server.registerPrompt(
  'study-session',
  {
    title: 'Kế hoạch buổi học',
    description: 'Sinh prompt cho một buổi học 45 phút tập trung vào một tầng.',
    argsSchema: {
      layer: z.enum(['api', 'agent-sdk', 'claude-code', 'mcp']).describe('Tầng muốn học.'),
    },
  },
  ({ layer }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Chạy một buổi học 45 phút cho tầng ${LAYER_LABELS[layer]} (${layer}).`,
            '',
            '1. Gọi list_concepts với layer này và tóm tắt các concept sẽ học.',
            '2. Với mỗi concept, gọi get_concept và trình bày theo 4 khối API / Agent SDK / Claude Code / MCP.',
            '3. Gọi generate_quiz với domain tương ứng, count 5, rồi chấm bằng grade_answer.',
            '4. Kết thúc bằng score_report và ghi tiến độ vào docs/progress.md.',
          ].join('\n'),
        },
      },
    ],
  })
);

server.registerPrompt(
  'exam-brief',
  {
    title: 'Đề thi thử',
    description: 'Sinh prompt cho một đề thi thử có tính giờ, chấm theo domain.',
    argsSchema: {
      count: z.string().describe('Số câu, ví dụ "20".'),
    },
  },
  ({ count }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Tạo đề thi thử ${count} câu bằng cách gọi generate_quiz với balanced=true.`,
            'Hiển thị từng câu một, chờ tôi trả lời rồi mới sang câu tiếp.',
            'Không tiết lộ đáp án trong lúc làm bài.',
            'Khi xong, gọi score_report cho toàn bộ câu trả lời và xuất báo cáo theo mẫu trong .claude/skills/mock-exam/SKILL.md.',
          ].join('\n'),
        },
      },
    ],
  })
);

// ── Khởi động ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Log đi stderr: stdout là kênh JSON-RPC.
  console.error(
    `[${SERVER_NAME}] khởi động v${SERVER_VERSION}: ${CONCEPTS.length} concept, ${QUIZ_ITEMS.length} câu quiz`
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] lỗi khởi động:`, error);
  process.exit(1);
});
