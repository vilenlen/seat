import { createClient } from '@supabase/supabase-js';
import { ENV } from './config.js';

let client = null;

/** 服务端 Supabase 客户端（service_role，可读写数据库，仅后端使用） */
export function sbAdmin() {
  if (!client) {
    if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
      throw new Error('Supabase 未配置（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）');
    }
    client = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** 从 Authorization: Bearer <jwt> 解析并校验当前登录用户 */
export async function requireUser(req) {
  const auth = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!auth) throw new HttpError(401, '未登录');
  const { data, error } = await sbAdmin().auth.getUser(auth);
  if (error || !data || !data.user) throw new HttpError(401, '登录已失效，请重新登录');
  // 禁止匿名游客使用账号类接口（防薅羊毛：免费额度仅对正式登录用户开放）
  if (data.user.is_anonymous) throw new HttpError(401, '请先登录后再使用该功能');
  return data.user;
}
