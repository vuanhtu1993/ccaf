# Thiết Kế Chi Tiết: Lab Scenario 2 - Code Generation with Claude Code (100% Claude Ecosystem)
**Mã bài thi:** CCAR-F (Claude Certified Architect – Foundations)  
**Tác giả:** Anh Tú  
**Trạng thái:** Đã phê duyệt (Approved — Revision v2: Ports & Adapters + Claude Ecosystem)  
**Ngày lập:** 2026-11-06 | **Cập nhật:** 2026-11-12  

---

## 1. Intent & The Why (Mục đích & Bối cảnh ra đời)

### 1.1. Bối cảnh & Lý do ra đời (Root Cause)
Khi tích hợp công cụ lập trình tác tử như **Claude Code** vào quy trình phát triển phần mềm của cả một đội ngũ (Team Development Workflow), các kỹ sư thường gặp phải 4 rào cản kiến trúc lớn:
* **Sự phân mảnh cấu hình (Configuration Drift):** Các quy chuẩn viết code, kiểm thử và kiến trúc nếu lưu ở cấu hình cá nhân (`~/.claude/CLAUDE.md`) sẽ không thể chia sẻ qua Git cho thành viên mới; ngược lại, nếu nhồi nhét toàn bộ quy tắc của dự án lớn vào một file `CLAUDE.md` duy nhất ở thư mục gốc hoặc rải hàng chục file `CLAUDE.md` ở các thư mục con sẽ gây lãng phí token và làm loãng sự chú ý của mô hình.
* **Ô nhiễm ngữ cảnh phiên chính (Main Context Pollution):** Các tác vụ phân tích codebase diện rộng hoặc thử nghiệm ý tưởng (brainstorming) sinh ra lượng log khổng lồ. Nếu chạy trực tiếp trên luồng hội thoại chính, mô hình sẽ nhanh chóng rơi vào trạng thái **suy thoái ngữ cảnh (Context Degradation)** — bắt đầu trả lời chung chung theo "mẫu phổ biến" thay vì bám sát các class thực tế vừa khám phá.
* **Lựa chọn sai chế độ thực thi (Execution Mode Mismatch):** Áp dụng thực thi trực tiếp (*Direct Execution*) cho các đợt tái cấu trúc đa dịch vụ (45+ files) hoặc tính năng mới có nhiều phương án kiến trúc dẫn đến đập đi xây lại tốn kém; trong khi bật chế độ lập kế hoạch (*Plan Mode*) cho một lỗi nhỏ ở một hàm duy nhất lại gây độ trễ không cần thiết.
* **Khoảng cách giữa Cấu hình Tĩnh và Runtime SDK:** Ở bản thiết kế v1 (thời `strands-harness-sdk`), bài lab chỉ dừng lại ở mức mô phỏng chuỗi tĩnh trong bộ nhớ mà chưa kết nối với cấu hình đĩa thực tế và các tham số điều khiển chính thức của **`@anthropic-ai/sdk`** & **`@anthropic-ai/claude-agent-sdk`** (`settingSources`, `skills`, `permissionMode: 'plan'`, `agents`, `forkSession`, `resume`, `mcpServers`, `PreToolUse` / `PostToolUse` Hooks).

Do đó, Lab Scenario 2 (v2) được tái thiết kế theo kiến trúc **Ports & Adapters (Hexagonal)** sử dụng **100% hệ sinh thái Claude**, đồng bộ hoàn toàn với [Scenario 1 Design](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/sources/superpowers/specs/2026-11-05-scenario-1-customer-support-design.md):
1. **Lõi Nghiệp vụ Thuần (`src/domain/` + `fixtures/`):** Đọc trực tiếp cấu hình thật trên đĩa trong `fixtures/` để kiểm chứng tất định (100% offline) toàn bộ phân cấp `CLAUDE.md`, quy tắc glob `paths`, kỹ năng `SKILL.md`, định tuyến chiến lược, tinh chỉnh lặp và vệ sinh phiên/ngữ cảnh.
2. **Part A — Claude Messages API Adapter (`src/adapters/messages-api.ts`):** Minh họa vòng lặp tinh chỉnh lặp (*Concrete I/O Examples*, *Interview Pattern*, *TDD Iteration*) và tái khởi tạo phiên kèm *Structured Summary* thông qua `@anthropic-ai/sdk` (kèm `ScriptedMockAnthropicClient` chạy offline).
3. **Part B — Claude Agent SDK Adapter (`src/adapters/agent-sdk.ts`):** Ánh xạ trực tiếp các cơ chế của Scenario 2 vào tham số `Options` chuẩn của `@anthropic-ai/claude-agent-sdk` (`settingSources`, `skills`, `permissionMode: 'plan'`, `planModeInstructions`, `agents: { explore }`, `resume`, `forkSession`, In-Process MCP Server kèm MCP Resources, và `PreToolUse` Hook bảo vệ `allowed-tools`).

### 1.2. Định nghĩa & Giải phẫu Khái niệm (Definition Anatomy)
> **Định nghĩa:** Một *Kiến trúc Quy trình Phát triển với Claude Code (Claude Code Development Workflow Architecture)* là một hệ thống cấu hình và điều phối phân tầng (Layered Configuration & Orchestration System) kết hợp bộ nhớ dự án mô-đun hóa 3 tầng (`CLAUDE.md` & `@import`), quy tắc kích hoạt có điều kiện theo đường dẫn (`.claude/rules/` với glob `paths`), kỹ năng cô lập ngữ cảnh (`.claude/skills/` với `context: fork` & `allowed-tools`), tích hợp MCP phân cấp (`.mcp.json` & MCP Resources), bộ định tuyến chế độ thực thi (*Plan Mode* vs *Direct Execution* + *Explore Subagent*) và quản lý vòng đời phiên (`--resume`, `fork_session`, *Scratchpad*, `/compact`, *State Manifest*) được vận hành thống nhất trên cả tầng Messages API và Claude Agent SDK.

* **Bộ nhớ phân cấp 3 tầng (`CLAUDE.md` & `@import`):** Phân tách rạch ròi cấu hình cá nhân (`~/.claude/CLAUDE.md`), cấu hình dự án chia sẻ qua Git (`.claude/CLAUDE.md` / `CLAUDE.md`) và cấu hình cấp thư mục gói (`packages/<pkg>/CLAUDE.md`), dùng `@import` để nạp có chọn lọc tài liệu tiêu chuẩn và dùng `/memory` để kiểm chứng thực tế những file nào đang hiệu lực.
* **Quy tắc kích hoạt theo đường dẫn (Path-Scoped Rules):** Các file quy tắc trong `.claude/rules/*.md` khai báo YAML frontmatter `paths: [...]` giúp chỉ nạp quy ước khi thao tác trên tệp khớp mẫu glob (ví dụ `**/*.test.ts`), giải quyết triệt để bài toán quy ước rải rác toàn repo mà không cần nhân bản `CLAUDE.md` ở từng thư mục con.
* **Kỹ năng cô lập & Biến thể cá nhân (`.claude/skills/` & `~/.claude/skills/`):** Đóng gói quy trình theo nhu cầu kèm `context: fork` (chống ô nhiễm ngữ cảnh chính), `allowed-tools` (chống thao tác hủy hoại qua `PreToolUse` Hook), `argument-hint` (nhắc tham số thiếu), đồng thời cho phép tạo biến thể cá nhân ở `~/.claude/skills/` dưới **tên gọi khác** để không ảnh hưởng đồng đội.
* **Tích hợp MCP & Resources (`.mcp.json`, `~/.claude.json`, MCP Resources):** Tách server chia sẻ nhóm (`.mcp.json` dùng `${ENV_VAR}`) khỏi server thử nghiệm cá nhân (`~/.claude.json`), cung cấp **MCP Resources** để Agent nắm danh mục dữ liệu ngay không cần dò tìm nhiều lượt, viết mô tả MCP tool đủ chi tiết để Agent ưu tiên MCP thay vì quay về dùng `Grep`, và chọn Community MCP Server cho công cụ chuẩn (GitHub/Jira) thay vì tự code lại.
* **Định tuyến thực thi (*Plan Mode* vs *Direct Execution*):** Đánh giá phạm vi file, tác động kiến trúc và số lượng phương án hợp lệ để chọn *Direct Execution* (lỗi nhỏ 1 file), *Plan Mode* (tính năng mới có nhiều phương án hợp lệ) hoặc mô hình lai *Plan -> Direct* kết hợp *Explore Subagent*.
* **Bảo toàn ngữ cảnh & Quản lý phiên:** Phát hiện *Context Degradation*, duy trì *Scratchpad* qua `/compact`, xuất/nhập *State Manifest* để *Crash Recovery*, truyền tóm tắt giữa các pha (*Phase Summary Injection*), rẽ nhánh *`forkSession`*, và quyết định giữa `--resume` (kèm danh sách file đổi) với phiên mới kèm *Structured Summary* khi kết quả tool cũ đã lỗi thời (*stale*).

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals (Mục tiêu bắt buộc)
1. Hiện thực hóa trọn vẹn hành trình **5 Hồi** của đội ngũ **NovaSmart Platform Engineering** (Tech Lead **Minh Lê** và Junior Developer **Lan Phạm**).
2. Bao phủ **100% các Task Statements** của Đề thi CCA-F thuộc **Scenario 2** và **Exercise 2**:
   * **Domain 3 (Trọng tâm):**
     * **Task 3.1:** Phân cấp `CLAUDE.md` 3 tầng (User `~/.claude/CLAUDE.md`, Project `.claude/CLAUDE.md`, Directory `packages/*/CLAUDE.md`), cú pháp `@import` đọc file thật từ đĩa, `.claude/rules/` và lệnh `/memory`.
     * **Task 3.2:** Custom slash commands (`.claude/commands/` vs `~/.claude/commands/`), Skills (`.claude/skills/*/SKILL.md` với `context: fork`, `allowed-tools`, `argument-hint`), biến thể cá nhân ở `~/.claude/skills/` với tên khác, và phân biệt khi nào dùng `CLAUDE.md` (luôn nạp) vs Skill (nạp theo nhu cầu).
     * **Task 3.3:** Quy tắc theo đường dẫn (`.claude/rules/` với YAML frontmatter `paths` glob patterns) và ưu thế so với `CLAUDE.md` cấp thư mục con cho các quy ước trải rộng nhiều thư mục.
     * **Task 3.4:** Tiêu chí chọn *Plan Mode* vs *Direct Execution* trên cả 3 tình huống của Exercise 2 (sửa lỗi 1 file, di trú thư viện 45+ files, tính năng mới có nhiều phương án hợp lệ), sử dụng *Explore Subagent* và mô hình lai (Plan -> Direct Execute).
     * **Task 3.5:** 4 kỹ thuật tinh chỉnh lặp (*Iterative Refinement*): 2–3 ví dụ I/O cụ thể, *Test-Driven Iteration* (kèm edge case `null`), *Interview Pattern*, và chiến lược gom lỗi tương tác (1 message) vs tách lỗi độc lập (tuần tự).
   * **Domain 5 (Trọng tâm):**
     * **Task 5.4:** Quản lý ngữ cảnh trong codebase lớn: nhận diện *Context Degradation*, `Scratchpad`, ủy quyền `Explore` subagent, lệnh `/compact`, xuất/nhập *State Manifest* cho *Crash Recovery*, và tóm tắt kết quả pha 1 bơm vào ngữ cảnh đầu vào pha 2.
   * **Domain 1 & Domain 2 (Giao thoa trong Exercise 2):**
     * **Task 1.7:** Quản lý phiên với `--resume <session-name>`, tạo nhánh song song với `fork_session` (`forkSession: true`), báo file thay đổi khi resume vs khởi tạo phiên mới kèm *Structured Summary* khi `priorToolResultsStale === true`.
     * **Task 2.4:** Tích hợp MCP server cấp dự án (`.mcp.json` kèm `${GITHUB_TOKEN}`) và cấp cá nhân (`~/.claude.json`) hoạt động đồng thời; **MCP Resources** phơi bày danh mục dữ liệu; **MCP Tool Description** chi tiết tránh Agent rơi về dùng `Grep`; chọn Community MCP vs Custom MCP.
3. Cung cấp bộ **7 Vitest Test Suites (100% offline)**, **Interactive CLI (`src/cli.ts`)** và **Storyline Runner (`run-story.ts`)** hỗ trợ cả 2 chế độ `--adapter=api` và `--adapter=sdk`.

### 2.2. Non-Goals (Không thuộc phạm vi bài lab)
* Không sử dụng framework bên thứ ba (không dùng `strands-harness-sdk`, LangChain hay LlamaIndex); sử dụng 100% `@anthropic-ai/sdk` và `@anthropic-ai/claude-agent-sdk`.
* Không phụ thuộc kết nối mạng tới GitHub/Jira MCP server thật khi chạy unit test offline.

### 2.3. Anti-Goals (Các điều cấm kỵ / Bẫy thiết kế cần tránh trong kỳ thi CCA-F)
* **Anti-pattern 1 (Task 3.1):** Đặt quy chuẩn chung của nhóm vào `~/.claude/CLAUDE.md` khiến thành viên mới clone repo về không nhận được hướng dẫn.
* **Anti-pattern 2 (Task 3.3):** Tạo hàng chục file `CLAUDE.md` ở từng thư mục con cho các quy ước áp dụng theo loại file nằm rải rác (như `**/*.test.ts`) thay vì dùng một file `.claude/rules/testing.md` với `paths`.
* **Anti-pattern 3 (Task 2.4):** Hardcode token bí mật trong `.mcp.json` thay vì `${GITHUB_TOKEN}`; hoặc viết mô tả MCP tool quá sơ sài khiến Agent quay sang dùng `Grep`; hoặc tự viết Custom MCP server cho các tích hợp chuẩn như Jira/GitHub đã có Community MCP server.
* **Anti-pattern 4 (Task 3.2):** Chạy skill phân tích sinh nhiều log trực tiếp trên luồng chính mà không bật `context: fork`; hoặc sửa thẳng skill dùng chung của team cho sở thích cá nhân thay vì tạo biến thể tên khác trong `~/.claude/skills/`.
* **Anti-pattern 5 (Task 3.4):** Dùng *Direct Execution* cho đợt di trú 45+ files hoặc tính năng có nhiều hướng kiến trúc; hoặc dùng *Plan Mode* cho một chỉnh sửa nhỏ đã có stack trace rõ ràng ở 1 file.
* **Anti-pattern 6 (Task 1.7 & 5.4):** Tiếp tục `--resume` một phiên cũ có kết quả tool đã lỗi thời (*stale tool results*) sau khi nhiều file đã sửa đổi, hoặc resume sau sửa đổi nhỏ mà không báo danh sách file vừa đổi cho Agent.

---

## 3. Technical Approaches & Trade-offs

| Tiêu chí | Phương án 1: Bộ File Cấu hình Tĩnh | Phương án 2: Mô phỏng TS thuần (v1 cũ) | Phương án 3: Ports & Adapters + Real Disk Fixtures (Được chọn) |
| :--- | :--- | :--- | :--- |
| **Mô tả** | Chỉ tạo file mẫu `.claude/`, `CLAUDE.md` | Hàm TS giả lập chuỗi trong bộ nhớ, không nối SDK | Lõi `src/domain/` đọc `fixtures/` thật trên đĩa + Part A (`@anthropic-ai/sdk`) + Part B (`@anthropic-ai/claude-agent-sdk`) |
| **Kiểm chứng cấu hình thật** | Không tự test được | Dữ liệu test tách rời với `fixtures/` | **Tuyệt đối: Domain engine đọc và parse trực tiếp từ `fixtures/` trên đĩa** |
| **Ánh xạ Agent SDK thật** | Không có | Không có | **Có: Dùng thẳng `Options`, `settingSources`, `skills`, `permissionMode: 'plan'`, `agents`, `forkSession`, `createSdkMcpServer`, `PreToolUse` Hook** |
| **Tính nhất quán Repo** | Lệch pha Scenario 1 | Lệch pha Scenario 1 | **Đồng bộ 100% với cấu trúc `labs/scenario-1/` (Domain + Adapters + CLI + Story)** |

---

## 4. Architectural Design (Kiến trúc Chi tiết)

### 4.1. Cấu trúc thư mục dự án (`labs/scenario-2/`)

```
labs/scenario-2/
├── README.md                                     # Definition Anatomy, Mermaid, Bảng CCAF & 5 câu MCQ
├── package.json                                  # Dependencies (@anthropic-ai/sdk, @anthropic-ai/claude-agent-sdk, zod)
├── tsconfig.json                                 # TypeScript NodeNext strict config
├── vitest.config.ts                              # Vitest config độc lập
├── fixtures/                                     # BỘ CẤU HÌNH THỰC TẾ TRÊN ĐĨA (NovaSmart Platform)
│   ├── CLAUDE.md                                 # Project-level CLAUDE.md dùng @import
│   ├── .mcp.json                                 # Project MCP config (github, jira) dùng ${ENV_VAR}
│   ├── docs/
│   │   └── standards/
│   │       ├── error-handling.md                 # Chuẩn StructuredError được @import
│   │       └── security.md                       # Chuẩn bảo mật & không hardcode secret
│   ├── packages/
│   │   └── payment/
│   │       └── CLAUDE.md                         # Directory-level CLAUDE.md với @import riêng của package
│   ├── .claude/
│   │   ├── rules/
│   │   │   ├── testing.md                        # YAML frontmatter paths: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]
│   │   │   ├── api-conventions.md                # YAML frontmatter paths: ["src/api/**/*"]
│   │   │   └── terraform.md                      # YAML frontmatter paths: ["terraform/**/*"]
│   │   ├── commands/
│   │   │   └── review-pr.md                      # Project-scoped slash command
│   │   └── skills/
│   │       └── codebase-audit/
│   │           └── SKILL.md                      # context: fork, allowed-tools: [Read, Grep, Glob], argument-hint
│   └── user-home/                                # Thư mục giả lập ~/.claude & ~/.claude.json của dev
│       ├── .claude.json                          # Personal/experimental MCP server (local-sqlite)
│       └── .claude/
│           ├── CLAUDE.md                         # User-level CLAUDE.md (bẫy onboarding)
│           ├── commands/
│           │   └── my-notes.md                   # User-scoped slash command
│           └── skills/
│               └── my-audit-lite/
│                   └── SKILL.md                  # Personal skill variant (tên khác để không ảnh hưởng team)
├── src/
│   ├── cli.ts                                    # Interactive Terminal REPL (:adapter api/sdk, :memory, :act1..:act5)
│   ├── domain/                                   # LÕI NGHIỆP VỤ THUẦN (Đọc fixtures/, chạy 100% offline)
│   │   ├── types.ts                              # Toàn bộ kiểu Config, Rules, Skills, MCP, Routing, Refinement, Session
│   │   ├── config-resolver.ts                    # Act 1: 3-tier CLAUDE.md, @import từ đĩa, glob rules, /memory, MCP + Resources
│   │   ├── skill-command-engine.ts               # Act 2: Commands & Skills parser, allowed-tools guard, context: fork, personal variant
│   │   ├── execution-router.ts                   # Act 3: Plan Mode vs Direct Execution (3 kịch bản) & Explore Subagent
│   │   ├── refinement-coach.ts                   # Act 4: Concrete I/O, Interview Pattern, TDD (null edge case), Issue Batcher
│   │   ├── session-context-manager.ts            # Act 5: Degradation, Scratchpad, /compact, StateManifest, Phase Summary, fork/resume
│   │   └── session-inspector.ts                  # Diagnostic box phân tách LLM Context Window vs Config/Harness State
│   └── adapters/                                 # HAI BỘ CHUYỂN ĐỔI 100% HỆ SINH THÁI CLAUDE
│       ├── messages-api.ts                       # Part A: @anthropic-ai/sdk loop cho Act 4 Refinement & ScriptedMockAnthropicClient
│       └── agent-sdk.ts                          # Part B: @anthropic-ai/claude-agent-sdk Options, Explore AgentDefinition,
│                                                 #         In-Process MCP Server (Tools + Resources) & PreToolUse allowed-tools Hook
├── __tests__/                                    # BỘ KIỂM THỬ VITEST KATA (7 Test Suites — 100% Offline)
│   ├── task-1-sanity.test.ts                     # Kiểm tra fixtures trên đĩa & cấu trúc domain
│   ├── act-1-config-hierarchy-rules.test.ts      # Task 3.1, 3.3, 2.4 (3-tier, @import, glob rules, MCP Resources & Selection)
│   ├── act-2-commands-skills-fork.test.ts        # Task 3.2 (commands, SKILL.md fork/allowed-tools/argument-hint, personal variant)
│   ├── act-3-plan-vs-direct-mode.test.ts         # Task 3.4 (3 kịch bản Plan vs Direct + Explore subagent)
│   ├── act-4-iterative-refinement.test.ts        # Task 3.5 (I/O examples, Interview, TDD null case, interacting vs independent)
│   ├── act-5-session-context-hygiene.test.ts     # Task 5.4 & 1.7 (Degradation, Scratchpad, /compact, StateManifest, fork, resume)
│   └── adapters.test.ts                          # Kiểm chứng Part A (Messages API Mock Loop) & Part B (Agent SDK Options & Hooks)
└── run-story.ts                                  # Storyline Runner 5 Hồi (--adapter=api hoặc --adapter=sdk)
```

### 4.2. Thiết kế chi tiết 5 Hồi & Ánh xạ Adapters

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Minh Lê & Lan Phạm
    participant Domain as Domain Engine (src/domain/)
    participant PartA as Part A: Messages API Adapter
    participant PartB as Part B: Claude Agent SDK Adapter

    Note over Dev, PartB: Hồi 1: Phân cấp CLAUDE.md 3 tầng, Glob Rules & MCP Integration (Task 3.1, 3.3, 2.4)
    Dev->>Domain: Chẩn đoán Lan Phạm thiếu rule (do để ở user ~/.claude/CLAUDE.md)
    Domain-->>Dev: Chuyển sang project CLAUDE.md + @import + packages/payment/CLAUDE.md; kiểm tra /memory
    Dev->>Domain: Sửa "src/api/orders.test.ts" -> Khớp glob testing.md & api-conventions.md (Bỏ qua terraform.md)
    Dev->>PartB: Cấu hình settingSources=['user','project'], .mcp.json (${GITHUB_TOKEN}) + MCP Resources & Tool Descriptions

    Note over Dev, PartB: Hồi 2: Custom Commands & Isolated Skills (Task 3.2)
    Dev->>Domain: Gọi codebase-audit thiếu tham số -> Nhắc argument-hint; thử gọi Bash -> Chặn bởi allowed-tools
    Dev->>PartB: PreToolUse Hook thực thi kiểm soát allowed-tools; skills=['codebase-audit'] chạy với context: fork
    Dev->>Domain: Lan tạo biến thể cá nhân ở ~/.claude/skills/my-audit-lite/SKILL.md (tên khác, không ảnh hưởng team)

    Note over Dev, PartB: Hồi 3: Plan Mode vs Direct Execution & Explore Subagent (Task 3.4)
    Dev->>Domain: (1) Bug 1 file có stack trace -> direct_execution | (2) Di trú 48 files -> plan_then_direct + Explore
    Dev->>Domain: (3) Tính năng mới nhiều phương án kiến trúc -> plan_mode + Explore Subagent
    Dev->>PartB: buildScenario2AgentSdkOptions({ mode: 'plan_mode' }) -> permissionMode='plan' + agents.explore (Read/Grep/Glob)

    Note over Dev, PartB: Hồi 4: Tinh chỉnh Lặp — I/O Examples, Interview, TDD & Batching (Task 3.5)
    Dev->>Domain: Đóng gói >=2 I/O examples, Interview prompt ("DO NOT write code yet"), TDD null edge case, gom lỗi tương tác
    Dev->>PartA: Chạy vòng lặp Messages API thực thi Interview Pattern & TDD Loop (hỗ trợ ScriptedMockAnthropicClient offline)

    Note over Dev, PartB: Hồi 5: Vệ sinh Ngữ cảnh, Crash Recovery & Quản lý Phiên (Task 5.4, 1.7)
    Dev->>Domain: Phát hiện Context Degradation -> Ghi Scratchpad + /compact + Export StateManifest (Crash Recovery)
    Dev->>PartB: forkSession: true so sánh 2 chiến lược; --resume (kèm file diff) khi valid vs phiên mới + StructuredSummary khi stale
```

---

## 5. Danh mục Yêu cầu Cốt lõi (Implementation Checklist)

1. **Khởi tạo Package & Disk Fixtures (`labs/scenario-2/`):** Độc lập `package.json`, `tsconfig.json`, `vitest.config.ts` và bộ file thật trong `fixtures/`.
2. **Domain Module 1 (`config-resolver.ts`):** Đọc file thật từ `fixtures/`, chẩn đoán onboarding gap, giải mã `@import` từ đĩa, lọc `.claude/rules/*.md` theo glob `paths` (chứng minh ưu thế hơn nhân bản subdir `CLAUDE.md`), `/memory` inspector, hợp nhất `.mcp.json` + `~/.claude.json` kèm kiểm tra biến môi trường thiếu, phân tích **MCP Resources**, đánh giá **MCP Tool Description vs `Grep`**, và phân định **Community vs Custom MCP**.
3. **Domain Module 2 (`skill-command-engine.ts`):** Phân giải `.claude/commands/` vs `~/.claude/commands/`, đọc `SKILL.md` (`context: fork`, `allowed-tools`, `argument-hint`), chặn tool trái phép bằng `UnauthorizedSkillToolError`, cô lập log verbose trong fork, và khuyến nghị cơ chế (bao gồm biến thể cá nhân ở `~/.claude/skills/` với tên khác).
4. **Domain Module 3 (`execution-router.ts`):** Định tuyến chính xác cả 3 trường hợp của Exercise 2 (`direct_execution`, `plan_then_direct`, `plan_mode`) và bật `useExploreSubagent` khi cần khảo sát diện rộng.
5. **Domain Module 4 (`refinement-coach.ts`):** Đủ 4 kỹ thuật tinh chỉnh lặp (I/O examples >= 2, Interview Pattern, TDD với `null` edge case, gom lỗi tương tác vs tách lỗi độc lập).
6. **Domain Module 5 (`session-context-manager.ts` & `session-inspector.ts`):** Phát hiện *Context Degradation*, `Scratchpad`, `/compact`, `StateManifest` (export/load cho Crash Recovery), *Phase Summary Injection* (pha 1 -> pha 2), `forkSession`, và `decideSessionResumption` (`--resume` + file changes vs fresh + `StructuredSummary` khi stale).
7. **Dual Adapters (`messages-api.ts` & `agent-sdk.ts`):** Part A chạy `Anthropic` / `ScriptedMockAnthropicClient` cho vòng lặp tinh chỉnh; Part B tạo chuẩn `Options` của `@anthropic-ai/claude-agent-sdk`, In-Process MCP Server (tools + resource catalog) và `PreToolUse` Hook cho `allowed-tools`.
8. **CLI, Storyline Runner, Tests & Docs:** Hoàn thiện `cli.ts`, `run-story.ts`, 7 test suites Vitest, `README.md` và cập nhật `package.json` gốc.

---
*Made by Anh Tu - Share to be share*
