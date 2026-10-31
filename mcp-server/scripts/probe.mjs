#!/usr/bin/env node
/**
 * Probe: kiểm tra MCP server bằng client thật qua stdio.
 *
 * Chạy: npm --prefix mcp-server run probe
 * Không cần ANTHROPIC_API_KEY — chỉ test giao thức và tính toàn vẹn KB.
 *
 * Exit 0 nếu tất cả check pass, exit 1 nếu có check fail.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(here, '..', 'dist', 'index.js');

const checks = [];
function check(name, fn) {
  checks.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Một tool result có content là mảng block; lấy text đầu tiên. */
function textOf(result) {
  const block = Array.isArray(result?.content)
    ? result.content.find((entry) => entry.type === 'text')
    : undefined;
  return block?.text ?? '';
}

/** Prompt message có content là MỘT block đơn, không phải mảng. */
function textOfBlock(block) {
  return block?.type === 'text' ? (block.text ?? '') : '';
}

function jsonOf(result) {
  return JSON.parse(textOf(result));
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  stderr: 'pipe',
});

const client = new Client({ name: 'cca-probe', version: '0.1.0' });

let failures = 0;

client.onerror = (error) => {
  failures += 1;
  console.error(`  ✗ Lỗi giao thức JSON-RPC (stdout bị ô nhiễm): ${error.message}`);
};

try {
  await client.connect(transport);

  const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
  const resources = (await client.listResources()).resources.map((r) => r.uri).sort();
  const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort();

  check('đủ 6 tool', async () => {
    assert(tools.length === 6, `mong 6 tool, nhận ${tools.length}: ${tools.join(', ')}`);
  });

  check('đủ 2 resource', async () => {
    assert(
      resources.join(',') === 'cca://domains,cca://glossary',
      `resource nhận được: ${resources.join(', ')}`
    );
  });

  check('đủ 2 prompt', async () => {
    assert(
      prompts.join(',') === 'exam-brief,study-session',
      `prompt nhận được: ${prompts.join(', ')}`
    );
  });

  check('audit_kb báo ok', async () => {
    const report = jsonOf(await client.callTool({ name: 'audit_kb', arguments: {} }));
    assert(report.ok === true, `KB có lỗi: ${JSON.stringify(report.problems)}`);
    assert(report.concepts >= 20, `mong >= 20 concept, nhận ${report.concepts}`);
    assert(report.quizItems >= 20, `mong >= 20 câu quiz, nhận ${report.quizItems}`);
  });

  check('mỗi tầng đều có concept', async () => {
    const report = jsonOf(await client.callTool({ name: 'audit_kb', arguments: {} }));
    for (const layer of ['api', 'agent-sdk', 'claude-code', 'mcp']) {
      assert((report.theoLayer[layer] ?? 0) > 0, `tầng ${layer} chưa có concept nào`);
    }
  });

  check('list_concepts lọc theo layer', async () => {
    const result = jsonOf(
      await client.callTool({ name: 'list_concepts', arguments: { layer: 'claude-code' } })
    );
    assert(result.count > 0, 'lọc claude-code trả về rỗng');
    assert(
      result.concepts.every((concept) => concept.layer === 'claude-code'),
      'có concept sai layer lọt vào kết quả'
    );
  });

  check('get_concept trả về concept thật', async () => {
    const result = jsonOf(
      await client.callTool({ name: 'get_concept', arguments: { id: 'cc-hooks-exit-codes' } })
    );
    assert(result.concept?.id === 'cc-hooks-exit-codes', 'sai concept trả về');
    assert(result.concept.sources.length > 0, 'concept thiếu sources');
  });

  check('get_concept xử lý id sai', async () => {
    const result = await client.callTool({
      name: 'get_concept',
      arguments: { id: 'khong-ton-tai' },
    });
    assert(result.isError === true, 'id sai phải trả isError: true');
  });

  check('generate_quiz ẩn đáp án', async () => {
    const result = jsonOf(
      await client.callTool({ name: 'generate_quiz', arguments: { count: 4 } })
    );
    assert(result.questions.length === 4, `mong 4 câu, nhận ${result.questions.length}`);
    for (const question of result.questions) {
      assert(question.options.length === 4, `${question.id} không có đúng 4 phương án`);
      assert(!('answerIndex' in question), `${question.id} làm lộ answerIndex`);
      assert(!('explanation' in question), `${question.id} làm lộ explanation`);
    }
  });

  check('generate_quiz balanced trải đều domain', async () => {
    const result = jsonOf(
      await client.callTool({ name: 'generate_quiz', arguments: { count: 8, balanced: true } })
    );
    const domains = new Set(result.questions.map((question) => question.domain));
    assert(domains.size === 4, `mong đủ 4 domain, nhận ${[...domains].join(', ')}`);
  });

  check('grade_answer có đúng một đáp án đúng', async () => {
    const quiz = jsonOf(
      await client.callTool({
        name: 'generate_quiz',
        arguments: { count: 1, domain: 'claude-code-config' },
      })
    );
    const question = quiz.questions[0];
    const outcomes = [];
    for (let index = 0; index < 4; index += 1) {
      const graded = jsonOf(
        await client.callTool({
          name: 'grade_answer',
          arguments: { quizId: question.id, selectedIndex: index },
        })
      );
      outcomes.push(graded.correct);
    }
    const correctCount = outcomes.filter(Boolean).length;
    assert(correctCount === 1, `mong đúng 1 đáp án đúng cho ${question.id}, nhận ${correctCount}`);
  });

  check('score_report tính điểm theo domain', async () => {
    const quiz = jsonOf(
      await client.callTool({ name: 'generate_quiz', arguments: { count: 8, balanced: true } })
    );
    const answers = quiz.questions.map((question) => ({ quizId: question.id, selectedIndex: 0 }));
    const report = jsonOf(await client.callTool({ name: 'score_report', arguments: { answers } }));
    assert(report.tong.tong === 8, `mong tổng 8, nhận ${report.tong.tong}`);
    assert(report.theoDomain.length === 4, 'báo cáo phải có 4 domain');
    const sumTotal = report.theoDomain.reduce((acc, entry) => acc + entry.total, 0);
    assert(sumTotal === 8, `tổng theo domain (${sumTotal}) phải khớp 8`);
  });

  check('resource glossary đọc được', async () => {
    const result = await client.readResource({ uri: 'cca://glossary' });
    const text = result.contents[0]?.text ?? '';
    assert(text.includes('# Glossary'), 'glossary thiếu tiêu đề');
    assert(text.includes('## MCP'), 'glossary thiếu mục MCP');
  });

  check('resource domains đọc được', async () => {
    const result = await client.readResource({ uri: 'cca://domains' });
    const parsed = JSON.parse(result.contents[0]?.text ?? '[]');
    assert(parsed.length === 4, `mong 4 domain, nhận ${parsed.length}`);
  });

  check('prompt study-session sinh được', async () => {
    const result = await client.getPrompt({
      name: 'study-session',
      arguments: { layer: 'mcp' },
    });
    assert(result.messages.length > 0, 'prompt rỗng');
    assert(
      textOfBlock(result.messages[0].content).includes('MCP'),
      'prompt không nhắc tới layer MCP'
    );
  });

  check('prompt exam-brief sinh được', async () => {
    const result = await client.getPrompt({ name: 'exam-brief', arguments: { count: '20' } });
    assert(textOfBlock(result.messages[0].content).includes('20'), 'prompt không nhắc tới số câu');
  });
} catch (error) {
  console.error('Không kết nối được MCP server:', error);
  process.exitCode = 1;
} finally {
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`  ✗ ${name}`);
      console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await client.close().catch(() => {});
  console.log();
  if (failures === 0 && process.exitCode !== 1) {
    console.log(`Probe PASS — ${checks.length}/${checks.length} check.`);
  } else {
    console.error(`Probe FAIL — ${failures} check lỗi.`);
    process.exitCode = 1;
  }
}
