import { cors, readJson, send } from '../lib/http.js';
import { requireUser } from '../lib/supabase.js';
import { getPlanAndQuota, recordUsage } from '../lib/usage.js';
import { ENV } from '../lib/config.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(payload) {
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ENV.openaiApiKey },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data.error && (data.error.message || data.error.type)) || ('OpenAI HTTP ' + resp.status));
  const text = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
  if (!text) throw new Error('模型未返回文本内容');
  return { text, usage: data.usage || {} };
}

/** 托管推理：鉴权 → 查额度 → 调用 OpenAI → 记账 */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: '仅支持 POST' });

  let user;
  try { user = await requireUser(req); }
  catch (e) { return send(res, e.status || 401, { error: e.message }); }

  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) return send(res, 400, { error: '缺少 prompt' });
  if (prompt.length > 20000) return send(res, 400, { error: 'prompt 过长' });

  const q = await getPlanAndQuota(user.id);
  if (q.used >= q.quota) {
    return send(res, 402, { error: '额度已用完，请升级到 Pro', plan: q.plan, used: q.used, quota: q.quota });
  }

  const payload = {
    model: String(body.model || ENV.openaiModel),
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.8,
    max_tokens: body.max_tokens || 1024,
    messages: Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : [{ role: 'user', content: prompt }],
  };

  try {
    const r = await callOpenAI(payload);
    const tokens = (r.usage && r.usage.total_tokens) || Math.ceil((prompt.length + r.text.length) / 4);
    await recordUsage(user.id, q.period, tokens);
    return send(res, 200, { text: r.text, plan: q.plan, used: q.used + tokens, quota: q.quota });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
}
