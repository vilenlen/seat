import { cors, readJson, send } from '../lib/http.js';
import { requireUser, sbAdmin } from '../lib/supabase.js';

/**
 * 用户数据同步（角色库 / 参会勾选 / 引擎配置 / 多底座配置）
 *   GET /api/data  → { data: <jsonb|null>, updatedAt: <iso|null> }
 *   PUT /api/data  ← { data: <object> } → { ok: true }
 * 严格鉴权：无有效 JWT（含匿名游客的 JWT）一律 401。
 */
export default async function handler(req, res) {
  if (cors(req, res)) return;

  let user;
  try { user = await requireUser(req); } catch (e) { return send(res, e.status || 401, { error: e.message }); }

  if (req.method === 'GET') {
    const { data, error } = await sbAdmin()
      .from('user_data').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) return send(res, 500, { error: '读取用户数据失败' });
    return send(res, 200, {
      data: data && data.data ? data.data : null,
      updatedAt: data && data.updated_at ? data.updated_at : null,
    });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const payload = body && body.data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return send(res, 400, { error: '缺少 data（需为对象）' });
    }
    const { error } = await sbAdmin()
      .from('user_data')
      .upsert(
        { user_id: user.id, data: payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) return send(res, 500, { error: '保存用户数据失败' });
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: '仅支持 GET / PUT' });
}
