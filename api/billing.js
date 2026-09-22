import { cors, send } from '../lib/http.js';
import { requireUser } from '../lib/supabase.js';
import { getPlanAndQuota } from '../lib/usage.js';
import { PLANS } from '../lib/config.js';

/** 查询当前用户套餐与额度 */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  let user;
  try { user = await requireUser(req); } catch (e) { return send(res, e.status || 401, { error: e.message }); }

  const q = await getPlanAndQuota(user.id);
  return send(res, 200, {
    email: user.email,
    plan: q.plan,
    planLabel: PLANS[q.plan].label,
    quota: q.quota,
    used: q.used,
    remaining: Math.max(0, q.quota - q.used),
    subscription: q.subscription
      ? { status: q.subscription.status, renewsAt: q.subscription.renews_at }
      : null,
  });
}
