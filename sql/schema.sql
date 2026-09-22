-- 圆桌会 · Supabase 数据库结构
-- 在 Supabase 控制台 → SQL Editor 中整段执行一次即可。
-- 说明：后端使用 service_role key 访问，故这里 revoke 掉 anon/authenticated 的直接权限，
-- 所有表与增量函数只对服务端可见，浏览器拿不到。

-- 订阅表：每个用户最多一行（user_id 主键）
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ls_subscription_id text,
  ls_variant_id text,
  plan text not null default 'free',
  status text not null default 'free',   -- free | active | past_due | cancelled | expired | paused ...
  renews_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 用量表：period 为 'trial'（免费试用一次性）或 'YYYY-MM'（Pro 按月）
create table if not exists public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  tokens bigint not null default 0,
  requests int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

-- 原子累加用量（并发安全）
create or replace function public.increment_usage(p_user uuid, p_period text, p_tokens bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.usage (user_id, period, tokens, requests, updated_at)
  values (p_user, p_period, p_tokens, 1, now())
  on conflict (user_id, period)
  do update set tokens = public.usage.tokens + excluded.tokens,
                requests = public.usage.requests + 1,
                updated_at = now();
$$;

-- 用户数据表：角色库（含分组）、参会勾选、引擎配置、多底座配置，每个用户一行 JSON
-- 匿名游客（signInAnonymously）同样在 auth.users 中有真实 id，数据挂在其匿名 user_id 下；
-- 游客升级为正式账号后，由前端做数据合并并写回正式账号行。
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 开启行级安全，并关闭客户端角色对这些表与函数的直接访问
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;
alter table public.user_data enable row level security;

revoke all on public.subscriptions from anon, authenticated;
revoke all on public.usage from anon, authenticated;
revoke all on public.user_data from anon, authenticated;
revoke all on function public.increment_usage(uuid, text, bigint) from anon, authenticated;

-- 纵深防御的 RLS 策略（后端实际用 service_role key 访问，绕过 RLS；
-- 以下策略保证即便误发 key，浏览器直连也只能读写自己的行）。
-- 注意：上层 revoke 已收回 anon/authenticated 的表权限，策略默认不会被命中。
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_data' and policyname = 'user_data_self') then
    create policy user_data_self on public.user_data
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
