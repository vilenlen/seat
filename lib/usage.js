import { sbAdmin } from './supabase.js';
import { PLANS } from './config.js';

/** 月份键，如 2026-08（Pro 按自然月重置额度） */
function monthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** 订阅是否仍有访问权（cancelled 保留到 renews_at；expired/unpaid/paused 立即失效） */
function subActive(row) {
  if (!row) return false;
  if (['expired', 'unpaid', 'paused'].includes(row.status)) return false;
  if (row.renews_at && new Date(row.renews_at).getTime() < Date.now()) return false;
  return true;
}

/** 返回当前用户的套餐、额度、已用量与计费周期 */
export async function getPlanAndQuota(userId) {
  const { data: sub } = await sbAdmin()
    .from('subscriptions').select('*').eq('user_id', userId).maybeSingle();

  if (subActive(sub)) {
    const period = monthKey();
    const { data: u } = await sbAdmin()
      .from('usage').select('tokens').eq('user_id', userId).eq('period', period).maybeSingle();
    return { plan: 'pro', quota: PLANS.pro.quotaTokens, used: u ? Number(u.tokens) : 0, period, subscription: sub };
  }

  const { data: u } = await sbAdmin()
    .from('usage').select('tokens').eq('user_id', userId).eq('period', 'trial').maybeSingle();
  return { plan: 'free', quota: PLANS.free.quotaTokens, used: u ? Number(u.tokens) : 0, period: 'trial', subscription: sub };
}

/** 原子累加用量（并发安全，由数据库函数 increment_usage 实现） */
export async function recordUsage(userId, period, tokens) {
  await sbAdmin().rpc('increment_usage', { p_user: userId, p_period: period, p_tokens: tokens });
}
