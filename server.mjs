#!/usr/bin/env node
/**
 * 极简 VPS 运行入口（零额外依赖，Node 18+）。
 *
 * Vercel 部署不需要本文件——Vercel 按 api/ 目录自动识别 Serverless 函数。
 * 在自有云服务器（AWS / 阿里云等）上用长驻 Node 进程运行时：
 *
 *   npm install            # 仅需安装 @supabase/supabase-js
 *   cp .env.example .env   # 填好环境变量
 *   node server.mjs        # 默认监听 3000，可用 PORT 覆盖
 *
 * 生产建议用 pm2 或 systemd 守护，前面挂 Nginx 反代 + HTTPS（见 README-deploy.md）。
 * 所有 /api/* 处理函数与 Vercel 共用同一份 api/*.js（相同的 (req, res) handler 签名）。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* ── 零依赖 .env 加载（已存在的环境变量不覆盖）────────────────────── */
try {
  const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
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
} catch { /* 无 .env 文件时依赖外部环境变量（如 systemd EnvironmentFile） */ }

/* ── 路由：路径 → handler 模块（与 api/ 目录一一对应）──────────────── */
const ROUTES = {
  '/api/health': './api/health.js',
  '/api/config': './api/config.js',
  '/api/billing': './api/billing.js',
  '/api/chat': './api/chat.js',
  '/api/data': './api/data.js',
  '/api/subscribe': './api/subscribe.js',
  '/api/webhook/lemonsqueezy': './api/webhook/lemonsqueezy.js',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = ROUTES[url.pathname];

  if (route) {
    try {
      const mod = await import(route);
      await mod.default(req, res);
    } catch (err) {
      console.error('[api]', url.pathname, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: '服务器内部错误' }));
      } else {
        res.end();
      }
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  /* 静态：所有非 /api 路径返回单文件前端（与 vercel.json 的 rewrite 一致） */
  try {
    const html = await readFile(path.join(ROOT, 'meeting-simulator.html'));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch {
    res.statusCode = 500;
    res.end('meeting-simulator.html 缺失');
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`圆桌会服务已启动: http://0.0.0.0:${PORT}`);
});
