import { cors, readJson, send } from '../lib/http.js';
import { requireUser } from '../lib/supabase.js';
import { lsRequest } from '../lib/lemonsqueezy.js';
import { ENV } from '../lib/config.js';

/** 创建 Lemon Squeezy 订阅结账链接，前端跳转去付款 */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: '仅支持 POST' });

  let user;
  try { user = await requireUser(req); } catch (e) { return send(res, e.status || 401, { error: e.message }); }

  const body = await readJson(req).catch(() => ({}));
  const variantId = body.variantId || ENV.lsVariantProMonthly;
  if (!variantId) return send(res, 500, { error: '未配置套餐 variant id（LEMONSQUEEZY_VARIANT_PRO_MONTHLY）' });
  if (!ENV.lsStoreId) return send(res, 500, { error: '未配置 LEMONSQUEEZY_STORE_ID' });

  try {
    const data = await lsRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: user.email,
              custom: { user_id: user.id }, // 随 webhook 回传，用于关联到账户
            },
            product_options: {
              redirect_url: String(body.redirectUrl || '').slice(0, 500) || undefined,
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: ENV.lsStoreId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    });
    return send(res, 200, { url: data && data.data && data.data.attributes && data.data.attributes.url });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
}
