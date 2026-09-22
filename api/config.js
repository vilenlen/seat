import { cors, send } from '../lib/http.js';

/** 公开配置（仅暴露给浏览器所需的最小信息，绝不含任何密钥） */
export default function handler(req, res) {
  if (cors(req, res)) return;
  return send(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    freeQuotaTokens: Number(process.env.FREE_QUOTA_TOKENS || 20000),
    proQuotaTokens: Number(process.env.PRO_QUOTA_TOKENS || 2000000),
  });
}
