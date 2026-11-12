# Scenario 2: Code Generation with Claude Code — Implementation Plan (100% Claude Ecosystem)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh bài lab thực hành Scenario 2 (Code Generation with Claude Code) theo chuẩn đề thi CCA-F (Claude Certified Architect – Foundations) bằng **100% hệ sinh thái Claude** theo kiến trúc **Ports & Adapters**: bộ cấu hình đĩa thực tế (`fixtures/`), lõi nghiệp vụ thuần (`src/domain/`), Part A Messages API Adapter (`@anthropic-ai/sdk`), Part B Claude Agent SDK Adapter (`@anthropic-ai/claude-agent-sdk`), 7 bộ kiểm thử Vitest (100% offline), Interactive CLI (`src/cli.ts`) và Storyline Runner (`run-story.ts`).

**Architecture:** Kết hợp bộ file cấu hình thật trên đĩa của dự án NovaSmart (`CLAUDE.md`, `packages/payment/CLAUDE.md`, `@import`, `.claude/rules/*.md` với YAML frontmatter `paths`, `.claude/commands/`, `.claude/skills/*/SKILL.md` với `context: fork`, `.mcp.json`) với lõi đánh giá tất định (`src/domain/`) và hai bộ chuyển đổi chính thức (`src/adapters/messages-api.ts` cho tinh chỉnh lặp và `src/adapters/agent-sdk.ts` ánh xạ trực tiếp `Options`, `AgentDefinition`, `createSdkMcpServer` và `PreToolUse` Hook). Toàn bộ được kiểm chứng offline qua 7 test suites Vitest và diễn họa 5 Hồi của Tech Lead Minh Lê & Junior Dev Lan Phạm.

**Tech Stack:** TypeScript (ESM, NodeNext), `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `zod`, `vitest`, `tsx`.

**Spec:** [sources/superpowers/specs/2026-11-06-scenario-2-code-generation-design.md](file:///Users/anhtus/Documents/Development/anthropics/CCA-F/sources/superpowers/specs/2026-11-06-scenario-2-code-generation-design.md)

---

## Global Constraints

- Tuyệt đối không dùng framework bên thứ ba (`strands-harness-sdk`, LangChain, LlamaIndex); dùng 100% `@anthropic-ai/sdk` và `@anthropic-ai/claude-agent-sdk`.
- Không đặt các quy chuẩn dùng chung của đội ngũ vào `~/.claude/CLAUDE.md` (user-level); bắt buộc đặt tại `.claude/CLAUDE.md` hoặc `CLAUDE.md` cấp dự án và `packages/<pkg>/CLAUDE.md` cấp thư mục gói để chia sẻ qua Git.
- Không tạo hàng loạt file `CLAUDE.md` ở từng thư mục con cho các quy ước theo loại file nằm rải rác (như `*.test.ts`); bắt buộc dùng `.claude/rules/*.md` với YAML frontmatter `paths` chứa mẫu glob.
- Không lưu cứng (hardcode) chuỗi bí mật trong `.mcp.json`; bắt buộc dùng cú pháp mở rộng biến môi trường `${ENV_VAR}`. Phải hỗ trợ MCP Resources để giảm lượt gọi tool thăm dò và viết mô tả MCP tool đủ chi tiết để Agent ưu tiên MCP thay vì `Grep`.
- Các kỹ năng (`SKILL.md`) sinh ra dữ liệu phân tích dài hoặc mang tính thử nghiệm bắt buộc phải khai báo `context: fork` và giới hạn `allowed-tools` (được cưỡng chế ở cả Domain Engine lẫn `PreToolUse` Hook trong Agent SDK Adapter). Tùy biến cá nhân phải đặt ở `~/.claude/skills/` với tên gọi khác để không ảnh hưởng đồng đội.
- Không dùng *Direct Execution* cho các tác vụ tái cấu trúc lớn (45+ files) hoặc tính năng mới có nhiều phương án kiến trúc hợp lệ; bắt buộc định tuyến qua *Plan Mode* (`permissionMode: 'plan'`) kết hợp *Explore Subagent*.
- Khi các kết quả công cụ trong phiên cũ đã lỗi thời (*stale tool results*) sau đợt sửa đổi lớn, không được dùng `--resume` mù quáng mà phải khởi tạo phiên mới kèm *Structured Summary*. Khi cần thử song song 2 hướng từ cùng baseline, sử dụng `forkSession: true`.

## Review Focus

1. **Biến môi trường trong `.mcp.json` chưa được khai báo trên hệ thống (Missing Env Var in MCP Config):** `resolveMcpServers` phải phát hiện biến `${GITHUB_TOKEN}` bị thiếu và ghi nhận vào `missingEnvVars` kèm cảnh báo thay vì giữ nguyên chuỗi literal `${GITHUB_TOKEN}` làm token xác thực (kiểm thử tại Task 2).
2. **Skill được gọi thiếu tham số bắt buộc (Missing Skill Arguments):** Khi gọi skill có cấu hình `argument-hint` mà truyền chuỗi rỗng/khoảng trắng, `executeSkill` phải trả về trạng thái `missing_arguments` kèm `promptHint` khớp `argument-hint` thay vì chạy mù quáng (kiểm thử tại Task 3).
3. **Skill cố tình gọi công cụ hủy hoại ngoài danh sách cho phép (Unauthorized Tool Call in Skill):** Khi `allowed-tools: ["Read", "Grep", "Glob"]`, mọi nỗ lực gọi `Bash` hoặc `Write` phải bị chặn cứng bằng `UnauthorizedSkillToolError` ở Domain Engine (Task 3) và `permissionDecision: 'deny'` tại `PreToolUse` Hook ở Agent SDK Adapter (Task 8).
4. **Script di trú dữ liệu gặp giá trị `null` ở trường bắt buộc (Null Edge Case in Iterative Refinement):** `buildTddIterationPrompt` phải đóng gói log lỗi test và test case biên chứa `null` để dẫn dắt vòng lặp TDD sửa dứt điểm (kiểm thử tại Task 5).
5. **Tiếp tục phiên làm việc cũ sau khi 15+ files đã bị sửa bên ngoài (Stale Session Resumption):** `SessionContextManager.decideSessionResumption` phải từ chối `--resume` trực tiếp khi `priorToolResultsStale === true` và yêu cầu khởi tạo phiên mới kèm `StructuredSummary` (kiểm thử tại Task 6).

---

## Cấu trúc thư mục dự kiến (`labs/scenario-2/`)

```
labs/scenario-2/
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── fixtures/
│   ├── CLAUDE.md
│   ├── .mcp.json
│   ├── docs/
│   │   └── standards/
│   │       ├── error-handling.md
│   │       └── security.md
│   ├── packages/
│   │   └── payment/
│   │       └── CLAUDE.md
│   ├── .claude/
│   │   ├── rules/
│   │   │   ├── testing.md
│   │   │   ├── api-conventions.md
│   │   │   └── terraform.md
│   │   ├── commands/
│   │   │   └── review-pr.md
│   │   └── skills/
│   │       └── codebase-audit/
│   │           └── SKILL.md
│   └── user-home/
│       ├── .claude.json
│       └── .claude/
│           ├── CLAUDE.md
│           ├── commands/
│           │   └── my-notes.md
│           └── skills/
│               └── my-audit-lite/
│                   └── SKILL.md
├── src/
│   ├── cli.ts
│   ├── domain/
│   │   ├── types.ts
│   │   ├── config-resolver.ts
│   │   ├── skill-command-engine.ts
│   │   ├── execution-router.ts
│   │   ├── refinement-coach.ts
│   │   ├── session-context-manager.ts
│   │   └── session-inspector.ts
│   └── adapters/
│       ├── messages-api.ts
│       └── agent-sdk.ts
├── __tests__/
│   ├── task-1-sanity.test.ts
│   ├── act-1-config-hierarchy-rules.test.ts
│   ├── act-2-commands-skills-fork.test.ts
│   ├── act-3-plan-vs-direct-mode.test.ts
│   ├── act-4-iterative-refinement.test.ts
│   ├── act-5-session-context-hygiene.test.ts
│   └── adapters.test.ts
└── run-story.ts
```

---

### Task 0: Khởi tạo Package `labs/scenario-2` & Cấu hình TypeScript / Vitest

**Files:**
- Create: `labs/scenario-2/package.json`
- Create: `labs/scenario-2/tsconfig.json`
- Create: `labs/scenario-2/vitest.config.ts`
- Modify: `package.json` (root — thêm scripts `lab:s2:*`)

- [ ] **Step 1: Tạo `labs/scenario-2/package.json`, `tsconfig.json` và `vitest.config.ts`**

`labs/scenario-2/package.json` dùng cấu trúc chuẩn giống `labs/scenario-1/package.json`:
```json
{
  "name": "cca-f-lab-scenario-2",
  "version": "0.1.0",
  "private": true,
  "description": "CCAF Scenario 2 Lab: Code Generation with Claude Code (Domain Engine + Messages API + Claude Agent SDK)",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "cli": "tsx --env-file=../../.env src/cli.ts",
    "cli:sdk": "tsx --env-file=../../.env src/cli.ts --adapter=sdk",
    "story:api": "tsx --env-file=../../.env run-story.ts --adapter=api",
    "story:sdk": "tsx --env-file=../../.env run-story.ts --adapter=sdk"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.312",
    "@anthropic-ai/sdk": "^0.39.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```
`labs/scenario-2/tsconfig.json` dùng `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `strict: true`, `include: ["src/**/*", "__tests__/**/*", "run-story.ts"]`.
`labs/scenario-2/vitest.config.ts` dùng `include: ['__tests__/**/*.test.ts']`, `environment: 'node'`.

- [ ] **Step 2: Cài đặt dependencies cho `labs/scenario-2` và cập nhật `package.json` gốc**

Thêm các script vào root `package.json`:
```json
"lab:s2:test": "npm --prefix labs/scenario-2 test",
"lab:s2:typecheck": "npm --prefix labs/scenario-2 run typecheck",
"lab:s2:cli": "npm --prefix labs/scenario-2 run cli",
"lab:s2:cli:sdk": "npm --prefix labs/scenario-2 run cli:sdk",
"lab:s2:story": "npm --prefix labs/scenario-2 run story:api",
"lab:s2:sdk": "npm --prefix labs/scenario-2 run story:sdk"
```
Run: `npm --prefix labs/scenario-2 install`
Expected: Cài đặt thành công không lỗi.

- [ ] **Step 3: Commit**
```bash
git add labs/scenario-2/package.json labs/scenario-2/tsconfig.json labs/scenario-2/vitest.config.ts package.json
git commit -m "chore(scenario-2): initialize package, typescript and vitest setup"
```

---

### Task 1: Định nghĩa Types & Tạo Bộ Cấu hình Đĩa Thực tế (`fixtures/` + `src/domain/types.ts`)

**Files:**
- Create: `labs/scenario-2/src/domain/types.ts`
- Create: `labs/scenario-2/fixtures/CLAUDE.md`
- Create: `labs/scenario-2/fixtures/docs/standards/error-handling.md`
- Create: `labs/scenario-2/fixtures/docs/standards/security.md`
- Create: `labs/scenario-2/fixtures/packages/payment/CLAUDE.md`
- Create: `labs/scenario-2/fixtures/.mcp.json`
- Create: `labs/scenario-2/fixtures/.claude/rules/testing.md`
- Create: `labs/scenario-2/fixtures/.claude/rules/api-conventions.md`
- Create: `labs/scenario-2/fixtures/.claude/rules/terraform.md`
- Create: `labs/scenario-2/fixtures/.claude/commands/review-pr.md`
- Create: `labs/scenario-2/fixtures/.claude/skills/codebase-audit/SKILL.md`
- Create: `labs/scenario-2/fixtures/user-home/.claude.json`
- Create: `labs/scenario-2/fixtures/user-home/.claude/CLAUDE.md`
- Create: `labs/scenario-2/fixtures/user-home/.claude/commands/my-notes.md`
- Create: `labs/scenario-2/fixtures/user-home/.claude/skills/my-audit-lite/SKILL.md`
- Test: `labs/scenario-2/__tests__/task-1-sanity.test.ts`

**Interfaces:**
- Produces: `ConfigScope`, `MemoryFileEntry`, `OnboardingDiagnosis`, `PathRule`, `McpServerConfig`, `McpResourceEntry`, `ResolvedMcpConfig`, `McpSelectionDiagnosis`, `SlashCommandSpec`, `SkillFrontmatter`, `SkillDefinition`, `SkillExecutionResult`, `CustomizationRecommendation`, `TaskComplexityProfile`, `ExecutionRouteDecision`, `IoExample`, `BugIssue`, `RefinementPlan`, `SessionTurn`, `StateManifest`, `PhaseHandoffContext`, `SessionForkBranch`, `SessionResumeDecision` in `src/domain/types.ts`.

- [ ] **Step 1: Write the failing sanity test**
```typescript
// labs/scenario-2/__tests__/task-1-sanity.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Task 1: Scenario 2 Real Disk Fixtures & Types Sanity', () => {
  it('should have 3-tier CLAUDE.md hierarchy with @import targets on disk', () => {
    const projectClaude = fs.readFileSync(path.join(fixturesDir, 'CLAUDE.md'), 'utf-8');
    const paymentClaude = fs.readFileSync(path.join(fixturesDir, 'packages/payment/CLAUDE.md'), 'utf-8');
    const userClaude = fs.readFileSync(path.join(fixturesDir, 'user-home/.claude/CLAUDE.md'), 'utf-8');
    const securityStd = fs.readFileSync(path.join(fixturesDir, 'docs/standards/security.md'), 'utf-8');

    expect(projectClaude).toContain('@import docs/standards/error-handling.md');
    expect(projectClaude).toContain('@import docs/standards/security.md');
    expect(paymentClaude).toContain('@import');
    expect(userClaude.length).toBeGreaterThan(10);
    expect(securityStd.length).toBeGreaterThan(10);
  });

  it('should have project .mcp.json with env var expansion and user-home .claude.json', () => {
    const projectMcp = fs.readFileSync(path.join(fixturesDir, '.mcp.json'), 'utf-8');
    const userMcp = fs.readFileSync(path.join(fixturesDir, 'user-home/.claude.json'), 'utf-8');

    expect(projectMcp).toContain('${GITHUB_TOKEN}');
    expect(userMcp).toContain('localSqlite');
  });

  it('should have path-scoped rules, project/user commands, and project/personal skills', () => {
    const testingRule = fs.readFileSync(path.join(fixturesDir, '.claude/rules/testing.md'), 'utf-8');
    const projectSkill = fs.readFileSync(path.join(fixturesDir, '.claude/skills/codebase-audit/SKILL.md'), 'utf-8');
    const personalSkill = fs.readFileSync(
      path.join(fixturesDir, 'user-home/.claude/skills/my-audit-lite/SKILL.md'),
      'utf-8'
    );
    const projectCmd = fs.readFileSync(path.join(fixturesDir, '.claude/commands/review-pr.md'), 'utf-8');

    expect(testingRule).toContain('paths:');
    expect(projectSkill).toContain('context: fork');
    expect(projectSkill).toContain('allowed-tools:');
    expect(projectSkill).toContain('argument-hint:');
    expect(personalSkill).toContain('context: fork');
    expect(projectCmd.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/task-1-sanity.test.ts`
Expected: FAIL (`ENOENT: no such file or directory`).

- [ ] **Step 3: Create `src/domain/types.ts` and all files inside `fixtures/`**
  - `src/domain/types.ts`: Định nghĩa toàn bộ kiểu dữ liệu thuần TypeScript cho 5 Hồi và 2 Adapters.
  - `fixtures/CLAUDE.md`: Quy chuẩn chung NovaSmart + `@import docs/standards/error-handling.md` & `@import docs/standards/security.md`.
  - `fixtures/packages/payment/CLAUDE.md`: Quy chuẩn riêng cho gói `payment` (PCI-DSS, idempotency keys) dùng `@import ../../docs/standards/security.md`.
  - `fixtures/.mcp.json`: Cấu hình `github` và `jira` community MCP servers dùng `${GITHUB_TOKEN}`, `${JIRA_API_TOKEN}`.
  - `fixtures/user-home/.claude.json`: Cấu hình `localSqlite` MCP server thử nghiệm cá nhân.
  - `fixtures/.claude/rules/`: `testing.md` (`["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]`), `api-conventions.md` (`["src/api/**/*"]`), `terraform.md` (`["terraform/**/*"]`).
  - `fixtures/.claude/skills/codebase-audit/SKILL.md` và `fixtures/user-home/.claude/skills/my-audit-lite/SKILL.md`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/task-1-sanity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/types.ts labs/scenario-2/fixtures/ labs/scenario-2/__tests__/task-1-sanity.test.ts
git commit -m "feat(scenario-2): add domain types and real disk fixtures for NovaSmart"
```

---

### Task 2: Hiện thực hóa Domain Module 1 — Config, Path Rules & MCP Resolver (`src/domain/config-resolver.ts`)

**Files:**
- Create: `labs/scenario-2/src/domain/config-resolver.ts`
- Create: `labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts`

**Interfaces:**
- Consumes: `ConfigScope`, `MemoryFileEntry`, `OnboardingDiagnosis`, `PathRule`, `McpResourceEntry`, `ResolvedMcpConfig`, `McpSelectionDiagnosis` from `./types.js`.
- Produces: `loadFixtureMemoryTree(fixturesRoot: string, activeSubdir?: string)`, `diagnoseOnboardingConfigGap(files: MemoryFileEntry[])`, `resolveImportsFromDisk(entryFilePath: string, rootDir: string)`, `resolveImports(claudeMdContent: string, availableFiles: Record<string, string>)`, `loadPathRulesFromDisk(rulesDir: string)`, `matchPathRules(targetFilePath: string, rules: PathRule[])`, `recommendConventionPlacement(options: { appliesAcrossMultipleDirs: boolean; filePattern?: string })`, `inspectLoadedMemory(files: MemoryFileEntry[], activeFilePath?: string, rules?: PathRule[])`, `resolveMcpServers(projectMcpJson: string, userClaudeJson: string, env: Record<string, string | undefined>)`, `loadMcpFromFixtures(fixturesRoot: string, env: Record<string, string | undefined>)`, `evaluateMcpToolDesign(tool: { name: string; description: string; resources?: McpResourceEntry[] })`, `recommendMcpBuildStrategy(integration: { isStandardTool: boolean; hasCommunityServer: boolean; isProprietaryTeamWorkflow: boolean })` in `src/domain/config-resolver.ts`.

- [ ] **Step 1: Write the failing test for Act 1 (`act-1-config-hierarchy-rules.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  loadFixtureMemoryTree,
  diagnoseOnboardingConfigGap,
  resolveImportsFromDisk,
  loadPathRulesFromDisk,
  matchPathRules,
  recommendConventionPlacement,
  inspectLoadedMemory,
  loadMcpFromFixtures,
  resolveMcpServers,
  evaluateMcpToolDesign,
  recommendMcpBuildStrategy,
} from '../src/domain/config-resolver.js';
import type { MemoryFileEntry } from '../src/domain/types.js';

const fixturesRoot = path.resolve(__dirname, '../fixtures');

describe('Act 1: CLAUDE.md 3-Tier Hierarchy, Path-Scoped Rules & MCP (Task 3.1, 3.3, 2.4)', () => {
  it('should diagnose onboarding gap when team standards live only in user-level ~/.claude/CLAUDE.md', () => {
    const files: MemoryFileEntry[] = [
      { path: '~/.claude/CLAUDE.md', scope: 'user', sharedViaGit: false, content: 'Always use Vitest.' },
    ];
    const diagnosis = diagnoseOnboardingConfigGap(files);
    expect(diagnosis.hasOnboardingGap).toBe(true);
    expect(diagnosis.reason).toContain('user-level');
    expect(diagnosis.recommendedAction).toContain('.claude/CLAUDE.md');
  });

  it('should load 3-tier hierarchy (user, project, directory) from fixtures and resolve @import from disk', () => {
    const tree = loadFixtureMemoryTree(fixturesRoot, 'packages/payment');
    expect(tree.map((f) => f.scope)).toEqual(['user', 'project', 'directory']);

    const resolvedRoot = resolveImportsFromDisk(path.join(fixturesRoot, 'CLAUDE.md'), fixturesRoot);
    expect(resolvedRoot).toContain('StructuredError');
    expect(resolvedRoot).not.toContain('@import docs/standards/error-handling.md');

    const memoryReport = inspectLoadedMemory(tree, 'src/api/orders.test.ts', loadPathRulesFromDisk(path.join(fixturesRoot, '.claude/rules')));
    expect(memoryReport.activeMemoryPaths.some((p) => p.endsWith('packages/payment/CLAUDE.md'))).toBe(true);
    expect(memoryReport.activeRuleNames).toEqual(['api-conventions.md', 'testing.md']);
  });

  it('should load only matching path-scoped rules from disk and prefer .claude/rules over subdirectory CLAUDE.md for cross-dir patterns', () => {
    const rules = loadPathRulesFromDisk(path.join(fixturesRoot, '.claude/rules'));
    const active = matchPathRules('src/api/orders.test.ts', rules);
    expect(active.map((r) => r.name).sort()).toEqual(['api-conventions.md', 'testing.md']);

    const placement = recommendConventionPlacement({ appliesAcrossMultipleDirs: true, filePattern: '**/*.test.ts' });
    expect(placement.mechanism).toBe('path_scoped_rule');
    expect(placement.avoidAntiPattern).toContain('subdirectory CLAUDE.md');
  });

  it('should merge project .mcp.json and user .claude.json from fixtures and flag missing env vars (Review Focus #1)', () => {
    const okResult = loadMcpFromFixtures(fixturesRoot, {
      GITHUB_TOKEN: 'ghp_test_123',
      JIRA_API_TOKEN: 'jira_test_456',
    });
    expect(okResult.servers.map((s) => s.name)).toEqual(['github', 'jira', 'localSqlite']);
    expect(okResult.missingEnvVars).toEqual([]);

    const missingResult = resolveMcpServers(
      JSON.stringify({ mcpServers: { github: { command: 'npx', args: ['-y', 'mcp-github'], env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' } } } }),
      JSON.stringify({ mcpServers: {} }),
      {}
    );
    expect(missingResult.missingEnvVars).toContain('GITHUB_TOKEN');
  });

  it('should validate MCP Resources usage, rich tool descriptions vs Grep, and community vs custom MCP selection (Task 2.4)', () => {
    const weakTool = evaluateMcpToolDesign({ name: 'search_issues', description: 'Search issues.' });
    expect(weakTool.risksFallingBackToGrep).toBe(true);
    expect(weakTool.needsResourcesCatalog).toBe(true);

    const strongTool = evaluateMcpToolDesign({
      name: 'search_jira_issues',
      description: 'Search NovaSmart Jira sprint issues with JQL filters, returning status, assignee, and linked PRs. Prefer over Grep for ticket tracking.',
      resources: [{ uri: 'jira://projects/novasmart/catalog', name: 'Sprint Issue Catalog', mimeType: 'application/json' }],
    });
    expect(strongTool.risksFallingBackToGrep).toBe(false);
    expect(strongTool.needsResourcesCatalog).toBe(false);

    expect(recommendMcpBuildStrategy({ isStandardTool: true, hasCommunityServer: true, isProprietaryTeamWorkflow: false })).toBe('community_mcp_server');
    expect(recommendMcpBuildStrategy({ isStandardTool: false, hasCommunityServer: false, isProprietaryTeamWorkflow: true })).toBe('custom_mcp_server');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-1-config-hierarchy-rules.test.ts`
Expected: FAIL (`Cannot find module '../src/domain/config-resolver.js'`).

- [ ] **Step 3: Implement `src/domain/config-resolver.ts`**
  - Đọc và phân tích YAML frontmatter `paths` trực tiếp từ `fixtures/.claude/rules/*.md`.
  - Giải mã `@import <rel-path>` đệ quy (có chống vòng lặp import) trực tiếp trên hệ thống tệp.
  - Hỗ trợ đầy đủ phân cấp 3 tầng (`user`, `project`, `directory`), lệnh `/memory`, gộp `.mcp.json` + `~/.claude.json`, và các hàm đánh giá Task 2.4 (MCP Resources, rich tool description vs `Grep`, Community vs Custom MCP).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-1-config-hierarchy-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/config-resolver.ts labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts
git commit -m "feat(scenario-2): implement disk-backed config hierarchy, glob rules and mcp resolver"
```

---

### Task 3: Hiện thực hóa Domain Module 2 — Skill & Slash Command Engine (`src/domain/skill-command-engine.ts`)

**Files:**
- Create: `labs/scenario-2/src/domain/skill-command-engine.ts`
- Create: `labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts`

**Interfaces:**
- Consumes: `SlashCommandSpec`, `SkillDefinition`, `SkillExecutionResult`, `CustomizationRecommendation` from `./types.js`.
- Produces: `UnauthorizedSkillToolError`, `loadSkillFromFile(filePath: string, scope: 'project' | 'user')`, `loadCommandsFromDir(commandsDir: string, scope: 'project' | 'user')`, `parseSkillMarkdown(rawMarkdown: string, name: string, scope: 'project' | 'user')`, `executeSkill(skill: SkillDefinition, args: string, requestedTools: string[], mainConversationLog: string[])`, `recommendCustomizationMechanism(requirement: { isUniversalStandard: boolean; producesVerboseOutput: boolean; isPersonalOverride: boolean; isQuickPromptShortcut?: boolean })` in `src/domain/skill-command-engine.ts`.

- [ ] **Step 1: Write the failing test for Act 2 (`act-2-commands-skills-fork.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  loadSkillFromFile,
  loadCommandsFromDir,
  executeSkill,
  recommendCustomizationMechanism,
  UnauthorizedSkillToolError,
} from '../src/domain/skill-command-engine.js';

const fixturesRoot = path.resolve(__dirname, '../fixtures');

describe('Act 2: Custom Slash Commands, Isolated Skills & Personal Variants (Task 3.2)', () => {
  it('should load real SKILL.md and commands from fixtures with project vs user scope', () => {
    const skill = loadSkillFromFile(path.join(fixturesRoot, '.claude/skills/codebase-audit/SKILL.md'), 'project');
    expect(skill.name).toBe('codebase-audit');
    expect(skill.frontmatter.context).toBe('fork');
    expect(skill.frontmatter.allowedTools).toEqual(['Read', 'Grep', 'Glob']);
    expect(skill.frontmatter.argumentHint).toBe('[target-dir] [focus-area]');

    const projectCmds = loadCommandsFromDir(path.join(fixturesRoot, '.claude/commands'), 'project');
    const userCmds = loadCommandsFromDir(path.join(fixturesRoot, 'user-home/.claude/commands'), 'user');
    expect(projectCmds.map((c) => ({ name: c.name, sharedViaGit: c.sharedViaGit }))).toEqual([
      { name: 'review-pr', sharedViaGit: true },
    ]);
    expect(userCmds.map((c) => ({ name: c.name, sharedViaGit: c.sharedViaGit }))).toEqual([
      { name: 'my-notes', sharedViaGit: false },
    ]);
  });

  it('should prompt developer with argument-hint when invoked without arguments (Review Focus #2)', () => {
    const skill = loadSkillFromFile(path.join(fixturesRoot, '.claude/skills/codebase-audit/SKILL.md'), 'project');
    const mainLog: string[] = ['User: Start session'];
    const result = executeSkill(skill, '   ', ['Read'], mainLog);

    expect(result.status).toBe('missing_arguments');
    expect(result.promptHint).toContain('[target-dir] [focus-area]');
  });

  it('should block tool calls not listed in allowed-tools (Review Focus #3)', () => {
    const skill = loadSkillFromFile(path.join(fixturesRoot, '.claude/skills/codebase-audit/SKILL.md'), 'project');
    expect(() => executeSkill(skill, 'src/payment security', ['Read', 'Bash'], [])).toThrow(
      UnauthorizedSkillToolError
    );
  });

  it('should isolate verbose output from main conversation when context: fork is active', () => {
    const skill = loadSkillFromFile(path.join(fixturesRoot, '.claude/skills/codebase-audit/SKILL.md'), 'project');
    const mainLog: string[] = ['User: Check payment module'];
    const result = executeSkill(skill, 'src/payment security', ['Read', 'Grep'], mainLog);

    expect(result.status).toBe('completed');
    expect(result.isolatedInFork).toBe(true);
    expect(mainLog.some((entry) => entry.includes('[VERBOSE_RAW_SCAN]'))).toBe(false);
    expect(mainLog.some((entry) => entry.includes('[Skill Summary: codebase-audit]'))).toBe(true);
  });

  it('should distinguish CLAUDE.md, project fork skills, and personal skill variants in ~/.claude/skills/ with different name', () => {
    expect(
      recommendCustomizationMechanism({
        isUniversalStandard: true,
        producesVerboseOutput: false,
        isPersonalOverride: false,
      }).mechanism
    ).toBe('project_claude_md');

    expect(
      recommendCustomizationMechanism({
        isUniversalStandard: false,
        producesVerboseOutput: true,
        isPersonalOverride: false,
      }).mechanism
    ).toBe('project_skill_with_fork');

    const personalRec = recommendCustomizationMechanism({
      isUniversalStandard: false,
      producesVerboseOutput: true,
      isPersonalOverride: true,
    });
    expect(personalRec.mechanism).toBe('personal_skill_variant');
    expect(personalRec.targetDirectory).toBe('~/.claude/skills/');
    expect(personalRec.mustUseDifferentName).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-2-commands-skills-fork.test.ts`
Expected: FAIL (`Cannot find module '../src/domain/skill-command-engine.js'`).

- [ ] **Step 3: Implement `src/domain/skill-command-engine.ts`**
  - Nạp skill và command thật từ đường dẫn đĩa trong `fixtures/`.
  - Kiểm tra `argumentHint`, ném `UnauthorizedSkillToolError` khi tool ngoài `allowedTools`, cô lập log `[VERBOSE_RAW_SCAN]` khi `context: 'fork'`, và khuyến nghị chính xác cơ chế tùy biến cá nhân (`~/.claude/skills/` với `mustUseDifferentName: true`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-2-commands-skills-fork.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/skill-command-engine.ts labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts
git commit -m "feat(scenario-2): implement disk-backed skill engine, allowed-tools guard and personal variants"
```

---

### Task 4: Hiện thực hóa Domain Module 3 — Execution Mode Router (`src/domain/execution-router.ts`)

**Files:**
- Create: `labs/scenario-2/src/domain/execution-router.ts`
- Create: `labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts`

**Interfaces:**
- Consumes: `TaskComplexityProfile`, `ExecutionRouteDecision` from `./types.js`.
- Produces: `selectExecutionStrategy(profile: TaskComplexityProfile)` in `src/domain/execution-router.ts`.

- [ ] **Step 1: Write the failing test for Act 3 (`act-3-plan-vs-direct-mode.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts
import { describe, it, expect } from 'vitest';
import { selectExecutionStrategy } from '../src/domain/execution-router.js';

describe('Act 3: Plan Mode vs Direct Execution & Explore Subagent (Task 3.4 & Exercise 2)', () => {
  it('Case 1: should select direct_execution for a single-file bug fix with clear stack trace', () => {
    const decision = selectExecutionStrategy({
      description: 'Add date validation check in parseOrderDate()',
      estimatedFilesAffected: 1,
      hasClearStackTrace: true,
      hasArchitecturalImplications: false,
      multipleValidApproaches: false,
      requiresBroadDiscovery: false,
    });

    expect(decision.mode).toBe('direct_execution');
    expect(decision.sdkPermissionMode).toBe('acceptEdits');
    expect(decision.useExploreSubagent).toBe(false);
  });

  it('Case 2: should select plan_then_direct and Explore subagent for a 48-file library migration', () => {
    const decision = selectExecutionStrategy({
      description: 'Migrate legacy JWT auth library across 48 service files',
      estimatedFilesAffected: 48,
      hasClearStackTrace: false,
      hasArchitecturalImplications: true,
      multipleValidApproaches: true,
      requiresBroadDiscovery: true,
    });

    expect(decision.mode).toBe('plan_then_direct');
    expect(decision.sdkPermissionMode).toBe('plan');
    expect(decision.useExploreSubagent).toBe(true);
    expect(decision.phases).toEqual([
      'explore_subagent_discovery',
      'plan_mode_alignment',
      'direct_execution_implementation',
    ]);
  });

  it('Case 3: should select plan_mode for a new feature touching only 3 files but with multiple valid architectural approaches', () => {
    const decision = selectExecutionStrategy({
      description: 'Add webhook retry mechanism (BullMQ vs SQS vs DB polling)',
      estimatedFilesAffected: 3,
      hasClearStackTrace: false,
      hasArchitecturalImplications: true,
      multipleValidApproaches: true,
      requiresBroadDiscovery: false,
    });

    expect(decision.mode).toBe('plan_mode');
    expect(decision.sdkPermissionMode).toBe('plan');
    expect(decision.rationale).toContain('multiple valid approaches');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-3-plan-vs-direct-mode.test.ts`
Expected: FAIL (`Cannot find module '../src/domain/execution-router.js'`).

- [ ] **Step 3: Implement `src/domain/execution-router.ts`**
  - Phân định rành mạch 3 trường hợp của Exercise 2 và trả về thêm `sdkPermissionMode` (`'plan'` hoặc `'acceptEdits'`) để Adapter Part B dùng trực tiếp.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-3-plan-vs-direct-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/execution-router.ts labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts
git commit -m "feat(scenario-2): implement 3-case plan mode vs direct execution router"
```

---

### Task 5: Hiện thực hóa Domain Module 4 — Iterative Refinement Coach (`src/domain/refinement-coach.ts`)

**Files:**
- Create: `labs/scenario-2/src/refinement-coach.ts` -> **Lưu ý đặt đúng tại:** `labs/scenario-2/src/domain/refinement-coach.ts`
- Create: `labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts`

**Interfaces:**
- Consumes: `IoExample`, `BugIssue`, `RefinementPlan` from `./types.js`.
- Produces: `buildConcreteIoPrompt(taskDescription: string, examples: IoExample[])`, `buildInterviewPatternPrompt(domainTopic: string, unfamiliarAreas: string[])`, `buildTddIterationPrompt(testFailureOutput: string, edgeCases: Array<{ input: unknown; expected: unknown }>)`, `planIssueResolutionOrder(issues: BugIssue[])` in `src/domain/refinement-coach.ts`.

- [ ] **Step 1: Write the failing test for Act 4 (`act-4-iterative-refinement.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildConcreteIoPrompt,
  buildInterviewPatternPrompt,
  buildTddIterationPrompt,
  planIssueResolutionOrder,
} from '../src/domain/refinement-coach.js';

describe('Act 4: Iterative Refinement Techniques (Task 3.5)', () => {
  it('should require at least 2 concrete input/output examples to disambiguate transformations', () => {
    expect(() =>
      buildConcreteIoPrompt('Normalize tax codes', [{ input: 'VN-TAX-01', output: 'VN_01' }])
    ).toThrow();

    const prompt = buildConcreteIoPrompt('Normalize legacy tax codes', [
      { input: 'VN-TAX-01', output: 'VN_01', explanation: 'Strip TAX middle segment' },
      { input: 'US-VAT-99', output: 'US_99', explanation: 'Strip VAT middle segment' },
    ]);
    expect(prompt).toContain('<input_output_examples>');
    expect(prompt).toContain('VN-TAX-01 -> VN_01');
  });

  it('should construct an Interview Pattern prompt instructing Claude to ask design questions before coding', () => {
    const prompt = buildInterviewPatternPrompt('Distributed Redis Cache Layer', [
      'cache invalidation on partial refund',
      'fallback when Redis cluster is unreachable',
    ]);
    expect(prompt).toContain('DO NOT write implementation code yet');
    expect(prompt).toContain('cache invalidation on partial refund');
  });

  it('should include null edge cases in TDD iteration prompts for migration scripts (Review Focus #4)', () => {
    const prompt = buildTddIterationPrompt('TypeError: Cannot read properties of null', [
      { input: { customer_id: 'CUST-9', tax_code: null }, expected: { customer_id: 'CUST-9', normalized_tax: 'EXEMPT' } },
    ]);
    expect(prompt).toContain('"tax_code":null');
    expect(prompt).toContain('EXEMPT');
  });

  it('should group interacting issues into a single message and separate independent issues sequentially', () => {
    const plan = planIssueResolutionOrder([
      { id: 'BUG-1', description: 'Token expiry check off by 1s', interactsWith: ['BUG-2'] },
      { id: 'BUG-2', description: 'Refresh token retry loop races with expiry check', interactsWith: ['BUG-1'] },
      { id: 'BUG-3', description: 'Typo in footer copyright text', interactsWith: [] },
    ]);

    expect(plan.batches.length).toBe(2);
    expect(plan.batches[0].strategy).toBe('single_consolidated_message');
    expect(plan.batches[0].issueIds).toEqual(['BUG-1', 'BUG-2']);
    expect(plan.batches[1].strategy).toBe('sequential_message');
    expect(plan.batches[1].issueIds).toEqual(['BUG-3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-4-iterative-refinement.test.ts`
Expected: FAIL (`Cannot find module '../src/domain/refinement-coach.js'`).

- [ ] **Step 3: Implement `src/domain/refinement-coach.ts`**
  - Kiểm tra tối thiểu 2 I/O examples, đóng gói XML tags rõ ràng, hỗ trợ gom nhóm thành phần liên thông (`connected components`) cho `interactsWith`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-4-iterative-refinement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/refinement-coach.ts labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts
git commit -m "feat(scenario-2): implement iterative refinement coach for I/O examples, TDD and interview pattern"
```

---

### Task 6: Hiện thực hóa Domain Module 5 — Session, Context Hygiene & Inspector (`src/domain/session-context-manager.ts` & `src/domain/session-inspector.ts`)

**Files:**
- Create: `labs/scenario-2/src/domain/session-context-manager.ts`
- Create: `labs/scenario-2/src/domain/session-inspector.ts`
- Create: `labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts`

**Interfaces:**
- Consumes: `SessionTurn`, `StateManifest`, `PhaseHandoffContext`, `SessionForkBranch`, `SessionResumeDecision` from `./types.js`.
- Produces: `SessionContextManager` (gồm `addTurn`, `detectContextDegradation`, `writeScratchpad`, `readScratchpad`, `compactContext`, `exportStateManifest`, `loadStateManifest`, `buildPhaseHandoffPrompt`, `forkSession`, `decideSessionResumption`) và `Scenario2Inspector` (tương đương `SessionInspector` ở Scenario 1, có ghi chú sư phạm phân tách Context Window vs Config/Harness State).

- [ ] **Step 1: Write the failing test for Act 5 (`act-5-session-context-hygiene.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts
import { describe, it, expect } from 'vitest';
import { SessionContextManager } from '../src/domain/session-context-manager.js';

describe('Act 5: Context Management, Crash Recovery & Session Resumption (Task 5.4 & 1.7)', () => {
  it('should detect context degradation when model replies with generic typical patterns instead of specific classes', () => {
    const manager = new SessionContextManager();
    const degraded = manager.detectContextDegradation(
      'In a typical pattern, you would usually have a generic OrderService class.',
      ['NovaOrderOrchestrator', 'ComplianceGuardHook']
    );
    expect(degraded.isDegraded).toBe(true);
    expect(degraded.recommendedRemediation).toContain('scratchpad');
  });

  it('should persist findings in scratchpad and preserve them across /compact', () => {
    const manager = new SessionContextManager();
    manager.addTurn({ role: 'user', content: 'Scan all 40 files in src/orders', tokenCount: 12000, isVerboseDiscovery: true });
    manager.writeScratchpad('entry_point', 'NovaOrderOrchestrator in src/orders/orchestrator.ts:42');

    const compacted = manager.compactContext();
    expect(compacted.tokensSaved).toBeGreaterThan(8000);
    expect(manager.readScratchpad('entry_point')).toContain('NovaOrderOrchestrator');
  });

  it('should export and reload StateManifest for crash recovery and summarize Phase 1 findings for Phase 2 subagent (Task 5.4)', () => {
    const manager = new SessionContextManager();
    manager.writeScratchpad('auth_entry', 'src/auth/jwt-verifier.ts');
    const manifest = manager.exportStateManifest('sess-crash-01', 'phase_1_discovery_done', ['src/auth/jwt-verifier.ts'], ['src/payment/webhook.ts']);

    const recovered = SessionContextManager.loadStateManifest(JSON.stringify(manifest));
    expect(recovered.readScratchpad('auth_entry')).toBe('src/auth/jwt-verifier.ts');

    const phase2Prompt = recovered.buildPhaseHandoffPrompt('phase_2_dependency_trace', 'Trace webhook callers');
    expect(phase2Prompt).toContain('src/auth/jwt-verifier.ts');
    expect(phase2Prompt).toContain('Trace webhook callers');
  });

  it('should support forkSession to compare two refactoring strategies from a shared baseline', () => {
    const manager = new SessionContextManager();
    manager.writeScratchpad('baseline_analysis', 'PaymentService has 3 tight couplings');

    const forks = manager.forkSession('payment-audit', ['strategy-adapter-pattern', 'strategy-event-bus']);
    expect(forks).toHaveLength(2);
    expect(forks[0].inheritedScratchpad.baseline_analysis).toBe('PaymentService has 3 tight couplings');
    expect(forks[0].branchName).not.toBe(forks[1].branchName);
  });

  it('should start fresh with structured summary when prior tool results are stale, vs --resume with file diff when valid (Review Focus #5)', () => {
    const manager = new SessionContextManager();

    const staleDecision = manager.decideSessionResumption({
      sessionName: 'auth-investigation',
      modifiedFilesCount: 18,
      modifiedFiles: ['src/auth/index.ts'],
      priorToolResultsStale: true,
      structuredSummary: 'Auth uses RS256; 18 files updated to v3.',
    });
    expect(staleDecision.action).toBe('start_fresh_with_summary');
    expect(staleDecision.injectedPrompt).toContain('Auth uses RS256');

    const validDecision = manager.decideSessionResumption({
      sessionName: 'auth-investigation',
      modifiedFilesCount: 1,
      modifiedFiles: ['src/auth/token.ts'],
      priorToolResultsStale: false,
      structuredSummary: '',
    });
    expect(validDecision.action).toBe('resume_named_session');
    expect(validDecision.cliCommand).toBe('claude --resume auth-investigation');
    expect(validDecision.targetedReanalysisFiles).toEqual(['src/auth/token.ts']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-5-session-context-hygiene.test.ts`
Expected: FAIL (`Cannot find module '../src/domain/session-context-manager.js'`).

- [ ] **Step 3: Implement `src/domain/session-context-manager.ts` and `src/domain/session-inspector.ts`**
  - Bao gồm `exportStateManifest` / `loadStateManifest` (phục hồi sau sự cố) và `buildPhaseHandoffPrompt` (truyền tóm tắt pha 1 vào đầu ngữ cảnh subagent pha 2).
  - `Scenario2Inspector` hiển thị box 3 vùng: LLM Context Window (turns, tokens, scratchpad), Config/Harness State (loaded rules, allowed-tools, active permissionMode, state manifest) và Execution Log.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/act-5-session-context-hygiene.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/domain/session-context-manager.ts labs/scenario-2/src/domain/session-inspector.ts labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts
git commit -m "feat(scenario-2): implement session context manager, crash recovery manifest, phase handoff and inspector"
```

---

### Task 7: Hiện thực hóa Adapter Part A — Messages API (`src/adapters/messages-api.ts`)

**Files:**
- Create: `labs/scenario-2/src/adapters/messages-api.ts`
- Test: `labs/scenario-2/__tests__/adapters.test.ts` (Part A cases)

**Interfaces:**
- Consumes: `buildConcreteIoPrompt`, `buildInterviewPatternPrompt`, `buildTddIterationPrompt` from `../domain/refinement-coach.js`; `SessionContextManager` from `../domain/session-context-manager.js`.
- Produces: `resolveModelName`, `ScriptedMockAnthropicClient`, `MessagesApiCodeCoachAgent` (hỗ trợ `runTurn`, `runRefinementWithToolLoop`, `getInspector`, `setDebug`, `reset`) trong `src/adapters/messages-api.ts`.

- [ ] **Step 1: Write the failing Part A test in `labs/scenario-2/__tests__/adapters.test.ts`**
```typescript
// labs/scenario-2/__tests__/adapters.test.ts (Part A section)
import { describe, it, expect } from 'vitest';
import {
  MessagesApiCodeCoachAgent,
  ScriptedMockAnthropicClient,
  resolveModelName,
} from '../src/adapters/messages-api.js';

describe('Adapters: Part A (Messages API) & Part B (Claude Agent SDK)', () => {
  it('Part A: should run iterative refinement turn using @anthropic-ai/sdk stop_reason loop offline via ScriptedMockAnthropicClient', async () => {
    expect(resolveModelName('haiku')).toBe('claude-haiku-5-5');

    const mockClient = new ScriptedMockAnthropicClient([
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'read_scratchpad',
            input: { key: 'migration_plan' },
          },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: 'Trước khi viết tầng Redis Cache, cho tôi hỏi 2 câu: (1) Chiến lược hủy cache khi partial refund? (2) Fallback khi cluster mất kết nối?',
          },
        ],
      },
    ]);

    const agent = new MessagesApiCodeCoachAgent({ client: mockClient, debug: false });
    agent.getSessionManager().writeScratchpad('migration_plan', 'Use ioredis cluster');
    const result = await agent.runTurn('Thiết kế tầng Redis Cache theo Interview Pattern');

    expect(result.iterations).toBe(2);
    expect(result.toolCallsExecuted).toEqual(['read_scratchpad']);
    expect(result.text).toContain('partial refund');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix labs/scenario-2 test -- __tests__/adapters.test.ts`
Expected: FAIL (`Cannot find module '../src/adapters/messages-api.js'`).

- [ ] **Step 3: Implement `src/adapters/messages-api.ts`**
  - Kế thừa mẫu `resolveModelName`, `ScriptedMockAnthropicClient` và vòng lặp `while (response.stop_reason === 'tool_use')` chuẩn mực từ Scenario 1, gắn với các công cụ hỗ trợ lập trình nội bộ (`read_scratchpad`, `write_scratchpad`, `inspect_memory`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix labs/scenario-2 test -- __tests__/adapters.test.ts`
Expected: PASS (Part A tests)

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/adapters/messages-api.ts labs/scenario-2/__tests__/adapters.test.ts
git commit -m "feat(scenario-2): implement Part A Messages API adapter with offline scripted mock client"
```

---

### Task 8: Hiện thực hóa Adapter Part B — Claude Agent SDK (`src/adapters/agent-sdk.ts`)

**Files:**
- Create: `labs/scenario-2/src/adapters/agent-sdk.ts`
- Modify: `labs/scenario-2/__tests__/adapters.test.ts` (thêm Part B assertions)

**Interfaces:**
- Consumes: `Options`, `AgentDefinition`, `createSdkMcpServer`, `tool`, `query`, `PreToolUseHookInput`, `PostToolUseHookInput`, `SyncHookJSONOutput` from `@anthropic-ai/claude-agent-sdk`; `loadSkillFromFile` from `../domain/skill-command-engine.js`; `selectExecutionStrategy` from `../domain/execution-router.js`.
- Produces: `createNovaSmartDevMcpServer()`, `createScenario2SdkHooks(allowedSkillTools?: string[])`, `buildScenario2AgentSdkOptions(params)`, `invokePreToolUseHook`, `Scenario2SdkAgent` in `src/adapters/agent-sdk.ts`.

- [ ] **Step 1: Add Part B tests to `labs/scenario-2/__tests__/adapters.test.ts`**
```typescript
import path from 'node:path';
import {
  createNovaSmartDevMcpServer,
  createScenario2SdkHooks,
  buildScenario2AgentSdkOptions,
  invokePreToolUseHook,
} from '../src/adapters/agent-sdk.js';

const fixturesRoot = path.resolve(__dirname, '../fixtures');

it('Part B: buildScenario2AgentSdkOptions should map exam concepts to official Agent SDK Options', () => {
  const sdkOptions = buildScenario2AgentSdkOptions({
    fixturesRoot,
    taskProfile: {
      description: 'Migrate JWT auth across 48 files',
      estimatedFilesAffected: 48,
      hasClearStackTrace: false,
      hasArchitecturalImplications: true,
      multipleValidApproaches: true,
      requiresBroadDiscovery: true,
    },
    activeSkill: 'codebase-audit',
    resumeSessionId: 'sess_prev_99',
    forkSession: true,
  });

  expect(sdkOptions.cwd).toBe(fixturesRoot);
  expect(sdkOptions.settingSources).toEqual(['user', 'project']);
  expect(sdkOptions.permissionMode).toBe('plan');
  expect(sdkOptions.skills).toEqual(['codebase-audit']);
  expect(sdkOptions.agents?.['explore']?.tools).toEqual(['Read', 'Grep', 'Glob']);
  expect(sdkOptions.resume).toBe('sess_prev_99');
  expect(sdkOptions.forkSession).toBe(true);
  expect(sdkOptions.mcpServers?.['novasmart-dev']).toBeDefined();
});

it('Part B: PreToolUse hook should enforce SKILL.md allowed-tools and deny Bash', async () => {
  const server = createNovaSmartDevMcpServer();
  expect(server.name).toBe('novasmart-dev');

  const hooks = createScenario2SdkHooks(['Read', 'Grep', 'Glob']);
  const denied = await invokePreToolUseHook(hooks, 'Bash', { command: 'rm -rf dist' });

  expect(denied.decision).toBe('block');
  expect(denied.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  if (denied.hookSpecificOutput?.hookEventName === 'PreToolUse') {
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
  }

  const allowed = await invokePreToolUseHook(hooks, 'Read', { file_path: 'src/index.ts' });
  expect(allowed.continue).toBe(true);
});
```

- [ ] **Step 2: Run test to verify Part B assertions fail**
Run: `npm --prefix labs/scenario-2 test -- __tests__/adapters.test.ts`
Expected: FAIL (`Cannot find module '../src/adapters/agent-sdk.js'`).

- [ ] **Step 3: Implement `src/adapters/agent-sdk.ts`**
  - `createNovaSmartDevMcpServer()`: Khởi tạo In-Process MCP server (`novasmart-dev`) kèm `instructions` và 2 tools mô tả chi tiết + resource catalog (`get_issue_catalog_resource`, `search_sprint_issues`) để minh họa Task 2.4.
  - `buildScenario2AgentSdkOptions()`: Gắn `cwd`, `settingSources: ['user', 'project']`, `permissionMode`, `planModeInstructions`, `skills`, `agents: { explore }`, `resume`, `forkSession`, `mcpServers`, `hooks`.
  - `createScenario2SdkHooks()`: `PreToolUse` Hook chặn bất kỳ công cụ nào không nằm trong `allowedSkillTools` bằng `permissionDecision: 'deny'`.

- [ ] **Step 4: Run all tests to verify they pass**
Run: `npm --prefix labs/scenario-2 test`
Expected: All 7 test suites PASS.

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/adapters/agent-sdk.ts labs/scenario-2/__tests__/adapters.test.ts
git commit -m "feat(scenario-2): implement Part B Claude Agent SDK adapter with Options, Explore subagent and PreToolUse guard"
```

---

### Task 9: Interactive CLI (`src/cli.ts`), Storyline Runner (`run-story.ts`) & Tài liệu (`README.md`)

**Files:**
- Create: `labs/scenario-2/src/cli.ts`
- Create: `labs/scenario-2/run-story.ts`
- Create: `labs/scenario-2/README.md`

**Interfaces:**
- Consumes: All modules from `src/domain/*` and `src/adapters/*`.
- Produces: Interactive Terminal REPL (`src/cli.ts`), 5-Act Storyline Runner hỗ trợ `--adapter=api` / `--adapter=sdk` (`run-story.ts`), và `README.md` chuẩn mực sư phạm (Definition Anatomy, Mermaid architecture, 5-act journey, 5 Mini Exam Quiz questions).

- [ ] **Step 1: Implement `labs/scenario-2/src/cli.ts`**
  - REPL hỗ trợ các lệnh `:adapter api`, `:adapter sdk`, `:switch`, `:memory` (hiển thị cây `CLAUDE.md` 3 tầng và rules đang khớp từ `fixtures/`), `:inspect`, `:act1`..`:act5`, `:reset`, `:help`, `:exit`.

- [ ] **Step 2: Implement `labs/scenario-2/run-story.ts`**
  - Diễn họa tuần tự 5 Hồi của Tech Lead **Minh Lê** & Junior Dev **Lan Phạm** trên cả 2 chế độ `--adapter=api` và `--adapter=sdk`:
    - `[Act 1]` Chẩn đoán onboarding gap `~/.claude/CLAUDE.md`, nạp 3-tier + `@import` từ đĩa, khớp glob `.claude/rules/` cho `src/api/orders.test.ts`, hợp nhất `.mcp.json` + `~/.claude.json` & kiểm tra MCP Resources.
    - `[Act 2]` Gọi `codebase-audit` (missing args -> `argument-hint`, chặn `Bash` qua `allowed-tools` / `PreToolUse` Hook, cô lập `context: fork`) và tạo biến thể cá nhân `~/.claude/skills/my-audit-lite/SKILL.md`.
    - `[Act 3]` Định tuyến đủ 3 kịch bản (1-file bug -> `direct_execution`, 48-file migration -> `plan_then_direct`, multi-approach feature -> `plan_mode`) và in cấu hình `Options` thực tế của Agent SDK.
    - `[Act 4]` Chạy vòng lặp tinh chỉnh lặp: >= 2 I/O examples, *Interview Pattern*, *TDD Iteration* (null edge case), và gom nhóm lỗi tương tác chéo.
    - `[Act 5]` Phát hiện *Context Degradation*, ghi `Scratchpad`, chạy `/compact`, xuất `StateManifest` (Crash Recovery), truyền tóm tắt pha 1 cho pha 2, `forkSession`, và chọn phiên mới + *Structured Summary* thay vì `--resume` dữ liệu lỗi thời.

- [ ] **Step 3: Write `labs/scenario-2/README.md`**
  - Gồm: Definition Anatomy, Sơ đồ kiến trúc Mermaid (Ports & Adapters), Bảng đối chiếu 5 Hồi với Task Statements của CCA-F, 5 câu Mini Exam Quiz có giải thích, và hướng dẫn chạy `npm run lab:s2:test`, `npm run lab:s2:story`, `npm run lab:s2:sdk`, `npm run lab:s2:cli`.

- [ ] **Step 4: Run typecheck, tests, and both Storyline modes to verify**
Run: `npm run lab:s2:typecheck && npm run lab:s2:test && npm run lab:s2:story && npm run lab:s2:sdk`
Expected: TypeScript compiles cleanly with 0 errors, all 7 test suites PASS, and both `--adapter=api` and `--adapter=sdk` story runners execute cleanly.

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/cli.ts labs/scenario-2/run-story.ts labs/scenario-2/README.md
git commit -m "feat(scenario-2): add interactive CLI, dual-adapter storyline runner and study guide"
```

---
*Made by Anh Tu - Share to be share*
