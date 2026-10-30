import type { Concept, QuizItem } from './types.js';

/**
 * Nguồn sự thật duy nhất cho nội dung ôn thi.
 *
 * Bất biến (agent `kb-curator` và `npm run probe` cùng kiểm tra):
 *   1. Mỗi concept có ít nhất 1 quiz item.
 *   2. Mỗi quiz item trỏ tới concept tồn tại.
 *   3. domain của quiz khớp layer của concept.
 *   4. sources phải là path thật trong repo hoặc URL docs thật.
 */

export const CONCEPTS: readonly Concept[] = [
  // ── Tầng 1: Claude API ────────────────────────────────────────────────
  {
    id: 'api-tool-loop',
    title: 'Tool loop do bạn tự viết',
    layer: 'api',
    summary:
      'Khi gọi Claude API trực tiếp, bạn tự quản lý vòng lặp: gửi request, đọc stop_reason = "tool_use", chạy tool, rồi gửi tool_result trở lại. API không tự gọi tool cho bạn.',
    sources: ['docs/architecture.md', 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview'],
  },
  {
    id: 'api-stop-reason',
    title: 'stop_reason quyết định vòng lặp',
    layer: 'api',
    summary:
      'Vòng lặp tool dừng khi stop_reason khác "tool_use". Chỉ "tool_use" mới bắt buộc bạn thực thi tool và gửi kết quả trở lại.',
    sources: ['docs/architecture.md', 'https://platform.claude.com/docs/en/api/messages'],
  },
  {
    id: 'api-context-budget',
    title: 'Context là tài nguyên có hạn',
    layer: 'api',
    summary:
      'Mọi thứ bạn nhét vào request đều tốn token ở mọi lượt. Vì vậy tri thức luôn bật phải ngắn, còn tri thức dài nên nạp theo nhu cầu.',
    sources: ['docs/architecture.md', 'https://code.claude.com/docs/en/memory'],
  },

  // ── Tầng 2: Agent SDK ─────────────────────────────────────────────────
  {
    id: 'agent-sdk-query',
    title: 'query() — agent loop đóng gói sẵn',
    layer: 'agent-sdk',
    summary:
      'Agent SDK chạy chính agent loop của Claude Code như một thư viện, nhận prompt + options và trả về async stream message. Bạn không phải tự viết tool loop nữa.',
    sources: ['agent-sdk/src/orchestrator.ts', 'https://code.claude.com/docs/en/agent-sdk/overview'],
  },
  {
    id: 'agent-sdk-agents-option',
    title: 'Option agents — subagent lập trình được',
    layer: 'agent-sdk',
    summary:
      'Option agents là Record<string, AgentDefinition>; mỗi AgentDefinition bắt buộc có description và prompt, và có thể giới hạn tools, model, skills, mcpServers, maxTurns.',
    sources: ['agent-sdk/src/orchestrator.ts', 'https://code.claude.com/docs/en/agent-sdk/subagents'],
  },
  {
    id: 'agent-sdk-setting-sources',
    title: 'settingSources quyết định file nào được nạp',
    layer: 'agent-sdk',
    summary:
      'settingSources nhận "user", "project", "local"; truyền [] sẽ tắt toàn bộ settings từ filesystem. Skills và subagent dạng file chỉ xuất hiện khi source tương ứng được bật.',
    sources: ['agent-sdk/src/orchestrator.ts', 'https://code.claude.com/docs/en/agent-sdk/claude-code-features'],
  },
  {
    id: 'agent-sdk-inprocess-mcp',
    title: 'MCP server trong cùng tiến trình',
    layer: 'agent-sdk',
    summary:
      'createSdkMcpServer() + tool() cho phép expose tool ngay trong tiến trình Node, không cần spawn server riêng. Phù hợp cho tool ngắn, không cần tái sử dụng ngoài agent.',
    sources: ['agent-sdk/src/orchestrator.ts', 'https://code.claude.com/docs/en/agent-sdk/custom-tools'],
  },
  {
    id: 'agent-sdk-hooks',
    title: 'Hooks ở tầng SDK là callback',
    layer: 'agent-sdk',
    summary:
      'Ở SDK, hooks là hàm TypeScript nhận HookInput và trả HookJSONOutput; ở Claude Code CLI, cùng event đó là shell command đọc JSON qua stdin. Cùng khái niệm, khác cơ chế.',
    sources: ['agent-sdk/src/orchestrator.ts', 'https://code.claude.com/docs/en/agent-sdk/hooks'],
  },

  // ── Tầng 3: Claude Code ───────────────────────────────────────────────
  {
    id: 'cc-claude-md',
    title: 'CLAUDE.md — bộ nhớ luôn bật',
    layer: 'claude-code',
    summary:
      'CLAUDE.md được nạp vào đầu mỗi phiên và là context, không phải cấu hình cưỡng chế. Việc gì buộc phải xảy ra thì phải dùng hook, không dựa vào CLAUDE.md.',
    sources: ['CLAUDE.md', 'https://code.claude.com/docs/en/memory'],
  },
  {
    id: 'cc-rules-paths',
    title: 'rules/ với frontmatter paths',
    layer: 'claude-code',
    summary:
      'File trong .claude/rules/ được quét đệ quy; rule không có paths thì nạp lúc khởi động, rule có paths chỉ nạp khi Claude chạm file khớp glob.',
    sources: ['.claude/rules/typescript.md', 'https://code.claude.com/docs/en/memory#path-specific-rules'],
  },
  {
    id: 'cc-skills',
    title: 'Skill — tri thức nạp theo nhu cầu',
    layer: 'claude-code',
    summary:
      'Skill là .claude/skills/<name>/SKILL.md; chỉ name và description nằm sẵn trong context, toàn bộ thân skill chỉ nạp khi được gọi. Vì vậy skill rẻ hơn rule cho nội dung dài.',
    sources: ['.claude/skills/daily-study/SKILL.md', 'https://code.claude.com/docs/en/skills'],
  },
  {
    id: 'cc-skill-frontmatter',
    title: 'Frontmatter của skill',
    layer: 'claude-code',
    summary:
      'Các field hay dùng: name, description, allowed-tools, disable-model-invocation, argument-hint, context: fork. Field không nhận diện được sẽ bị bỏ qua im lặng, nên gõ sai tên là mất tác dụng.',
    sources: ['.claude/skills/mock-exam/SKILL.md', 'https://code.claude.com/docs/en/skills#frontmatter-reference'],
  },
  {
    id: 'cc-subagents-files',
    title: 'Subagent là file markdown có frontmatter',
    layer: 'claude-code',
    summary:
      'Subagent đặt ở .claude/agents/*.md, bắt buộc có name và description; các field nhiều từ dùng camelCase như disallowedTools và maxTurns. Subagent chạy trong context window riêng và trả về bản tóm tắt.',
    sources: ['.claude/agents/architecture-reviewer.md', 'https://code.claude.com/docs/en/sub-agents'],
  },
  {
    id: 'cc-subagent-tools',
    title: 'Giới hạn tool của subagent',
    layer: 'claude-code',
    summary:
      'Field tools thu hẹp danh sách tool, disallowedTools loại bỏ tool kể cả khi được kế thừa. Bỏ trống tools nghĩa là kế thừa toàn bộ tool mà subagent được phép dùng.',
    sources: ['.claude/agents/exam-driller.md', 'https://code.claude.com/docs/en/sub-agents#available-tools'],
  },
  {
    id: 'cc-hooks-shape',
    title: 'Cấu trúc khai báo hook',
    layer: 'claude-code',
    summary:
      'Hook khai báo theo 3 tầng: event, matcher group, rồi handler (type: command | http | mcp_tool | prompt | agent). Với "command", script nhận JSON của event qua stdin.',
    sources: ['.claude/settings.json', 'https://code.claude.com/docs/en/hooks#configuration'],
  },
  {
    id: 'cc-hooks-exit-codes',
    title: 'Exit code của hook',
    layer: 'claude-code',
    summary:
      'Exit 0 là thành công (stdout có thể là JSON điều khiển); exit 2 là chặn hành động và stderr trở thành lý do Claude nhìn thấy. Các exit code khác là lỗi không chặn.',
    sources: ['.claude/hooks/guard-dangerous.sh', 'https://code.claude.com/docs/en/hooks#exit-code-output'],
  },
  {
    id: 'cc-hooks-pretooluse-decision',
    title: 'Quyết định của PreToolUse',
    layer: 'claude-code',
    summary:
      'PreToolUse trả quyết định trong hookSpecificOutput.permissionDecision với các giá trị allow, deny, ask, defer. Nhiều hook cùng trả thì thứ tự ưu tiên là deny > defer > ask > allow.',
    sources: ['.claude/hooks/validate-frontmatter.sh', 'https://code.claude.com/docs/en/hooks#pretooluse-decision-control'],
  },
  {
    id: 'cc-permission-modes',
    title: 'Permission mode',
    layer: 'claude-code',
    summary:
      'Các mode gồm default, acceptEdits, plan, dontAsk, auto, bypassPermissions. Deny rule trong settings vẫn được đánh giá bất kể mode, nên đó mới là lá chắn thật.',
    sources: ['.claude/settings.json', 'https://code.claude.com/docs/en/permission-modes'],
  },

  // ── Tầng 4: MCP ───────────────────────────────────────────────────────
  {
    id: 'mcp-project-scope',
    title: '.mcp.json — MCP ở phạm vi project',
    layer: 'mcp',
    summary:
      '.mcp.json ở gốc repo khai báo server theo scope project để chia sẻ qua git; Claude Code hỏi approve từng server một lần. Có thể bỏ bước hỏi bằng enableAllProjectMcpServers.',
    sources: ['.mcp.json', 'https://code.claude.com/docs/en/mcp#project-scope'],
  },
  {
    id: 'mcp-transports',
    title: 'Bốn loại transport',
    layer: 'mcp',
    summary:
      'MCP hỗ trợ stdio, http, sse và ws; entry có url mà thiếu type sẽ bị coi là stdio và lỗi cấu hình. stdio phù hợp server chạy local cùng repo.',
    sources: ['.mcp.json', 'https://code.claude.com/docs/en/mcp#installing-mcp-servers'],
  },
  {
    id: 'mcp-primitives',
    title: 'Ba primitive: tool, resource, prompt',
    layer: 'mcp',
    summary:
      'Tool là hành động model gọi được, resource là dữ liệu đọc theo URI, prompt là template do người dùng chọn. Server này dùng tool cho quiz và resource cho glossary.',
    sources: ['mcp-server/src/index.ts', 'https://modelcontextprotocol.io/specification'],
  },
  {
    id: 'mcp-stdio-stdout',
    title: 'stdout của server stdio là kênh protocol',
    layer: 'mcp',
    summary:
      'Với transport stdio, stdout chỉ dành cho JSON-RPC; in log ra stdout sẽ làm hỏng protocol. Mọi log phải đi qua stderr.',
    sources: ['mcp-server/src/index.ts', 'https://code.claude.com/docs/en/mcp'],
  },
  {
    id: 'mcp-env-expansion',
    title: 'Biến môi trường trong .mcp.json',
    layer: 'mcp',
    summary:
      '.mcp.json hỗ trợ ${VAR} và ${VAR:-default} trong command, args, env, url, headers. CLAUDE_PROJECT_DIR được set trong môi trường của server nên phải viết kèm default.',
    sources: ['.mcp.json', 'https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcpjson'],
  },
];

export const QUIZ_ITEMS: readonly QuizItem[] = [
  // ── api-fundamentals ──
  {
    id: 'q-api-01',
    conceptId: 'api-tool-loop',
    domain: 'api-fundamentals',
    difficulty: 'easy',
    question:
      'Bạn gọi Messages API trực tiếp và nhận về stop_reason = "tool_use". Việc gì thuộc trách nhiệm của code bạn?',
    options: [
      'Không làm gì, API sẽ tự thực thi tool rồi trả kết quả cuối',
      'Thực thi tool, rồi gửi kết quả dưới dạng tool_result trong request tiếp theo',
      'Gửi lại y nguyên request cho tới khi stop_reason khác "tool_use"',
      'Chuyển sang streaming để API tự chạy tool',
    ],
    answerIndex: 1,
    explanation:
      'Với Claude API, tool loop là của bạn. API chỉ trả về yêu cầu gọi tool; bạn phải chạy tool và gửi tool_result trở lại. API không bao giờ tự thực thi tool, và gửi lại y nguyên request sẽ lặp vô hạn.',
  },
  {
    id: 'q-api-02',
    conceptId: 'api-stop-reason',
    domain: 'api-fundamentals',
    difficulty: 'medium',
    question:
      'Vòng lặp tool của bạn chạy mãi không dừng. Nguyên nhân hợp lý nhất trong 4 phương án?',
    options: [
      'Bạn quên kiểm tra stop_reason sau mỗi lượt và luôn gửi tiếp',
      'Bạn đặt max_tokens quá thấp',
      'Bạn dùng streaming thay vì non-streaming',
      'Bạn chưa khai báo tool trong system prompt',
    ],
    answerIndex: 0,
    explanation:
      'Điều kiện dừng của vòng lặp là stop_reason khác "tool_use". Nếu không kiểm tra, bạn sẽ gửi tiếp bất kể model đã trả lời xong. max_tokens thấp làm câu trả lời bị cắt, không gây lặp; tool khai báo ở request, không phải system prompt.',
  },
  {
    id: 'q-api-03',
    conceptId: 'api-context-budget',
    domain: 'api-fundamentals',
    difficulty: 'medium',
    question:
      'Một quy trình 40 bước chỉ dùng khoảng 2 lần mỗi tuần. Đặt nó ở đâu là hợp lý nhất?',
    options: [
      'Trong CLAUDE.md để Claude luôn biết',
      'Trong một file rule không có paths',
      'Trong một skill, chỉ nạp khi được gọi',
      'Trong system prompt của mọi request API',
    ],
    answerIndex: 2,
    explanation:
      'CLAUDE.md, rule không có paths và system prompt đều nạp ở mọi lượt, nên quy trình dài sẽ chiếm context thường trực. Skill chỉ đưa name + description vào context và nạp thân bài khi được gọi — đúng cho nội dung dài, ít dùng.',
  },
  {
    id: 'q-api-04',
    conceptId: 'api-context-budget',
    domain: 'api-fundamentals',
    difficulty: 'hard',
    question:
      'Vì sao "nhét tất cả tài liệu vào CLAUDE.md" là lựa chọn tốn kém so với dùng skill?',
    options: [
      'Vì CLAUDE.md bị giới hạn 100 dòng',
      'Vì nội dung CLAUDE.md tốn token ở mọi lượt, còn skill chỉ tốn khi dùng',
      'Vì CLAUDE.md không hỗ trợ markdown',
      'Vì skill được model đọc nhanh hơn',
    ],
    answerIndex: 1,
    explanation:
      'CLAUDE.md là context thường trực của mọi phiên và mọi lượt trong phiên đó. Skill chỉ nạp metadata lúc khởi động và toàn bộ thân bài khi được gọi, nên tài liệu dài gần như miễn phí cho tới khi cần.',
  },

  // ── agent-design ──
  {
    id: 'q-agent-01',
    conceptId: 'agent-sdk-query',
    domain: 'agent-design',
    difficulty: 'easy',
    question: 'Agent SDK khác Claude API trực tiếp ở điểm cốt lõi nào?',
    options: [
      'Agent SDK dùng model khác, mạnh hơn',
      'Agent SDK chạy agent loop có sẵn (tool, permission, session), bạn chỉ cấu hình',
      'Agent SDK không cần API key',
      'Agent SDK chỉ chạy được trên Claude Code CLI',
    ],
    answerIndex: 1,
    explanation:
      'Agent SDK đóng gói chính agent loop của Claude Code thành thư viện: built-in tools, permission, session, hooks, subagent. Vẫn là cùng model và vẫn cần xác thực; nó chạy như một thư viện trong app của bạn, không chỉ trong CLI.',
  },
  {
    id: 'q-agent-02',
    conceptId: 'agent-sdk-agents-option',
    domain: 'agent-design',
    difficulty: 'medium',
    question:
      'Trong Agent SDK (TypeScript), hai field nào bắt buộc phải có trong một AgentDefinition?',
    options: ['name và description', 'description và prompt', 'prompt và tools', 'model và tools'],
    answerIndex: 1,
    explanation:
      'AgentDefinition yêu cầu description (khi nào dùng) và prompt (system prompt của agent). name là khoá trong Record<string, AgentDefinition> chứ không phải field của object; tools và model là tuỳ chọn.',
  },
  {
    id: 'q-agent-03',
    conceptId: 'agent-sdk-setting-sources',
    domain: 'agent-design',
    difficulty: 'hard',
    question:
      'Bạn muốn agent SDK tuyệt đối không đọc settings từ máy dev, để kết quả tái lập được trong CI. Làm gì?',
    options: [
      'Đặt permissionMode: "plan"',
      'Truyền settingSources: []',
      'Đặt cwd về thư mục tạm',
      'Xoá thư mục ~/.claude trên runner',
    ],
    answerIndex: 1,
    explanation:
      'settingSources: [] tắt user, project và local settings — đúng mục đích tái lập. permissionMode chỉ ảnh hưởng quyền, không ảnh hưởng file cấu hình nào được nạp; đổi cwd hay xoá ~/.claude là cách xử lý ngoài rìa và dễ vỡ.',
  },
  {
    id: 'q-agent-04',
    conceptId: 'agent-sdk-inprocess-mcp',
    domain: 'agent-design',
    difficulty: 'medium',
    question:
      'Bạn cần một tool duy nhất, rất ngắn, chỉ dùng trong tiến trình agent hiện tại và không cần tái sử dụng. Lựa chọn gọn nhất?',
    options: [
      'Viết một MCP server stdio riêng, build, rồi khai báo trong .mcp.json',
      'Dùng createSdkMcpServer() cùng tool() để expose tool trong tiến trình',
      'Thêm hướng dẫn vào CLAUDE.md rồi để Claude tự làm',
      'Viết custom subagent trong .claude/agents/',
    ],
    answerIndex: 1,
    explanation:
      'createSdkMcpServer() + tool() tạo MCP server trong cùng tiến trình, không cần build hay spawn process. Server stdio riêng là đúng khi cần tái sử dụng ngoài agent; CLAUDE.md chỉ là hướng dẫn, không phải tool; subagent không thay thế tool.',
  },
  {
    id: 'q-agent-05',
    conceptId: 'agent-sdk-hooks',
    domain: 'agent-design',
    difficulty: 'medium',
    question:
      'Cùng một hook PreToolUse, khác biệt chính giữa khai báo trong Claude Code CLI và trong Agent SDK là gì?',
    options: [
      'CLI dùng shell command đọc JSON qua stdin; SDK dùng hàm callback TypeScript',
      'SDK không hỗ trợ event PreToolUse',
      'CLI chỉ hỗ trợ event Stop',
      'SDK dùng chung file settings.json với CLI để khai báo hook',
    ],
    answerIndex: 0,
    explanation:
      'Cùng bộ event, hai cơ chế thực thi: CLI spawn command (hoặc http/mcp_tool/prompt/agent handler), còn SDK đăng ký hàm HookCallback trả về HookJSONOutput. SDK vẫn hỗ trợ PreToolUse, và dùng settings.json là chuyện của settingSources chứ không phải cơ chế hook.',
  },
  {
    id: 'q-agent-06',
    conceptId: 'agent-sdk-agents-option',
    domain: 'agent-design',
    difficulty: 'hard',
    question:
      'Vì sao nên đẩy việc đọc hàng nghìn dòng log sang subagent thay vì làm trong hội thoại chính?',
    options: [
      'Vì subagent dùng model rẻ hơn nên tổng chi phí luôn thấp hơn',
      'Vì subagent có context window riêng và chỉ trả về bản tóm tắt',
      'Vì hội thoại chính không đọc được file log',
      'Vì subagent chạy song song nên không tính vào usage',
    ],
    answerIndex: 1,
    explanation:
      'Giá trị chính là cách ly context: log lớn nằm trong context của subagent, hội thoại chính chỉ nhận phần tóm tắt. Subagent không tự rẻ hơn (cùng usage limit, cùng model tuỳ cấu hình) và request của nó vẫn tính vào hạn mức.',
  },

  // ── claude-code-config ──
  {
    id: 'q-cc-01',
    conceptId: 'cc-claude-md',
    domain: 'claude-code-config',
    difficulty: 'easy',
    question:
      'Bạn cần đảm bảo mọi lệnh `git push` đều bị chặn, kể cả khi Claude "quên" đọc hướng dẫn. Cách nào đúng?',
    options: [
      'Viết "KHÔNG BAO GIỜ chạy git push" thật to trong CLAUDE.md',
      'Khai báo PreToolUse hook trả về permissionDecision "deny"',
      'Thêm một rule trong .claude/rules/',
      'Đặt permissionMode: "plan" cho cả phiên',
    ],
    answerIndex: 1,
    explanation:
      'CLAUDE.md và rule đều là context — Claude có thể không tuân. Hook chạy ở tầng thực thi nên chặn được bất kể model quyết định gì. plan mode chỉ là read-only tạm thời, không phải chính sách lâu dài cho Bash.',
  },
  {
    id: 'q-cc-02',
    conceptId: 'cc-rules-paths',
    domain: 'claude-code-config',
    difficulty: 'medium',
    question:
      'Một rule có frontmatter `paths: ["mcp-server/src/**/*.ts"]`. Khi nào nội dung của nó được nạp?',
    options: [
      'Mỗi lần khởi động phiên, giống CLAUDE.md',
      'Chỉ khi Claude làm việc với file khớp pattern đó',
      'Chỉ khi người dùng gõ /rule',
      'Không bao giờ, paths chỉ để tài liệu hoá',
    ],
    answerIndex: 1,
    explanation:
      'Đây là path-specific rule: chỉ nạp khi Claude chạm file khớp glob. Rule không có paths mới nạp lúc khởi động với cùng độ ưu tiên như .claude/CLAUDE.md.',
  },
  {
    id: 'q-cc-03',
    conceptId: 'cc-skills',
    domain: 'claude-code-config',
    difficulty: 'easy',
    question: 'Cấu trúc thư mục đúng cho một skill tên là daily-study?',
    options: [
      '.claude/skills/daily-study.md',
      '.claude/skills/daily-study/SKILL.md',
      '.claude/commands/daily-study/SKILL.md',
      '.claude/daily-study/SKILL.md',
    ],
    answerIndex: 1,
    explanation:
      'Skill nằm ở .claude/skills/<name>/SKILL.md — mỗi skill một thư mục để còn chỗ cho file phụ trợ. File lẻ trong .claude/commands/ vẫn tạo slash command nhưng không có thư mục đi kèm.',
  },
  {
    id: 'q-cc-04',
    conceptId: 'cc-skill-frontmatter',
    domain: 'claude-code-config',
    difficulty: 'hard',
    question:
      'Bạn đặt `allowed_tools:` (gạch dưới) trong frontmatter skill và thấy Claude vẫn hỏi quyền. Vì sao?',
    options: [
      'Vì allowed-tools không tồn tại trong Claude Code',
      'Vì tên field có gạch dưới nên bị bỏ qua; phải là `allowed-tools`',
      'Vì allowed-tools chỉ áp dụng cho subagent',
      'Vì cần thêm `permissions: allow` trong skill',
    ],
    answerIndex: 1,
    explanation:
      'Tên field của skill dùng dạng gạch nối, ví dụ allowed-tools; Claude Code bỏ qua field không nhận diện mà không báo lỗi. Vì vậy gõ sai tên là mất tác dụng trong im lặng — một lỗi rất dễ mắc.',
  },
  {
    id: 'q-cc-05',
    conceptId: 'cc-subagents-files',
    domain: 'claude-code-config',
    difficulty: 'medium',
    question:
      'Một file trong .claude/agents/ có frontmatter đúng cú pháp nhưng thiếu `description`. Chuyện gì xảy ra?',
    options: [
      'Subagent vẫn load, description lấy từ dòng đầu của body',
      'Claude Code bỏ qua file và ghi lý do vào debug log',
      'Claude Code báo lỗi đỏ ngay trong phiên',
      'Subagent load nhưng chỉ chạy được bằng lệnh gọi tay',
    ],
    answerIndex: 1,
    explanation:
      'name và description là bắt buộc; thiếu description thì file bị skip và lý do chỉ hiện trong debug log khi chạy --debug. Đây là lý do hay gặp của "tạo subagent rồi mà không thấy đâu".',
  },
  {
    id: 'q-cc-06',
    conceptId: 'cc-subagent-tools',
    domain: 'claude-code-config',
    difficulty: 'medium',
    question:
      'Bạn muốn một subagent chỉ đọc, tuyệt đối không sửa file. Cách nào chắc chắn nhất?',
    options: [
      'Viết "chỉ được đọc file" trong prompt của subagent',
      'Khai báo tools: Read, Grep, Glob (không có Write/Edit)',
      'Đặt permissionMode: plan cho phiên chính',
      'Đặt color: blue cho subagent',
    ],
    answerIndex: 1,
    explanation:
      'Thu hẹp tools là ràng buộc cấu trúc: công cụ ghi không tồn tại trong context của subagent. Prompt chỉ là hướng dẫn; plan mode của phiên chính không tự áp cho subagent; color chỉ là hiển thị.',
  },
  {
    id: 'q-cc-07',
    conceptId: 'cc-hooks-shape',
    domain: 'claude-code-config',
    difficulty: 'medium',
    question: 'Thứ tự lồng đúng khi khai báo hook trong settings.json?',
    options: [
      'hooks -> event -> matcher group -> handler',
      'hooks -> matcher -> event -> command',
      'event -> hooks -> command -> matcher',
      'matcher -> hooks -> event -> handler',
    ],
    answerIndex: 0,
    explanation:
      'Ba tầng: tên event (ví dụ PreToolUse), rồi matcher group (ví dụ "Bash"), rồi mảng handler với type và command/url. Matcher nằm ngoài, handler nằm trong.',
  },
  {
    id: 'q-cc-08',
    conceptId: 'cc-hooks-exit-codes',
    domain: 'claude-code-config',
    difficulty: 'easy',
    question: 'Hook PreToolUse exit 2 nghĩa là gì?',
    options: [
      'Hook lỗi, Claude Code bỏ qua và tiếp tục',
      'Tool call bị chặn, stderr trở thành lý do Claude nhìn thấy',
      'Tool call được tự động cho phép',
      'Phiên bị kết thúc ngay lập tức',
    ],
    answerIndex: 1,
    explanation:
      'Với các event có thể chặn như PreToolUse, exit 2 chặn hành động và stderr là thông điệp Claude nhận được. Exit 0 mới là "không có quyết định"; exit code khác 2 là lỗi không chặn.',
  },
  {
    id: 'q-cc-09',
    conceptId: 'cc-hooks-pretooluse-decision',
    domain: 'claude-code-config',
    difficulty: 'hard',
    question:
      'Hai hook PreToolUse cùng khớp một tool call: một hook trả "allow", một hook trả "deny". Kết quả?',
    options: [
      'Hook chạy trước thắng',
      'Hook chạy sau thắng',
      'deny thắng',
      'Claude Code báo lỗi xung đột và hỏi người dùng',
    ],
    answerIndex: 2,
    explanation:
      'Khi nhiều PreToolUse hook trả quyết định khác nhau, thứ tự ưu tiên là deny > defer > ask > allow. Thứ tự chạy không quyết định kết quả, nên deny luôn thắng.',
  },
  {
    id: 'q-cc-10',
    conceptId: 'cc-permission-modes',
    domain: 'claude-code-config',
    difficulty: 'hard',
    question:
      'Đồng nghiệp nói: "Cứ bật bypassPermissions là agent muốn làm gì thì làm." Điều gì vẫn chặn được agent?',
    options: [
      'Không gì cả, bypassPermissions bỏ toàn bộ kiểm tra',
      'Các deny rule trong permission settings',
      'Chỉ những tool bị đánh dấu readOnlyHint',
      'Chỉ khi chạy ở chế độ -p',
    ],
    answerIndex: 1,
    explanation:
      'Deny rule được đánh giá bất kể permission mode, kể cả bypassPermissions. Đây là lý do chính sách an toàn nên viết bằng deny rule (và hook) thay vì tin vào mode.',
  },

  // ── mcp-integration ──
  {
    id: 'q-mcp-01',
    conceptId: 'mcp-project-scope',
    domain: 'mcp-integration',
    difficulty: 'easy',
    question: 'File nào chia sẻ MCP server cho cả team qua git?',
    options: ['.mcp.json', '~/.claude.json', '.claude/settings.json', 'mcp.config.js'],
    answerIndex: 0,
    explanation:
      '.mcp.json ở gốc repo là scope project, commit được và mọi người nhận cùng cấu hình. ~/.claude.json là scope local/user; settings.json chỉ chứa bật/tắt và approve, không chứa định nghĩa server.',
  },
  {
    id: 'q-mcp-02',
    conceptId: 'mcp-transports',
    domain: 'mcp-integration',
    difficulty: 'medium',
    question: 'Entry MCP có `"url": "https://example.com/mcp"` nhưng không có `type`. Kết quả?',
    options: [
      'Claude Code tự suy ra http và kết nối bình thường',
      'Bị coi là stdio nên lỗi cấu hình và server bị bỏ qua',
      'Claude Code hỏi bạn chọn transport',
      'Entry bị đổi thành sse tự động',
    ],
    answerIndex: 1,
    explanation:
      'Entry không có type được đọc là stdio; một entry có url mà thiếu type là lỗi cấu hình và bị skip kèm cảnh báo. Phải ghi rõ "type": "http" (hoặc sse/ws).',
  },
  {
    id: 'q-mcp-03',
    conceptId: 'mcp-primitives',
    domain: 'mcp-integration',
    difficulty: 'medium',
    question: 'Ba primitive cốt lõi của MCP là gì?',
    options: [
      'tools, resources, prompts',
      'tools, hooks, skills',
      'resources, agents, sessions',
      'prompts, transports, roots',
    ],
    answerIndex: 0,
    explanation:
      'MCP chuẩn hoá tools (hành động model gọi), resources (dữ liệu đọc theo URI) và prompts (template người dùng chọn). hooks, skills, agents là khái niệm của Claude Code, không thuộc MCP.',
  },
  {
    id: 'q-mcp-04',
    conceptId: 'mcp-stdio-stdout',
    domain: 'mcp-integration',
    difficulty: 'hard',
    question: 'MCP server stdio của bạn thỉnh thoảng "chết" mà không có lỗi rõ ràng. Nghi phạm số một?',
    options: [
      'Server dùng zod phiên bản cũ',
      'Có lệnh console.log ghi ra stdout, làm hỏng JSON-RPC',
      'Thiếu khai báo env trong .mcp.json',
      'Tool trả về quá nhiều text',
    ],
    answerIndex: 1,
    explanation:
      'Với stdio, stdout là kênh JSON-RPC nên bất kỳ output lạ nào cũng phá protocol. Log phải đi qua stderr (console.error). Đây là lỗi kinh điển khi tự viết MCP server.',
  },
  {
    id: 'q-mcp-05',
    conceptId: 'mcp-env-expansion',
    domain: 'mcp-integration',
    difficulty: 'hard',
    question:
      'Bạn viết args: ["${CLAUDE_PROJECT_DIR}/mcp-server/dist/index.js"] trong .mcp.json và server không khởi động. Vì sao?',
    options: [
      'Vì args không hỗ trợ biến môi trường',
      'Vì CLAUDE_PROJECT_DIR được set trong môi trường server, nên cần default như ${CLAUDE_PROJECT_DIR:-.}',
      'Vì thiếu field type: "stdio"',
      'Vì đường dẫn phải là tuyệt đối, không dùng biến',
    ],
    answerIndex: 1,
    explanation:
      'CLAUDE_PROJECT_DIR được set trong môi trường của tiến trình server, không phải trong môi trường Claude Code dùng để expand. Vì vậy khi expand trong command/args phải kèm default. args hoàn toàn hỗ trợ biến, và type: "stdio" là tuỳ chọn.',
  },
  {
    id: 'q-mcp-06',
    conceptId: 'mcp-project-scope',
    domain: 'mcp-integration',
    difficulty: 'medium',
    question:
      'Cách chuẩn để bỏ bước hỏi approve cho các MCP server trong .mcp.json khi mở repo này?',
    options: [
      'Đặt enableAllProjectMcpServers: true trong .claude/settings.json',
      'Chmod 777 file .mcp.json',
      'Thêm server vào ~/.claude.json',
      'Chạy claude --dangerously-skip-permissions',
    ],
    answerIndex: 0,
    explanation:
      'enableAllProjectMcpServers (hoặc enabledMcpjsonServers để approve từng cái) là cách khai báo chính sách approve trong settings. Skip permissions là bỏ toàn bộ kiểm tra quyền — rộng hơn nhiều so với nhu cầu.',
  },
];

/** Tra cứu nhanh, dùng bởi các tool của MCP server. */
export const CONCEPT_BY_ID: ReadonlyMap<string, Concept> = new Map(
  CONCEPTS.map((concept) => [concept.id, concept])
);

export const QUIZ_BY_ID: ReadonlyMap<string, QuizItem> = new Map(
  QUIZ_ITEMS.map((item) => [item.id, item])
);
