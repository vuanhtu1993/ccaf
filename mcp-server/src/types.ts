/**
 * Kiểu dữ liệu dùng chung cho knowledge base và quiz bank.
 *
 * Đây là "hợp đồng" của repo: agent `kb-curator` và hook validate đều dựa vào
 * các kiểu này, nên mọi concept/quiz mới phải thoả mãn chúng.
 */

/** Bốn tầng trong sơ đồ kiến trúc Claude. */
export type Layer = 'api' | 'agent-sdk' | 'claude-code' | 'mcp';

export const LAYERS: readonly Layer[] = ['api', 'agent-sdk', 'claude-code', 'mcp'];

export const LAYER_LABELS: Record<Layer, string> = {
  api: 'Claude API',
  'agent-sdk': 'Agent SDK',
  'claude-code': 'Claude Code',
  mcp: 'MCP',
};

/** Domain ôn thi. Mỗi domain ánh xạ tới đúng một tầng. */
export type Domain = 'api-fundamentals' | 'agent-design' | 'claude-code-config' | 'mcp-integration';

export const DOMAINS: readonly Domain[] = [
  'api-fundamentals',
  'agent-design',
  'claude-code-config',
  'mcp-integration',
];

export const DOMAIN_LAYER: Record<Domain, Layer> = {
  'api-fundamentals': 'api',
  'agent-design': 'agent-sdk',
  'claude-code-config': 'claude-code',
  'mcp-integration': 'mcp',
};

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Concept {
  /** kebab-case, ổn định, dùng làm khoá tham chiếu. */
  id: string;
  title: string;
  layer: Layer;
  /** Tối đa 2 câu. Chi tiết nằm ở sources. */
  summary: string;
  /** Đường dẫn file trong repo hoặc URL docs thật. */
  sources: string[];
}

export interface QuizItem {
  id: string;
  /** Phải trỏ tới Concept.id tồn tại. */
  conceptId: string;
  domain: Domain;
  difficulty: Difficulty;
  question: string;
  /** Đúng 4 phương án. */
  options: [string, string, string, string];
  /** 0..3 */
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

/** Câu trả lời của người học, dùng cho grade_answer và score_report. */
export interface SubmittedAnswer {
  quizId: string;
  /** Chỉ số phương án đã chọn, 0..3. */
  selectedIndex: number;
}

export interface GradedAnswer {
  quizId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

export interface DomainScore {
  domain: Domain;
  correct: number;
  total: number;
  /** 0..100, làm tròn 1 chữ số thập phân. */
  percent: number;
}
