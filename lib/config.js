/** 环境变量与套餐配置（所有密钥只存在于服务端环境变量） */

export const ENV = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  lsApiKey: process.env.LEMONSQUEEZY_API_KEY || '',
  lsStoreId: process.env.LEMONSQUEEZY_STORE_ID || '',
  lsWebhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
  lsVariantProMonthly: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '',
  lsVariantProYearly: process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY || '',
};

export const PLANS = {
  free: {
    id: 'free',
    label: '免费试用',
    quotaTokens: Number(process.env.FREE_QUOTA_TOKENS || 20000),
    period: 'trial', // 一次性试用额度
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    quotaTokens: Number(process.env.PRO_QUOTA_TOKENS || 2000000),
    period: 'monthly', // 每月重置
  },
};

/** 启动前自检：返回缺失的环境变量名（为空表示齐全） */
export function assertConfigured() {
  const missing = [];
  if (!ENV.supabaseUrl) missing.push('SUPABASE_URL');
  if (!ENV.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ENV.openaiApiKey) missing.push('OPENAI_API_KEY');
  if (!ENV.lsApiKey) missing.push('LEMONSQUEEZY_API_KEY');
  if (!ENV.lsStoreId) missing.push('LEMONSQUEEZY_STORE_ID');
  if (!ENV.lsWebhookSecret) missing.push('LEMONSQUEEZY_WEBHOOK_SECRET');
  if (!ENV.lsVariantProMonthly) missing.push('LEMONSQUEEZY_VARIANT_PRO_MONTHLY');
  return missing;
}
