# Scenario 2: Code Generation with Claude Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh bài lab thực hành Scenario 2 (Code Generation with Claude Code) theo chuẩn CCAF (Claude Certified Architect – Foundations), bao gồm bộ cấu hình mẫu (`fixtures/`), 5 module mô phỏng cơ chế điều phối quy trình phát triển của Claude Code (`ConfigResolver`, `SkillCommandEngine`, `ExecutionRouter`, `RefinementCoach`, `SessionContextManager`), 5 bộ kiểm thử Vitest tương ứng 5 Hồi và Storyline Runner trực quan.

**Architecture:** Sử dụng kiến trúc Hybrid: Kết hợp bộ file cấu hình thực tế của dự án NovaSmart (`.claude/CLAUDE.md`, `@import`, `.claude/rules/*.md` với YAML frontmatter `paths`, `.claude/skills/*/SKILL.md` với `context: fork`, `.mcp.json`) và bộ máy đánh giá tất định bằng TypeScript. Toàn bộ được kiểm chứng qua 5 test suites Vitest và kịch bản diễn họa 5 Hồi của Tech Lead Minh Lê và Junior Developer Lan Phạm.

**Tech Stack:** TypeScript, `vitest`, `tsx`.

**Spec:** [docs/superpowers/specs/2026-11-06-scenario-2-code-generation-design.md](file:///Users/anhtus/Documents/Development/agentic-ai/strands-harness-sdk/strands-ts/docs/superpowers/specs/2026-11-06-scenario-2-code-generation-design.md)

---

## Global Constraints

- Không đặt các quy chuẩn dùng chung của đội ngũ vào `~/.claude/CLAUDE.md` (user-level); bắt buộc đặt tại `.claude/CLAUDE.md` hoặc `CLAUDE.md` cấp dự án để chia sẻ qua Git.
- Không tạo hàng loạt file `CLAUDE.md` ở từng thư mục con cho các quy ước theo loại file (như `*.test.ts`); bắt buộc dùng `.claude/rules/*.md` với YAML frontmatter `paths` chứa mẫu glob.
- Không lưu cứng (hardcode) chuỗi bí mật trong `.mcp.json`; bắt buộc dùng cú pháp mở rộng biến môi trường `${ENV_VAR}`.
- Các kỹ năng (`SKILL.md`) sinh ra dữ liệu phân tích dài hoặc mang tính thử nghiệm bắt buộc phải khai báo `context: fork` và giới hạn `allowed-tools` để không làm ô nhiễm ngữ cảnh hội thoại chính.
- Không dùng *Direct Execution* cho các tác vụ tái cấu trúc lớn (45+ files) hoặc có nhiều phương án kiến trúc; bắt buộc định tuyến qua *Plan Mode* kết hợp *Explore Subagent*.
- Khi các kết quả công cụ trong phiên cũ đã lỗi thời (*stale tool results*) sau đợt sửa đổi lớn, không được dùng `--resume` mù quáng mà phải khởi tạo phiên mới kèm bản tóm tắt có cấu trúc (*structured summary*).

## Review Focus

1. **Biến môi trường trong `.mcp.json` chưa được khai báo trên hệ thống (Missing Env Var in MCP Config):** `resolveMcpConfig` phải phát hiện biến `${GITHUB_TOKEN}` bị thiếu và đánh dấu cảnh báo thay vì giữ nguyên chuỗi literal `${GITHUB_TOKEN}` làm token xác thực (kiểm thử tại Task 2).
2. **Skill được gọi thiếu tham số bắt buộc (Missing Skill Arguments):** Khi gọi skill có cấu hình `argument-hint` mà truyền chuỗi rỗng, `SkillCommandEngine` phải trả về thông báo nhắc tham số theo đúng `argument-hint` thay vì chạy mù quáng (kiểm thử tại Task 3).
3. **Skill cố tình gọi công cụ hủy hoại ngoài danh sách cho phép (Unauthorized Tool Call in Skill):** Khi `allowed-tools: ["Read", "Grep", "Glob"]`, mọi nỗ lực gọi `Bash` hoặc `Write` trong lúc chạy skill phải bị chặn cứng bằng ngoại lệ (kiểm thử tại Task 3).
4. **Script di trú dữ liệu gặp giá trị `null` ở trường bắt buộc (Null Edge Case in Iterative Refinement):** `RefinementCoach` phải tạo được test case biên chứa `null` và đóng gói log lỗi test để dẫn dắt vòng lặp TDD sửa dứt điểm (kiểm thử tại Task 5).
5. **Tiếp tục phiên làm việc cũ sau khi 15+ files đã bị sửa bên ngoài (Stale Session Resumption):** `SessionContextManager` phải từ chối `--resume` trực tiếp và yêu cầu khởi tạo phiên mới kèm `StructuredSummary` (kiểm thử tại Task 6).

---

## Cấu trúc thư mục dự kiến (`labs/scenario-2/`)

```
labs/scenario-2/
├── README.md
├── vitest.config.ts
├── fixtures/
│   ├── CLAUDE.md
│   ├── .mcp.json
│   └── .claude/
│       ├── rules/
│       │   ├── testing.md
│       │   ├── api-conventions.md
│       │   └── terraform.md
│       ├── commands/
│       │   └── review-pr.md
│       └── skills/
│           └── codebase-audit/
│               └── SKILL.md
├── src/
│   ├── types.ts
│   ├── config-resolver.ts
│   ├── skill-command-engine.ts
│   ├── execution-router.ts
│   ├── refinement-coach.ts
│   └── session-context-manager.ts
├── __tests__/
│   ├── task-1-sanity.test.ts
│   ├── act-1-config-hierarchy-rules.test.ts
│   ├── act-2-commands-skills-fork.test.ts
│   ├── act-3-plan-vs-direct-mode.test.ts
│   ├── act-4-iterative-refinement.test.ts
│   └── act-5-session-context-hygiene.test.ts
└── run-story.ts
```

---

### Task 1: Định nghĩa Types, Fixtures Cấu hình Mẫu & Cấu hình Vitest

**Files:**
- Create: `labs/scenario-2/vitest.config.ts`
- Create: `labs/scenario-2/src/types.ts`
- Create: `labs/scenario-2/fixtures/CLAUDE.md`
- Create: `labs/scenario-2/fixtures/.mcp.json`
- Create: `labs/scenario-2/fixtures/.claude/rules/testing.md`
- Create: `labs/scenario-2/fixtures/.claude/rules/api-conventions.md`
- Create: `labs/scenario-2/fixtures/.claude/rules/terraform.md`
- Create: `labs/scenario-2/fixtures/.claude/commands/review-pr.md`
- Create: `labs/scenario-2/fixtures/.claude/skills/codebase-audit/SKILL.md`
- Test: `labs/scenario-2/__tests__/task-1-sanity.test.ts`

**Interfaces:**
- Produces: `ConfigScope`, `MemoryFileEntry`, `PathRule`, `McpServerConfig`, `ResolvedMcpConfig`, `SlashCommandSpec`, `SkillFrontmatter`, `SkillDefinition`, `SkillExecutionResult`, `TaskComplexityProfile`, `ExecutionRouteDecision`, `IoExample`, `BugIssue`, `RefinementPlan`, `SessionTurn`, `StateManifest`, `SessionResumeDecision` in `src/types.ts`.

- [ ] **Step 1: Write the failing sanity test**
```typescript
// labs/scenario-2/__tests__/task-1-sanity.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('Task 1: Scenario 2 Fixtures & Types Sanity', () => {
  it('should have project CLAUDE.md with @import directive and .mcp.json with env var expansion', () => {
    const claudeMd = fs.readFileSync(path.join(fixturesDir, 'CLAUDE.md'), 'utf-8')
    const mcpJson = fs.readFileSync(path.join(fixturesDir, '.mcp.json'), 'utf-8')

    expect(claudeMd).toContain('@import')
    expect(mcpJson).toContain('${GITHUB_TOKEN}')
  })

  it('should have path-scoped rules and isolated codebase-audit SKILL.md', () => {
    const testingRule = fs.readFileSync(path.join(fixturesDir, '.claude/rules/testing.md'), 'utf-8')
    const skillMd = fs.readFileSync(path.join(fixturesDir, '.claude/skills/codebase-audit/SKILL.md'), 'utf-8')

    expect(testingRule).toContain('paths:')
    expect(skillMd).toContain('context: fork')
    expect(skillMd).toContain('allowed-tools:')
    expect(skillMd).toContain('argument-hint:')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/task-1-sanity.test.ts`
Expected: FAIL (ENOENT: no such file or directory, open '.../fixtures/CLAUDE.md')

- [ ] **Step 3: Implement `vitest.config.ts`, `src/types.ts` and `fixtures/` files**
  - Tạo `labs/scenario-2/src/types.ts` định nghĩa toàn bộ kiểu dữ liệu cho 5 Hồi.
  - Tạo bộ file mẫu trong `labs/scenario-2/fixtures/` phản ánh đúng chuẩn CCAF:
    - `CLAUDE.md`: chứa quy chuẩn chung của NovaSmart và các dòng `@import docs/standards/security.md`.
    - `.mcp.json`: cấu hình `github` và `jira` MCP server dùng `${GITHUB_TOKEN}` và `${JIRA_API_TOKEN}`.
    - `.claude/rules/testing.md` (`paths: ["**/*.test.ts", "**/*.spec.ts"]`), `api-conventions.md` (`paths: ["src/api/**/*"]`), `terraform.md` (`paths: ["terraform/**/*"]`).
    - `.claude/commands/review-pr.md`: project-scoped slash command.
    - `.claude/skills/codebase-audit/SKILL.md`: frontmatter `context: fork`, `allowed-tools: ["Read", "Grep", "Glob"]`, `argument-hint: "[target-dir] [focus-area]"`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-2/__tests__/task-1-sanity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/
git commit -m "feat(scenario-2): add types, novasmart config fixtures and vitest setup"
```

---

### Task 2: Hiện thực hóa Config & Rule Resolver — Hồi 1 (`config-resolver.ts`)

**Files:**
- Create: `labs/scenario-2/src/config-resolver.ts`
- Create: `labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts`

**Interfaces:**
- Consumes: `MemoryFileEntry`, `PathRule`, `ResolvedMcpConfig` from `src/types.ts`.
- Produces: `diagnoseOnboardingConfigGap(files: MemoryFileEntry[])`, `resolveImports(claudeMdContent: string, availableFiles: Record<string, string>)`, `matchPathRules(targetFilePath: string, rules: PathRule[])`, `inspectLoadedMemory(files: MemoryFileEntry[], activeFilePath?: string, rules?: PathRule[])`, `resolveMcpServers(projectMcpJson: string, userClaudeJson: string, env: Record<string, string | undefined>)` in `src/config-resolver.ts`.

- [ ] **Step 1: Write the failing test for Act 1 (`act-1-config-hierarchy-rules.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts
import { describe, it, expect } from 'vitest'
import {
  diagnoseOnboardingConfigGap,
  resolveImports,
  matchPathRules,
  inspectLoadedMemory,
  resolveMcpServers
} from '../src/config-resolver.js'
import type { MemoryFileEntry, PathRule } from '../src/types.js'

describe('Act 1: CLAUDE.md Hierarchy, Path-Scoped Rules & MCP Resolution', () => {
  it('should diagnose when team coding standards are mistakenly placed in user-level ~/.claude/CLAUDE.md', () => {
    const files: MemoryFileEntry[] = [
      { path: '~/.claude/CLAUDE.md', scope: 'user', sharedViaGit: false, content: 'Always use Vitest and strict TypeScript.' }
    ]
    const diagnosis = diagnoseOnboardingConfigGap(files)
    expect(diagnosis.hasOnboardingGap).toBe(true)
    expect(diagnosis.reason).toContain('user-level')
    expect(diagnosis.recommendedAction).toContain('.claude/CLAUDE.md')
  })

  it('should expand @import directives cleanly into modular sections', () => {
    const rootContent = '# NovaSmart Root\n@import docs/standards/error-handling.md'
    const resolved = resolveImports(rootContent, {
      'docs/standards/error-handling.md': 'Use StructuredError for all MCP responses.'
    })
    expect(resolved).toContain('Use StructuredError for all MCP responses.')
  })

  it('should load only matching path-scoped rules when editing src/api/orders.test.ts', () => {
    const rules: PathRule[] = [
      { name: 'testing.md', paths: ['**/*.test.ts'], content: 'Use describe/it blocks' },
      { name: 'api-conventions.md', paths: ['src/api/**/*'], content: 'Validate DTOs with Zod' },
      { name: 'terraform.md', paths: ['terraform/**/*'], content: 'Require tags on AWS resources' }
    ]
    const active = matchPathRules('src/api/orders.test.ts', rules)
    expect(active.map((r) => r.name)).toEqual(['testing.md', 'api-conventions.md'])
  })

  it('should merge project .mcp.json and user ~/.claude.json while flagging missing env vars', () => {
    const projectMcp = JSON.stringify({
      mcpServers: {
        github: { command: 'npx', args: ['-y', 'mcp-github'], env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' } }
      }
    })
    const userMcp = JSON.stringify({
      mcpServers: {
        localSqlite: { command: 'npx', args: ['-y', 'mcp-sqlite'] }
      }
    })

    const resolvedOk = resolveMcpServers(projectMcp, userMcp, { GITHUB_TOKEN: 'ghp_secret123' })
    expect(resolvedOk.servers.map((s) => s.name)).toEqual(['github', 'localSqlite'])
    expect(resolvedOk.servers[0].env?.GITHUB_TOKEN).toBe('ghp_secret123')
    expect(resolvedOk.missingEnvVars).toEqual([])

    // Review Focus #1: Missing environment variable must be flagged, not passed as literal "${GITHUB_TOKEN}"
    const resolvedMissing = resolveMcpServers(projectMcp, userMcp, {})
    expect(resolvedMissing.missingEnvVars).toContain('GITHUB_TOKEN')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts`
Expected: FAIL (Cannot find module '../src/config-resolver.js')

- [ ] **Step 3: Implement `src/config-resolver.ts`**
  - `diagnoseOnboardingConfigGap`: Kiểm tra xem quy chuẩn chung có đang nằm ở `scope === 'user'` mà thiếu `scope === 'project'` hay không.
  - `resolveImports`: Thay thế các dòng `@import <path>` bằng nội dung file tương ứng trong `availableFiles`.
  - `matchPathRules`: Chuyển đổi biểu thức glob (`**/*.test.ts`, `src/api/**/*`, `terraform/**/*`) sang `RegExp` để lọc chính xác các `PathRule` khớp với `targetFilePath`.
  - `inspectLoadedMemory`: Mô phỏng lệnh `/memory` trả về danh sách các file cấu hình và rule đang hiệu lực.
  - `resolveMcpServers`: Hợp nhất cấu hình từ `.mcp.json` (project) và `~/.claude.json` (user), giải mã `${VAR}` từ `env` và ghi nhận biến bị thiếu vào `missingEnvVars`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/config-resolver.ts labs/scenario-2/__tests__/act-1-config-hierarchy-rules.test.ts
git commit -m "feat(scenario-2): implement config hierarchy, glob path rules and mcp resolver"
```

---

### Task 3: Hiện thực hóa Skill & Command Engine — Hồi 2 (`skill-command-engine.ts`)

**Files:**
- Create: `labs/scenario-2/src/skill-command-engine.ts`
- Create: `labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts`

**Interfaces:**
- Consumes: `SkillDefinition`, `SkillExecutionResult`, `SlashCommandSpec` from `src/types.ts`.
- Produces: `parseSkillMarkdown(rawMarkdown: string, name: string, scope: 'project' | 'user')`, `executeSkill(skill: SkillDefinition, args: string, requestedTools: string[], mainConversationLog: string[])`, `recommendCustomizationMechanism(requirement: { isUniversalStandard: boolean; producesVerboseOutput: boolean; isPersonalOverride: boolean })` in `src/skill-command-engine.ts`.

- [ ] **Step 1: Write the failing test for Act 2 (`act-2-commands-skills-fork.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseSkillMarkdown,
  executeSkill,
  recommendCustomizationMechanism,
  UnauthorizedSkillToolError
} from '../src/skill-command-engine.js'

const sampleSkillMd = `---
context: fork
allowed-tools: ["Read", "Grep", "Glob"]
argument-hint: "[target-dir] [focus-area]"
---
# Codebase Audit Skill
Analyze architecture and return a concise summary.`

describe('Act 2: Custom Slash Commands & Isolated Skills (context: fork)', () => {
  it('should parse SKILL.md frontmatter including context: fork, allowed-tools, and argument-hint', () => {
    const skill = parseSkillMarkdown(sampleSkillMd, 'codebase-audit', 'project')
    expect(skill.frontmatter.context).toBe('fork')
    expect(skill.frontmatter.allowedTools).toEqual(['Read', 'Grep', 'Glob'])
    expect(skill.frontmatter.argumentHint).toBe('[target-dir] [focus-area]')
  })

  it('should prompt developer with argument-hint when invoked without arguments (Review Focus #2)', () => {
    const skill = parseSkillMarkdown(sampleSkillMd, 'codebase-audit', 'project')
    const mainLog: string[] = ['User: Start session']
    const result = executeSkill(skill, '   ', ['Read'], mainLog)

    expect(result.status).toBe('missing_arguments')
    expect(result.promptHint).toContain('[target-dir] [focus-area]')
  })

  it('should block tool calls not listed in allowed-tools (Review Focus #3)', () => {
    const skill = parseSkillMarkdown(sampleSkillMd, 'codebase-audit', 'project')
    const mainLog: string[] = []
    expect(() => executeSkill(skill, 'src/payment security', ['Read', 'Bash'], mainLog)).toThrow(
      UnauthorizedSkillToolError
    )
  })

  it('should isolate verbose output from main conversation when context: fork is active', () => {
    const skill = parseSkillMarkdown(sampleSkillMd, 'codebase-audit', 'project')
    const mainLog: string[] = ['User: Check payment module']
    const result = executeSkill(skill, 'src/payment security', ['Read', 'Grep'], mainLog)

    expect(result.status).toBe('completed')
    expect(result.isolatedInFork).toBe(true)
    // Main log only receives concise summary, NOT raw verbose scanning logs
    expect(mainLog.some((entry) => entry.includes('[VERBOSE_RAW_SCAN]'))).toBe(false)
    expect(mainLog.some((entry) => entry.includes('[Skill Summary: codebase-audit]'))).toBe(true)
  })

  it('should distinguish between CLAUDE.md (always loaded) and Skills (on-demand task workflows)', () => {
    expect(
      recommendCustomizationMechanism({
        isUniversalStandard: true,
        producesVerboseOutput: false,
        isPersonalOverride: false
      })
    ).toBe('project_claude_md')

    expect(
      recommendCustomizationMechanism({
        isUniversalStandard: false,
        producesVerboseOutput: true,
        isPersonalOverride: false
      })
    ).toBe('project_skill_with_fork')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts`
Expected: FAIL (Cannot find module '../src/skill-command-engine.js')

- [ ] **Step 3: Implement `src/skill-command-engine.ts`**
  - `parseSkillMarkdown`: Tách phần YAML frontmatter giữa `---` để lấy `context`, `allowed-tools`, `argument-hint`.
  - `executeSkill`:
    - Nếu `args.trim() === ''` và có `argumentHint` -> trả về `{ status: 'missing_arguments', promptHint: skill.frontmatter.argumentHint }`.
    - Kiểm tra mọi tool trong `requestedTools`: nếu có tool không nằm trong `allowedTools` -> ném lỗi `UnauthorizedSkillToolError`.
    - Nếu `context === 'fork'`, giữ toàn bộ log dò tìm chi tiết (`[VERBOSE_RAW_SCAN]...`) trong `forkedSubagentLog` và chỉ đẩy bản tóm tắt ngắn gọn `[Skill Summary: ...]` vào `mainConversationLog`.
  - `recommendCustomizationMechanism`: Phân loại chính xác khi nào dùng `project_claude_md`, `project_skill_with_fork`, hoặc `personal_skill_variant` (`~/.claude/skills/`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/skill-command-engine.ts labs/scenario-2/__tests__/act-2-commands-skills-fork.test.ts
git commit -m "feat(scenario-2): implement skill frontmatter parser, allowed-tools guard and fork isolation"
```

---

### Task 4: Hiện thực hóa Execution Mode Router — Hồi 3 (`execution-router.ts`)

**Files:**
- Create: `labs/scenario-2/src/execution-router.ts`
- Create: `labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts`

**Interfaces:**
- Consumes: `TaskComplexityProfile`, `ExecutionRouteDecision` from `src/types.ts`.
- Produces: `selectExecutionStrategy(profile: TaskComplexityProfile)` in `src/execution-router.ts`.

- [ ] **Step 1: Write the failing test for Act 3 (`act-3-plan-vs-direct-mode.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts
import { describe, it, expect } from 'vitest'
import { selectExecutionStrategy } from '../src/execution-router.js'

describe('Act 3: Plan Mode vs Direct Execution & Explore Subagent', () => {
  it('should select direct_execution for a single-file bug fix with clear stack trace', () => {
    const decision = selectExecutionStrategy({
      description: 'Add date validation check in parseOrderDate()',
      estimatedFilesAffected: 1,
      hasClearStackTrace: true,
      hasArchitecturalImplications: false,
      multipleValidApproaches: false,
      requiresBroadDiscovery: false
    })

    expect(decision.mode).toBe('direct_execution')
    expect(decision.useExploreSubagent).toBe(false)
  })

  it('should select plan_then_direct and dispatch Explore subagent for a 48-file library migration', () => {
    const decision = selectExecutionStrategy({
      description: 'Migrate legacy JWT auth library across 48 service files',
      estimatedFilesAffected: 48,
      hasClearStackTrace: false,
      hasArchitecturalImplications: true,
      multipleValidApproaches: true,
      requiresBroadDiscovery: true
    })

    expect(decision.mode).toBe('plan_then_direct')
    expect(decision.useExploreSubagent).toBe(true)
    expect(decision.phases).toEqual([
      'explore_subagent_discovery',
      'plan_mode_alignment',
      'direct_execution_implementation'
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts`
Expected: FAIL (Cannot find module '../src/execution-router.js')

- [ ] **Step 3: Implement `src/execution-router.ts`**
  - `selectExecutionStrategy`: Đánh giá các tiêu chí theo chuẩn Task 3.4:
    - Nếu tác vụ chạm nhiều file (`> 5` files), có ảnh hưởng kiến trúc (`hasArchitecturalImplications`), hoặc có nhiều phương án hợp lệ (`multipleValidApproaches`) -> trả về `plan_mode` (hoặc `plan_then_direct` khi kết hợp điều tra rồi thực thi).
    - Nếu cần khảo sát diện rộng (`requiresBroadDiscovery`) -> bật `useExploreSubagent: true` để cô lập kết quả dò tìm.
    - Ngược lại (1–2 files, phạm vi rõ ràng, có stack trace cụ thể) -> trả về `direct_execution`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/execution-router.ts labs/scenario-2/__tests__/act-3-plan-vs-direct-mode.test.ts
git commit -m "feat(scenario-2): implement plan mode vs direct execution router and explore delegation"
```

---

### Task 5: Hiện thực hóa Iterative Refinement Coach — Hồi 4 (`refinement-coach.ts`)

**Files:**
- Create: `labs/scenario-2/src/refinement-coach.ts`
- Create: `labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts`

**Interfaces:**
- Consumes: `IoExample`, `BugIssue`, `RefinementPlan` from `src/types.ts`.
- Produces: `buildConcreteIoPrompt(taskDescription: string, examples: IoExample[])`, `buildInterviewPatternPrompt(domainTopic: string, unfamiliarAreas: string[])`, `buildTddIterationPrompt(testFailureOutput: string, edgeCases: Array<{ input: unknown; expected: unknown }>)`, `planIssueResolutionOrder(issues: BugIssue[])` in `src/refinement-coach.ts`.

- [ ] **Step 1: Write the failing test for Act 4 (`act-4-iterative-refinement.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildConcreteIoPrompt,
  buildInterviewPatternPrompt,
  buildTddIterationPrompt,
  planIssueResolutionOrder
} from '../src/refinement-coach.js'

describe('Act 4: Iterative Refinement Techniques (Task 3.5)', () => {
  it('should require at least 2-3 concrete input/output examples to disambiguate transformations', () => {
    const prompt = buildConcreteIoPrompt('Normalize legacy tax codes', [
      { input: 'VN-TAX-01', output: 'VN_01', explanation: 'Strip TAX middle segment' },
      { input: 'US-VAT-99', output: 'US_99', explanation: 'Strip VAT middle segment' }
    ])
    expect(prompt).toContain('<input_output_examples>')
    expect(prompt).toContain('VN-TAX-01 -> VN_01')
  })

  it('should construct an Interview Pattern prompt that instructs Claude to ask design questions before coding', () => {
    const prompt = buildInterviewPatternPrompt('Distributed Redis Cache Layer', [
      'cache invalidation on partial refund',
      'fallback when Redis cluster is unreachable'
    ])
    expect(prompt).toContain('DO NOT write implementation code yet')
    expect(prompt).toContain('cache invalidation on partial refund')
  })

  it('should include null edge cases in TDD iteration prompts for migration scripts (Review Focus #4)', () => {
    const prompt = buildTddIterationPrompt('TypeError: Cannot read properties of null', [
      { input: { customer_id: 'CUST-9', tax_code: null }, expected: { customer_id: 'CUST-9', normalized_tax: 'EXEMPT' } }
    ])
    expect(prompt).toContain('"tax_code":null')
    expect(prompt).toContain('EXEMPT')
  })

  it('should group interacting issues into a single message and separate independent issues sequentially', () => {
    const plan = planIssueResolutionOrder([
      { id: 'BUG-1', description: 'Token expiry check off by 1s', interactsWith: ['BUG-2'] },
      { id: 'BUG-2', description: 'Refresh token retry loop races with expiry check', interactsWith: ['BUG-1'] },
      { id: 'BUG-3', description: 'Typo in footer copyright text', interactsWith: [] }
    ])

    expect(plan.batches.length).toBe(2)
    expect(plan.batches[0].strategy).toBe('single_consolidated_message')
    expect(plan.batches[0].issueIds).toEqual(['BUG-1', 'BUG-2'])
    expect(plan.batches[1].strategy).toBe('sequential_message')
    expect(plan.batches[1].issueIds).toEqual(['BUG-3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts`
Expected: FAIL (Cannot find module '../src/refinement-coach.js')

- [ ] **Step 3: Implement `src/refinement-coach.ts`**
  - `buildConcreteIoPrompt`: Kiểm tra tối thiểu 2 ví dụ mẫu và đóng gói thẻ `<input_output_examples>` rõ ràng.
  - `buildInterviewPatternPrompt`: Tạo prompt yêu cầu mô hình đặt câu hỏi làm rõ các khía cạnh thiết kế chưa tường minh trước khi viết code.
  - `buildTddIterationPrompt`: Kết hợp log lỗi từ test runner và các test case biên (đặc biệt là `null` values) để hướng dẫn sửa code.
  - `planIssueResolutionOrder`: Phân tích đồ thị phụ thuộc `interactsWith` của các lỗi — gom các lỗi có tương tác chéo thành `single_consolidated_message` và tách các lỗi độc lập thành các bước `sequential_message`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/refinement-coach.ts labs/scenario-2/__tests__/act-4-iterative-refinement.test.ts
git commit -m "feat(scenario-2): implement iterative refinement coach for I/O examples, TDD and interview pattern"
```

---

### Task 6: Hiện thực hóa Session & Context Hygiene Manager — Hồi 5 (`session-context-manager.ts`)

**Files:**
- Create: `labs/scenario-2/src/session-context-manager.ts`
- Create: `labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts`

**Interfaces:**
- Consumes: `SessionTurn`, `StateManifest`, `SessionResumeDecision` from `src/types.ts`.
- Produces: `SessionContextManager` class with methods `detectContextDegradation(recentReply: string, discoveredClasses: string[])`, `writeScratchpad(key: string, finding: string)`, `compactContext()`, `exportStateManifest(sessionId: string, phase: string)`, `forkSession(baseSessionName: string, branchNames: string[])`, `decideSessionResumption(options: { sessionName: string; modifiedFilesCount: number; modifiedFiles: string[]; priorToolResultsStale: boolean; structuredSummary: string })` in `src/session-context-manager.ts`.

- [ ] **Step 1: Write the failing test for Act 5 (`act-5-session-context-hygiene.test.ts`)**
```typescript
// labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts
import { describe, it, expect } from 'vitest'
import { SessionContextManager } from '../src/session-context-manager.js'

describe('Act 5: Context Management in Large Codebases & Session Resumption (Task 5.4 & 1.7)', () => {
  it('should detect context degradation when model replies with generic typical patterns instead of specific classes', () => {
    const manager = new SessionContextManager()
    const degraded = manager.detectContextDegradation(
      'In a typical pattern, you would usually have a generic OrderService class.',
      ['NovaOrderOrchestrator', 'ComplianceGuardHook']
    )
    expect(degraded.isDegraded).toBe(true)
    expect(degraded.recommendedRemediation).toContain('scratchpad')
  })

  it('should persist findings in scratchpad and preserve them across /compact', () => {
    const manager = new SessionContextManager()
    manager.addTurn({ role: 'user', content: 'Scan all 40 files in src/orders', tokenCount: 12000, isVerboseDiscovery: true })
    manager.writeScratchpad('entry_point', 'NovaOrderOrchestrator in src/orders/orchestrator.ts:42')

    const compacted = manager.compactContext()
    expect(compacted.tokensSaved).toBeGreaterThan(8000)
    expect(manager.readScratchpad('entry_point')).toContain('NovaOrderOrchestrator')
  })

  it('should support fork_session to compare two refactoring strategies from a shared baseline', () => {
    const manager = new SessionContextManager()
    manager.writeScratchpad('baseline_analysis', 'PaymentService has 3 tight couplings')

    const forks = manager.forkSession('payment-audit', ['strategy-adapter-pattern', 'strategy-event-bus'])
    expect(forks).toHaveLength(2)
    expect(forks[0].inheritedScratchpad.baseline_analysis).toBe('PaymentService has 3 tight couplings')
    expect(forks[0].branchName).not.toBe(forks[1].branchName)
  })

  it('should start fresh with structured summary when prior tool results are stale, vs --resume with file diff when valid (Review Focus #5)', () => {
    const manager = new SessionContextManager()

    // Case A: Prior tool results are stale after 18 files changed externally
    const staleDecision = manager.decideSessionResumption({
      sessionName: 'auth-investigation',
      modifiedFilesCount: 18,
      modifiedFiles: ['src/auth/index.ts'],
      priorToolResultsStale: true,
      structuredSummary: 'Auth uses RS256; 18 files updated to v3.'
    })
    expect(staleDecision.action).toBe('start_fresh_with_summary')
    expect(staleDecision.injectedPrompt).toContain('Auth uses RS256')

    // Case B: Prior context is mostly valid, only 1 file tweaked
    const validDecision = manager.decideSessionResumption({
      sessionName: 'auth-investigation',
      modifiedFilesCount: 1,
      modifiedFiles: ['src/auth/token.ts'],
      priorToolResultsStale: false,
      structuredSummary: ''
    })
    expect(validDecision.action).toBe('resume_named_session')
    expect(validDecision.cliCommand).toBe('claude --resume auth-investigation')
    expect(validDecision.targetedReanalysisFiles).toEqual(['src/auth/token.ts'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts`
Expected: FAIL (Cannot find module '../src/session-context-manager.js')

- [ ] **Step 3: Implement `src/session-context-manager.ts`**
  - `detectContextDegradation`: Kiểm tra nếu câu trả lời xuất hiện các cụm từ mơ hồ (`"typical pattern"`, `"usually have"`, `"generally"`) và bỏ sót toàn bộ tên class cụ thể đã khám phá trước đó.
  - `writeScratchpad` / `readScratchpad`: Lưu trữ các phát hiện quan trọng độc lập với lịch sử hội thoại.
  - `compactContext`: Mô phỏng lệnh `/compact` nén các lượt `isVerboseDiscovery` để giải phóng token nhưng giữ nguyên toàn bộ `scratchpad`.
  - `exportStateManifest` / `loadStateManifest`: Xuất trạng thái có cấu trúc để phục hồi sau sự cố (crash recovery).
  - `forkSession`: Tạo các nhánh phiên độc lập kế thừa dữ liệu phân tích nền tảng (`baseline`) mà không ghi đè lẫn nhau.
  - `decideSessionResumption`: Nếu `priorToolResultsStale === true` -> trả về `start_fresh_with_summary`; nếu `priorToolResultsStale === false` -> trả về `resume_named_session` (`claude --resume <name>`) kèm danh sách `targetedReanalysisFiles`.

- [ ] **Step 4: Run all Scenario 2 tests to verify they all pass**
Run: `npx vitest run labs/scenario-2/`
Expected: All 6 test suites PASS

- [ ] **Step 5: Commit**
```bash
git add labs/scenario-2/src/session-context-manager.ts labs/scenario-2/__tests__/act-5-session-context-hygiene.test.ts
git commit -m "feat(scenario-2): implement session context manager, scratchpad, fork_session and resume logic"
```

---

### Task 7: Storyline Runner trực quan (`run-story.ts`) & Tài liệu hướng dẫn thực hành (`README.md`)

**Files:**
- Create: `labs/scenario-2/run-story.ts`
- Create: `labs/scenario-2/README.md`
- Modify: `package.json` (thêm scripts `lab:s2` và `lab:s2:test`)

**Interfaces:**
- Consumes: All modules from Tasks 1–6.
- Produces: Executable CLI walkthrough `labs/scenario-2/run-story.ts` and comprehensive study guide `labs/scenario-2/README.md`.

- [ ] **Step 1: Implement `labs/scenario-2/run-story.ts`**
  - Diễn họa tuần tự 5 Hồi của Tech Lead **Minh Lê** và Junior Developer **Lan Phạm** tại NovaSmart:
    - `[Act 1]` Chẩn đoán lỗi cấu hình `~/.claude/CLAUDE.md`, chuyển sang `.claude/CLAUDE.md` dùng `@import`, nạp có điều kiện `.claude/rules/` theo glob `paths` và giải mã `.mcp.json` `${GITHUB_TOKEN}`.
    - `[Act 2]` Thực thi skill `codebase-audit` với `argument-hint`, chặn tool trái phép bằng `allowed-tools` và cô lập kết quả bằng `context: fork`.
    - `[Act 3]` Định tuyến *Direct Execution* cho bug nhỏ 1 file vs *Plan Mode + Explore Subagent* cho đợt di trú 48 files.
    - `[Act 4]` Tinh chỉnh lặp bằng 3 ví dụ I/O, *Interview Pattern* cho tầng Redis Cache, *TDD Iteration* cho edge case `null`, và gom lỗi tương tác chéo.
    - `[Act 5]` Phát hiện *Context Degradation*, ghi `Scratchpad`, chạy `/compact`, tạo nhánh `fork_session`, và chọn khởi tạo phiên mới với *Structured Summary* thay vì `--resume` dữ liệu lỗi thời.

- [ ] **Step 2: Create `labs/scenario-2/README.md` and update `package.json`**
  - Thêm `"lab:s2": "tsx labs/scenario-2/run-story.ts"` và `"lab:s2:test": "vitest run labs/scenario-2"` vào `package.json`.
  - Viết `labs/scenario-2/README.md` gồm: Định nghĩa học thuật (Definition Anatomy), Sơ đồ Mermaid, Bảng ánh xạ câu hỏi thi CCAF (Domain 3, Domain 5.4, Domain 1.7, Domain 2.4) và hướng dẫn chạy thực hành.

- [ ] **Step 3: Run the Storyline Runner and Test Suite to verify**
Run: `npx tsx labs/scenario-2/run-story.ts && npx vitest run labs/scenario-2/`
Expected: Storyline runner prints all 5 acts cleanly and all 6 test suites PASS.

- [ ] **Step 4: Commit**
```bash
git add labs/scenario-2/run-story.ts labs/scenario-2/README.md package.json
git commit -m "feat(scenario-2): add interactive 5-act storyline runner and pedagogical lab guide"
```

---
*Made by Anh Tu - Share to be share*

