#!/usr/bin/env node
/**
 * Seat · 一席 · 本地桥接服务（零依赖，Node 18+；会话库用 Node 22.5+ 内置 node:sqlite）
 *
 * 浏览器无法直接 spawn 本机进程、也常被云端 LLM 的 CORS 拦截；
 * 本服务在本机提供：
 *   GET  /health         探测服务与本机 agent CLI 是否可用
 *   POST /agent          调用本机 claude / codex CLI（stdin 传 prompt）
 *   POST /llm            转发 OpenAI 兼容 / Anthropic 云端请求
 *   GET  /api/config     公开配置（Supabase URL / anon key / 套餐额度，读 .env）
 *   GET  /api/sessions   本地会话库（SQLite）列表
 *   GET|PUT|DELETE /api/sessions/:id   会话详情 / 快照 / 删除
 *   GET  /               顺带静态托管当前目录（用 http:// 打开页面可彻底规避跨域）
 *
 * 仅绑定 127.0.0.1，不接受外网访问。
 * 用法：node bridge.mjs [端口]   （默认 5174）
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || process.env.BRIDGE_PORT || 5174);
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const AGENT_TIMEOUT_MS = 180_000;

/* ── 零依赖 .env 加载（与 server.mjs 相同规则：不覆盖已有环境变量）──── */
try {
  const raw = await readFile(join(ROOT, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch { /* 无 .env 文件时依赖外部环境变量 */ }

/* ── 本地会话库（SQLite）────────────────────────────────────────── */
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'sessions.db'));
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT DEFAULT '',
  background TEXT DEFAULT '',
  assets TEXT DEFAULT '{"topic":[],"bg":[]}',
  summary TEXT DEFAULT '',
  status TEXT DEFAULT 'running',
  roles TEXT DEFAULT '[]',
  messages TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);
/* 旧库平滑加列（CREATE TABLE IF NOT EXISTS 不会更新已存在的表结构）*/
for (const [col, ddl] of [
  ['assets', "ALTER TABLE sessions ADD COLUMN assets TEXT DEFAULT '{}'"],
  ['summary', "ALTER TABLE sessions ADD COLUMN summary TEXT DEFAULT ''"],
]) {
  const cols = db.prepare('PRAGMA table_info(sessions)').all().map(c => c.name);
  if (!cols.includes(col)) db.exec(ddl);
}
const qList = db.prepare(`SELECT id, title, status, updated_at, summary,
  json_array_length(messages) AS message_count FROM sessions ORDER BY updated_at DESC`);
const qGet = db.prepare('SELECT id, title, topic, background, assets, summary, status, roles, messages, created_at, updated_at FROM sessions WHERE id = ?');
const qUpsert = db.prepare(`INSERT INTO sessions (id, title, topic, background, assets, summary, status, roles, messages, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, topic = excluded.topic, background = excluded.background,
    assets = excluded.assets, summary = excluded.summary,
    status = excluded.status, roles = excluded.roles, messages = excluded.messages,
    updated_at = excluded.updated_at`);
const qDelete = db.prepare('DELETE FROM sessions WHERE id = ?');

function parseJsonArr(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }
function toJsonStr(v) {
  if (v == null) return '[]';
  if (typeof v === 'string') return v === '' ? '[]' : v;
  return JSON.stringify(v);
}
function validStatus(s) { return (s === 'paused' || s === 'ended') ? s : 'running'; }
function hydrateRow(r) {
  let assets = { topic: [], bg: [] };
  try {
    const parsed = JSON.parse(r.assets || '{}');
    if (parsed && typeof parsed === 'object') assets = { topic: Array.isArray(parsed.topic) ? parsed.topic : [], bg: Array.isArray(parsed.bg) ? parsed.bg : [] };
  } catch { /* 旧数据无附件 */ }
  return { id: r.id, title: r.title, topic: r.topic, background: r.background, assets,
    summary: r.summary || '', status: r.status,
    roles: parseJsonArr(r.roles), messages: parseJsonArr(r.messages), created_at: r.created_at, updated_at: r.updated_at };
}

/* ── 工具 ─────────────────────────────────────────────────────── */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function run(cmd, args, input, timeoutMs = AGENT_TIMEOUT_MS, allowFail = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(cmd + ' 执行超时')); }, timeoutMs);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(new Error(cmd + ' 启动失败：' + e.message)); });
    child.on('close', code => {
      clearTimeout(timer);
      // allowFail：CLI 旁路任务（如会话标题生成）可能因模型配置失败而退出码非 0，
      // 但主结果仍在 stdout 的 JSON 里，交给调用方按 JSON 内容判断成败
      if (code === 0 || allowFail) resolve({ out, err, code });
      else reject(new Error(cmd + ' 退出码 ' + code + (err ? '：' + err.slice(-500) : '')));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}
async function probeCli(cmd) {
  try {
    const { out } = await run(cmd, ['--version'], '', 8000);
    return { ok: true, version: out.trim().split('\n')[0].slice(0, 60) };
  } catch (e) { return { ok: false, error: e.message }; }
}

/* ── 本机 Agent CLI ───────────────────────────────────────────── */
const MEDIA_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'application/pdf': '.pdf',
};
/** 把 dataURL 附件落成临时文件，返回文件路径（调用方负责清理）*/
async function materializeAttachments(binaries) {
  const files = [];
  if (!Array.isArray(binaries)) return files;
  for (const [i, b] of binaries.slice(0, 20).entries()) {
    const m = String((b && b.dataUrl) || '').match(/^data:([\w./+-]+);base64,(.+)$/);
    if (!m) continue;
    const ext = MEDIA_EXT[m[1]] || '.bin';
    const safeId = String(b.id || 'att').replace(/[^\w-]/g, '').slice(0, 40) || 'att';
    const file = join(tmpdir(), `seat-att-${process.pid}-${safeId}-${i}${ext}`);
    await writeFile(file, Buffer.from(m[2], 'base64'));
    files.push(file);
  }
  return files;
}
async function callAgent({ agent, prompt, model, binaries }) {
  if (agent === 'claude') {
    // 无头模式：stdin 传 prompt，JSON 输出，结果在 result 字段
    // 纯文本一轮即可；带图片 / PDF 时 CLI 可能先用一轮读文件，放宽到 3 轮
    const files = await materializeAttachments(binaries);
    const args = ['-p', '--output-format', 'json', '--max-turns', files.length ? '3' : '1',
      '--permission-mode', 'bypassPermissions'];
    if (model) args.push('--model', model);
    // 图片 / PDF 以文件路径作为位置参数传入，CLI 会作为多模态输入读入
    args.push(...files);
    try {
      const { out, err } = await run('claude', args, prompt, AGENT_TIMEOUT_MS, files.length > 0);
      let parsed;
      try { parsed = JSON.parse(out); }
      catch { throw new Error('claude 返回非 JSON：' + (out.slice(-300) || err.slice(-300))); }
      const text = (parsed.result || '').trim();
      if (parsed.is_error || !text) {
        throw new Error('claude 调用失败：' + (text || err.slice(-300) || '返回为空'));
      }
      return { text };
    } finally {
      await Promise.all(files.map(f => unlink(f).catch(() => {})));
    }
  }
  if (agent === 'codex') {
    if (Array.isArray(binaries) && binaries.length) {
      throw new Error('codex 本地模式暂不支持图片 / PDF 附件，请改用 claude 或云端多模态底座');
    }
    // 非交互模式：'-' 表示从 stdin 读 prompt；stdout 即最终消息
    const args = ['exec', '-', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only'];
    if (model) args.push('--model', model);
    const { out } = await run('codex', args, prompt);
    const text = out.trim();
    if (!text) throw new Error('codex 返回为空');
    return { text };
  }
  throw new Error('未知 agent：' + agent);
}

/* ── 云端 LLM 转发 ───────────────────────────────────────────── */
async function callLlm({ provider, baseUrl, apiKey, payload }) {
  const url = provider === 'anthropic'
    ? baseUrl.replace(/\/$/, '') + '/v1/messages'
    : baseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey || '';
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = 'Bearer ' + (apiKey || '');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    throw new Error('无法连接推理服务（' + url + '）：' + e.message + '。若直连被跨域拦截，请运行 bridge.mjs 经桥接转发。');
  }
  clearTimeout(timer);
  const raw = await resp.text();
  if (!resp.ok) throw new Error('推理服务返回 ' + resp.status + '：' + raw.slice(-300));
  const data = JSON.parse(raw);
  const text = provider === 'anthropic'
    ? (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    : (data.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('推理服务未返回文本内容');
  return { text };
}

/* ── 静态托管 ─────────────────────────────────────────────────── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/meeting-simulator.html';
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT)) return json(res, 403, { error: '禁止访问' });
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch { json(res, 404, { error: '文件不存在：' + rel }); }
}

/* ── 服务 ─────────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const [claude, codex] = await Promise.all([probeCli('claude'), probeCli('codex')]);
      return json(res, 200, { ok: true, service: 'yuanzhuo-bridge', agents: { claude, codex } });
    }
    if (req.method === 'POST' && url.pathname === '/agent') {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!body.prompt) return json(res, 400, { error: '缺少 prompt' });
      if (body.agent !== 'claude' && body.agent !== 'codex') return json(res, 400, { error: 'agent 须为 claude 或 codex' });
      const r = await callAgent(body);
      return json(res, 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/llm') {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!body.payload) return json(res, 400, { error: '缺少 payload' });
      const r = await callLlm(body);
      return json(res, 200, r);
    }

    /* 公开配置（与 api/config.js 同构：仅暴露安全的最小信息） */
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        freeQuotaTokens: Number(process.env.FREE_QUOTA_TOKENS || 20000),
        proQuotaTokens: Number(process.env.PRO_QUOTA_TOKENS || 2000000),
      });
    }

    /* 会话接口：/api/sessions 与 /api/sessions/:id */
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'api' && parts[1] === 'sessions') {
      const id = parts[2];
      if (req.method === 'GET' && !id) {
        const rows = qList.all();
        return json(res, 200, rows.map(r => ({ id: r.id, title: r.title, status: r.status,
          updated_at: r.updated_at, message_count: r.message_count || 0,
          has_summary: !!(r.summary && r.summary.trim()) })));
      }
      if (req.method === 'GET' && id) {
        const r = qGet.get(id);
        if (!r) return json(res, 404, { error: '会话不存在' });
        return json(res, 200, hydrateRow(r));
      }
      if (req.method === 'PUT' && id) {
        const body = JSON.parse(await readBody(req) || '{}');
        const title = String(body.title ?? '').trim() || '未命名会议';
        const now = Date.now();
        const existing = qGet.get(id);
        let assetsStr = body.assets;
        if (typeof assetsStr !== 'string') assetsStr = JSON.stringify(assetsStr || { topic: [], bg: [] });
        qUpsert.run(id, title, String(body.topic ?? ''), String(body.background ?? ''),
          assetsStr, String(body.summary ?? ''),
          validStatus(body.status), toJsonStr(body.roles), toJsonStr(body.messages),
          existing ? existing.created_at : now, now);
        return json(res, 200, { ok: true, id, updated_at: now });
      }
      if (req.method === 'DELETE' && id) {
        qDelete.run(id);
        return json(res, 200, { ok: true, id });
      }
    }
    if (req.method === 'GET') return serveStatic(req, res, url.pathname);
    json(res, 404, { error: '未知路径' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Seat · 一席 桥接服务已启动：');
  console.log('  页面    http://127.0.0.1:' + PORT + '/');
  console.log('  健康检查 http://127.0.0.1:' + PORT + '/health');
  console.log('  会话库  SQLite :: ' + join(DATA_DIR, 'sessions.db'));
  console.log('按 Ctrl+C 停止。');
});
