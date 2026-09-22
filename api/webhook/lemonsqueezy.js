import { readRaw, send } from '../../lib/http.js';
import { sbAdmin } from '../../lib/supabase.js';
import { verifyWebhook } from '../../lib/lemonsqueezy.js';

const HANDLED = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_resumed',
  'subscription_payment_success',
  'subscription_payment_failed',
]);

/** 接收 Lemon Squeezy 订阅事件并同步到 subscriptions 表 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: '仅支持 POST' });

  const raw = await readRaw(req);
  if (!verifyWebhook(raw, req.headers['x-signature'])) {
    return send(res, 401, { error: '签名校验失败' });
  }

  let payload;
  try { payload = JSON.parse(raw); } catch { return send(res, 400, { error: '非法 JSON' }); }

  const event = payload.meta && payload.meta.event_name;
  if (!event) return send(res, 400, { error: '缺少 event_name' });
  if (!HANDLED.has(event)) return send(res, 200, { ignored: event });

  const data = payload.data || {};
  if (data.type !== 'subscriptions') return send(res, 200, { ignored: '非订阅对象' });

  const attrs = data.attributes || {};
  const custom = payload.meta.custom_data || {};
  const userId = custom.user_id;
  if (!userId) return send(res, 400, { error: '缺少 custom_data.user_id' });

  const variantId = attrs.variant_id
    || (attrs.first_subscription_item && attrs.first_subscription_item.variant_id)
    || null;

  await sbAdmin().from('subscriptions').upsert({
    user_id: userId,
    ls_subscription_id: String(data.id),
    ls_variant_id: variantId ? String(variantId) : null,
    plan: 'pro',
    status: attrs.status || 'unknown',
    renews_at: attrs.renews_at || null,
    ends_at: attrs.ends_at || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return send(res, 200, { ok: true, event });
}
