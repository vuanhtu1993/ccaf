#!/usr/bin/env node
/**
 * Validate toàn bộ cấu hình Claude Code trong repo.
 *
 * Kiểm tra những lỗi mà Claude Code báo rất mờ (hoặc bỏ qua im lặng):
 *   - .claude/settings.json: JSON hợp lệ, hook trỏ tới script CÓ THẬT và có quyền thực thi
 *   - .claude/agents/*.md:  frontmatter ở dòng đầu, có name + description, field đúng camelCase
 *   - .claude/skills/*\/SKILL.md: name khớp tên thư mục, field đúng dạng gạch nối
 *   - .claude/rules/*.md:   frontmatter paths hợp lệ nếu có
 *   - .mcp.json:            mỗi entry stdio trỏ tới file tồn tại
 *
 * Chạy: npm run validate
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const errors = [];
const warnings = [];
const ok = [];

function fail(message) {
  errors.push(message);
}
function warn(message) {
  warnings.push(message);
}
function pass(message) {
  ok.push(message);
}

function rel(p) {
  return path.relative(ROOT, p) || '.';
}

/** Tách frontmatter YAML thủ công — đủ dùng, không thêm dependency. */
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: null, reason: "'---' không ở dòng đầu" };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, reason: 'thiếu --- đóng' };
  const raw = text.slice(3, end);
  const frontmatter = {};
  let currentKey = null;

  for (const line of raw.split('\n')) {
    // Item của list thuộc key trước đó: "  - \"src/**/*.ts\""
    const itemMatch = /^\s+-\s+(.+)$/.exec(line);
    if (itemMatch && currentKey) {
      const existing = frontmatter[currentKey];
      const item = itemMatch[1].trim().replace(/^["']|["']$/g, '');
      frontmatter[currentKey] = existing ? `${existing},${item}` : item;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      currentKey = key;
      frontmatter[key] = value.trim().replace(/^["']|["']$/g, '');
    }
  }
  return { frontmatter, reason: null };
}

// ── settings.json ───────────────────────────────────────────────────────

const SETTINGS = path.join(ROOT, '.claude', 'settings.json');
const KNOWN_EVENTS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PostToolBatch', 'Notification', 'Stop', 'SubagentStart',
  'SubagentStop', 'PreCompact', 'PostCompact', 'PermissionRequest', 'PermissionDenied',
  'InstructionsLoaded', 'CwdChanged', 'FileChanged', 'ConfigChange',
]);

if (!existsSync(SETTINGS)) {
  fail('.claude/settings.json không tồn tại');
} else {
  let settings;
  try {
    settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
    pass('.claude/settings.json là JSON hợp lệ');
  } catch (error) {
    fail(`.claude/settings.json không parse được: ${error.message}`);
  }

  if (settings) {
    const hooks = settings.hooks ?? {};
    for (const [event, groups] of Object.entries(hooks)) {
      if (!KNOWN_EVENTS.has(event)) {
        fail(`settings.json: event "${event}" không phải hook event hợp lệ`);
        continue;
      }
      if (!Array.isArray(groups)) {
        fail(`settings.json: hooks.${event} phải là mảng`);
        continue;
      }
      for (const [index, group] of groups.entries()) {
        if (!Array.isArray(group?.hooks) || group.hooks.length === 0) {
          fail(`settings.json: hooks.${event}[${index}].hooks phải là mảng không rỗng`);
          continue;
        }
        for (const handler of group.hooks) {
          if (handler?.type !== 'command') continue;
          const command = String(handler.command ?? '');
          const raw = command
            .replace(/\$\{CLAUDE_PROJECT_DIR:-\.\}/g, ROOT)
            .replace(/\$\{CLAUDE_PROJECT_DIR\}/g, ROOT)
            .replace(/\$CLAUDE_PROJECT_DIR/g, ROOT)
            .replace(/^["']|["']$/g, '')
            .trim()
            .split(/\s+/)[0];
          const scriptPath = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);

          if (!existsSync(scriptPath)) {
            fail(`settings.json: hooks.${event} trỏ tới script không tồn tại: ${rel(scriptPath)}`);
            continue;
          }
          const stat = statSync(scriptPath);
          if ((stat.mode & 0o111) === 0) {
            fail(`settings.json: ${rel(scriptPath)} không có quyền thực thi (chmod +x)`);
          } else {
            pass(`hook ${event} -> ${rel(scriptPath)} (tồn tại, +x)`);
          }
        }
      }
    }

    if (!Array.isArray(settings.permissions?.allow ?? [])) {
      fail('settings.json: permissions.allow phải là mảng');
    }
  }
}

// ── agents ──────────────────────────────────────────────────────────────

const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');
/** Field của subagent dùng camelCase; field của skill dùng gạch nối. */
const AGENT_FIELDS = new Set([
  'name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode', 'maxTurns',
  'autoCompactWindow', 'skills', 'mcpServers', 'hooks', 'memory', 'effort', 'isolation',
  'color', 'initialPrompt', 'experimental', 'background',
]);

if (!existsSync(AGENTS_DIR)) {
  warn('.claude/agents/ không tồn tại');
} else {
  for (const file of readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'))) {
    const full = path.join(AGENTS_DIR, file);
    const { frontmatter, reason } = splitFrontmatter(readFileSync(full, 'utf8'));
    if (!frontmatter) {
      fail(`agents/${file}: ${reason} — Claude Code sẽ bỏ qua file này`);
      continue;
    }
    if (!frontmatter.name) {
      fail(`agents/${file}: thiếu name — file bị coi là tài liệu, không phải subagent`);
    }
    if (!frontmatter.description) {
      fail(`agents/${file}: thiếu description — Claude Code skip và chỉ ghi vào debug log`);
    }
    for (const key of Object.keys(frontmatter)) {
      if (!AGENT_FIELDS.has(key)) {
        warn(`agents/${file}: field "${key}" không được nhận diện với subagent (dùng camelCase?)`);
      }
    }
    if (frontmatter.name) pass(`agent ${frontmatter.name} (${file})`);
  }
}

// ── skills ──────────────────────────────────────────────────────────────

const SKILL_FIELDS = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments',
  'disable-model-invocation', 'user-invocable', 'allowed-tools', 'disallowed-tools',
  'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility', 'disable_model_invocation',
]);

const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');
if (!existsSync(SKILLS_DIR)) {
  warn('.claude/skills/ không tồn tại');
} else {
  for (const dir of readdirSync(SKILLS_DIR)) {
    const skillFile = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!existsSync(skillFile)) {
      fail(`skills/${dir}/: thiếu SKILL.md`);
      continue;
    }
    const { frontmatter, reason } = splitFrontmatter(readFileSync(skillFile, 'utf8'));
    if (!frontmatter) {
      fail(`skills/${dir}/SKILL.md: ${reason} — skill sẽ không có field nào`);
      continue;
    }
    if (!frontmatter.name) {
      fail(`skills/${dir}/SKILL.md: thiếu name`);
    } else if (frontmatter.name !== dir) {
      fail(`skills/${dir}/SKILL.md: name "${frontmatter.name}" phải khớp tên thư mục "${dir}"`);
    }
    if (!frontmatter.description) {
      warn(`skills/${dir}/SKILL.md: thiếu description — Claude khó biết khi nào dùng`);
    }
    for (const key of Object.keys(frontmatter)) {
      if (!SKILL_FIELDS.has(key)) {
        warn(
          `skills/${dir}/SKILL.md: field "${key}" không được nhận diện (field skill dùng gạch nối)`
        );
      }
    }
    if (frontmatter.name === dir) pass(`skill ${frontmatter.name}`);
  }
}

// ── rules ───────────────────────────────────────────────────────────────

const RULES_DIR = path.join(ROOT, '.claude', 'rules');
if (!existsSync(RULES_DIR)) {
  warn('.claude/rules/ không tồn tại');
} else {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('.md')) continue;
      const text = readFileSync(full, 'utf8');
      const relPath = rel(full);
      if (!text.startsWith('---')) {
        pass(`rule ${relPath} (luôn bật)`);
        continue;
      }
      const { frontmatter, reason } = splitFrontmatter(text);
      if (!frontmatter) {
        fail(`rule ${relPath}: ${reason}`);
        continue;
      }
      for (const key of Object.keys(frontmatter)) {
        if (key !== 'paths') {
          warn(`rule ${relPath}: field "${key}" không được nhận diện, rule chỉ hỗ trợ paths`);
        }
      }
      if (frontmatter.paths) {
        pass(`rule ${relPath} (path-specific)`);
      } else {
        warn(`rule ${relPath}: có frontmatter nhưng không có paths — sẽ nạp mọi lúc`);
      }
    }
  };
  walk(RULES_DIR);
}

// ── .mcp.json ───────────────────────────────────────────────────────────

const MCP_FILE = path.join(ROOT, '.mcp.json');
if (!existsSync(MCP_FILE)) {
  warn('.mcp.json không tồn tại — Claude Code sẽ không có MCP server nào của repo');
} else {
  let config;
  try {
    config = JSON.parse(readFileSync(MCP_FILE, 'utf8'));
    pass('.mcp.json là JSON hợp lệ');
  } catch (error) {
    fail(`.mcp.json không parse được: ${error.message}`);
  }

  if (config) {
    const servers = config.mcpServers ?? {};
    if (Object.keys(servers).length === 0) fail('.mcp.json: mcpServers rỗng');
    for (const [name, server] of Object.entries(servers)) {
      if (server?.url && !server.type) {
        fail(`.mcp.json: server "${name}" có url nhưng thiếu type -> bị đọc là stdio và bị skip`);
        continue;
      }
      if (server?.type && !['stdio', 'http', 'sse', 'ws'].includes(server.type)) {
        fail(`.mcp.json: server "${name}" có type "${server.type}" không hợp lệ`);
        continue;
      }
      const args = Array.isArray(server?.args) ? server.args : [];
      for (const arg of args) {
        const expanded = String(arg)
          .replace(/\$\{CLAUDE_PROJECT_DIR:-\.\}/g, ROOT)
          .replace(/\$\{CLAUDE_PROJECT_DIR\}/g, ROOT);
        if (!expanded.startsWith(ROOT)) continue;
        if (!existsSync(expanded)) {
          fail(
            `.mcp.json: server "${name}" trỏ tới ${rel(expanded)} chưa tồn tại — chạy "npm run build"`
          );
        } else {
          pass(`mcp ${name} -> ${rel(expanded)} (tồn tại)`);
        }
      }
    }
  }
}

// ── Chống hard-code credential ──────────────────────────────────────────

const ORCHESTRATOR = path.join(ROOT, 'agent-sdk', 'src', 'orchestrator.ts');
if (existsSync(ORCHESTRATOR)) {
  const source = readFileSync(ORCHESTRATOR, 'utf8');

  // Không được chặn cứng khi thiếu ANTHROPIC_API_KEY: Claude Code nhận 4 nguồn
  // xác thực, và credential có thể nằm trong keychain từ /login.
  const hardBlock =
    /if\s*\(\s*!\s*process\.env\[['"]ANTHROPIC_API_KEY['"]\]\s*\)/.test(source);
  if (hardBlock) {
    fail(
      'orchestrator.ts: chặn cứng khi thiếu ANTHROPIC_API_KEY — bỏ điều kiện này, ' +
        'vì CLI còn nhận /login, CLAUDE_CODE_OAUTH_TOKEN và Bedrock/Vertex'
    );
  } else {
    pass('orchestrator không chặn cứng theo ANTHROPIC_API_KEY');
  }

  // Không được nhúng literal key vào source.
  if (/sk-ant-[A-Za-z0-9_-]{20,}/.test(source)) {
    fail('orchestrator.ts: phát hiện chuỗi giống API key hard-code trong source');
  } else {
    pass('orchestrator không hard-code API key');
  }

  // Phải xử lý is_error, nếu không sẽ báo "✓ xong" khi thực tế thất bại.
  if (!source.includes('is_error')) {
    fail('orchestrator.ts: không kiểm tra `is_error` — subtype success vẫn có thể là lỗi');
  } else {
    pass('orchestrator xử lý `is_error` (subtype success có thể là thất bại)');
  }
}

// ── Kết quả ─────────────────────────────────────────────────────────────

console.log('Validate cấu hình Claude Code\n');
for (const line of ok) console.log(`  ✓ ${line}`);
for (const line of warnings) console.warn(`  ! ${line}`);
for (const line of errors) console.error(`  ✗ ${line}`);

console.log();
if (errors.length > 0) {
  console.error(`FAIL — ${errors.length} lỗi, ${warnings.length} cảnh báo, ${ok.length} pass.`);
  process.exitCode = 1;
} else {
  console.log(`PASS — ${ok.length} check, ${warnings.length} cảnh báo.`);
}
