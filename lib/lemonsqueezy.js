import crypto from 'node:crypto';
import { ENV } from './config.js';

const LS_API = 'https://api.lemonsqueezy.com/v1';

export async function lsRequest(path, { method = 'GET', body } = {}) {
  const resp = await fetch(LS_API + path, {
    method,
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': 'Bearer ' + ENV.lsApiKey,
    },
    body,
  });
  const raw = await resp.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* 忽略解析失败 */ }
  if (!resp.ok) {
    const detail = data && data.errors && data.errors[0] && (data.errors[0].detail || data.errors[0].title);
    throw new Error(detail || ('Lemon Squeezy HTTP ' + resp.status));
  }
  return data;
}

/** 校验 Lemon Squeezy webhook 签名（对原始请求体做 HMAC-SHA256） */
export function verifyWebhook(rawBody, signatureHeader) {
  if (!ENV.lsWebhookSecret) return true; // 未配置时跳过（仅开发环境）
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', ENV.lsWebhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
