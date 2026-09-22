# 圆桌会 · 海外版部署手册（付费订阅）

技术栈：**Vercel**（静态前端 + Serverless 后端）+ **Supabase**（登录 + 数据库）+ **Lemon Squeezy**（订阅支付）+ **OpenAI**（托管推理）。

```
浏览器 ──► 静态页(meeting-simulator.html)
              │  /api/chat   /api/billing   /api/subscribe   /api/data   /api/webhook/lemonsqueezy
              ▼
          Node 后端（Vercel Serverless，或 VPS 上 node server.mjs 长驻进程）
              ├─ Supabase Auth（邮箱魔法链接 / Google OAuth，校验 JWT）
              ├─ Supabase Postgres（subscriptions / usage / user_data 表）
              ├─ OpenAI API（后端持 key，前端不可见）
              └─ Lemon Squeezy（创建结账 + 订阅 webhook）
```

登录方式两种：**邮箱魔法链接**、**Google OAuth**。
**匿名游客已禁用**（防止清存储重置免费额度薅羊毛）：未登录用户数据仅存本机
localStorage（离线可用），托管模式 / 免费额度需登录后使用；服务端 `requireUser`
对 `is_anonymous` 的 JWT 一律返回 401，Supabase 后台请保持 Anonymous provider 关闭。
登录后角色库、分组、参会勾选、引擎与多底座配置经 `/api/data` 同步到 Supabase，按用户隔离。

目录结构：

```
meeting-simulator.html   前端（含托管模式 + 登录/订阅/云同步 UI）
bridge.mjs               本地开发桥接（生产不用）
server.mjs               VPS 长驻 Node 入口（零额外依赖；Vercel 部署不需要）
api/                     后端函数（chat / billing / subscribe / data / config / health / webhook）
lib/                     服务端工具（supabase / usage / lemonsqueezy / config / http）
sql/schema.sql           数据库结构（Supabase SQL Editor 执行）
vercel.json              Vercel：/ → meeting-simulator.html 重写
.env.example             环境变量模板
```

---

## 前置条件

- GitHub 账号（或直接 `vercel` CLI）
- 可用的邮箱服务（Supabase 默认发登录邮件，生产建议接自定义 SMTP）
- 一张能用于 Lemon Squeezy 测试付款的信用卡（测试模式可用测试卡）

---

## 第 1 步 · Supabase（登录 + 数据库）

1. [supabase.com](https://supabase.com) 注册并新建项目，地区选 `us-east`（离 Vercel / 海外 VPS 近）。
2. 项目内打开 **SQL Editor**，粘贴 `sql/schema.sql` 全文，点击 Run。
   - 该脚本建 `subscriptions`、`usage`、`user_data` 三张表（`user_data` 存登录用户的
     角色库 / 勾选 / 引擎与底座配置，一行一个用户，JSONB）。脚本可重复执行，老项目补跑一次即可加上新表。
3. **Project Settings → API**，记下三个值：
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`（⚠️ 只放后端，绝不进前端）
4. **Authentication → Providers**：
   - **Email**：确认邮箱登录已启用（默认启用）。生产建议在 **Authentication → SMTP Settings**
     接入自定义 SMTP（如 Resend），否则登录邮件走 Supabase 默认发送，有每日限额。
   - **Anonymous**：**保持关闭**（Allow anonymous sign-ins 不要开）。产品已禁用游客试用
     托管模式以防额度滥用；未登录用户回退为纯本机 localStorage。
   - **Google**：按下面「第 1b 步」配置。
5. **Authentication → URL Configuration**：
   - **Site URL** 填正式站点地址，如 `https://your-domain.com/`（VPS 部署同理，填 VPS 域名）。
   - **Redirect URLs** 白名单（OAuth / 魔法链接回跳地址必须在列）：加入
     `https://your-domain.com/**`；本地开发加 `http://localhost:3000/**`（Vercel CLI 端口）等。
     VPS 部署即 `https://<VPS 域名>/**`。

### 第 1b 步 · Google OAuth 登录

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)，新建或选择一个项目。
2. **APIs & Services → OAuth consent screen**：选 **External**，填应用名、用户支持邮箱、
   开发者邮箱；发布状态选 **In production**（Testing 模式只允许白名单邮箱登录）。
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**：
   - Application type 选 **Web application**。
   - **Authorized JavaScript origins**：加 `https://<project-ref>.supabase.co`
     （`<project-ref>` 是 Supabase Project URL 里的子域名）以及你的站点域名
     `https://your-domain.com`。
   - **Authorized redirect URIs**：填 Supabase 统一回调地址
     `https://<project-ref>.supabase.co/auth/v1/callback`
     （⚠️ 不是你自己的站点地址；Supabase 完成 OAuth 后再带 token 跳回你的站点）。
4. 复制 **Client ID** 与 **Client secret**。
5. 回到 Supabase：**Authentication → Providers → Google**，打开 Enable，
   粘贴 Client ID / Client secret，保存。
6. 前端「使用 Google 登录」按钮走 `signInWithOAuth({ provider: 'google' })`，
   回跳后 supabase-js 自动解析会话，无需额外配置。

### 匿名登录与防薅羊毛策略

- 前端不再发起 `signInAnonymously()`，已存在的匿名会话在启动时自动 `signOut()`。
- 服务端 `lib/supabase.js` 的 `requireUser()` 对 `user.is_anonymous === true` 一律
  返回 401「请先登录后再使用该功能」，`/api/chat`、`/api/billing`、`/api/data` 全部生效，
  即使有人绕过前端直接拿匿名 JWT 调接口也用不了免费额度。
- 未登录用户：本地 Agent / 云端 LLM（自带 key）两种引擎和全部本地功能正常可用，
  数据存本机 localStorage；只有托管 AI（后端持 OpenAI key）要求登录。

## 第 2 步 · OpenAI

1. [platform.openai.com](https://platform.openai.com) → API keys → Create secret key。
2. 记下 key → `OPENAI_API_KEY`。默认模型 `gpt-4o-mini`，可用 `OPENAI_MODEL` 覆盖。

## 第 3 步 · Lemon Squeezy（订阅支付）

1. [app.lemonsqueezy.com](https://app.lemonsqueezy.com) 注册。
2. **Settings → Stores** 创建/进入商店，从浏览器 URL 中取数字 **store id** → `LEMONSQUEEZY_STORE_ID`。
3. **Products → New product**，建一个「Pro」订阅产品，添加 **variant**（如 `Pro 月付 · $9.99/月`）。
   - 打开该 variant 页面，URL 末尾数字为 **variant id** → `LEMONSQUEEZY_VARIANT_PRO_MONTHLY`。
   - 可再加一个年付 variant → `LEMONSQUEEZY_VARIANT_PRO_YEARLY`（可选）。
4. **Settings → API → Create API key** → `LEMONSQUEEZY_API_KEY`。
5. **Settings → Webhooks**：
   - URL：`https://<你的域名>/api/webhook/lemonsqueezy`
   - 勾选事件：`subscription_created`、`subscription_updated`、`subscription_cancelled`、`subscription_expired`、`subscription_paused`、`subscription_unpaused`、`subscription_resumed`、`subscription_payment_success`、`subscription_payment_failed`
   - 生成/填写 **Signing secret** → `LEMONSQUEEZY_WEBHOOK_SECRET`
6. 测试模式：测试前把 **Store 切到 Test mode**，用测试卡号 `4242 4242 4242 4242` 支付；上线前切回 Live。

## 第 4 步 · 部署到 Vercel

### 方式 A：GitHub 一键（推荐）

```bash
cd /Users/violin/projects/ic
git init && git add -A && git commit -m "圆桌会海外版"
# 推到你的 GitHub 仓库后，在 vercel.com 导入该仓库
```

导入后，在 **Project → Settings → Environment Variables** 里按 `.env.example` 填齐所有变量，然后 Deploy。

### 方式 B：CLI 直接部署

```bash
npm install          # 安装 @supabase/supabase-js（后端用）
npx vercel           # 首次会登录并创建项目
npx vercel env add   # 逐条添加环境变量（或直接 vercel env pull 后编辑 .env）
npx vercel --prod    # 生产部署
```

### 环境变量清单（全部为 Production + Preview 都要设）

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | 前端用，可暴露 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅后端，绝不暴露 |
| `OPENAI_API_KEY` | OpenAI key |
| `OPENAI_MODEL` | 默认 `gpt-4o-mini` |
| `LEMONSQUEEZY_API_KEY` | LS API key |
| `LEMONSQUEEZY_STORE_ID` | LS store id |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | LS webhook 签名密钥 |
| `LEMONSQUEEZY_VARIANT_PRO_MONTHLY` | 月付 variant id |
| `FREE_QUOTA_TOKENS` | 可选，免费试用额度，默认 20000 |
| `PRO_QUOTA_TOKENS` | 可选，Pro 月额度，默认 2000000 |

> 新增 Google 登录、匿名游客、`/api/data` 数据云同步**不需要任何新环境变量**。

## 第 4b 步 · VPS 部署（可选，替代 Vercel）

不想用 Vercel 时，可在 AWS / 阿里云等云服务器上用长驻 Node 进程运行。
`server.mjs` 是零额外依赖的启动入口（Node 18+，全局 fetch 原生可用），它把
`/api/*` 按路径路由到与 Vercel 完全相同的 `api/*.js` handler（同一套 `(req, res)` 签名），
其余路径返回 `meeting-simulator.html` 单页。

```bash
# 在服务器上（Node 18+）
npm install                       # 仅安装 @supabase/supabase-js
cp .env.example .env && vi .env   # 填齐环境变量（与 Vercel 同一份）
PORT=3000 npm start               # 即 node server.mjs
```

进程守护（二选一）：

```bash
# pm2
npm i -g pm2
pm2 start server.mjs --name yuanzhuo
pm2 save && pm2 startup

# 或 systemd：/etc/systemd/system/yuanzhuo.service
# [Service]
# WorkingDirectory=/opt/ic
# EnvironmentFile=/opt/ic/.env
# ExecStart=/usr/bin/node server.mjs
# Restart=always
```

Nginx 反代 + HTTPS（Let's Encrypt）要点：

```nginx
server {
  server_name your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo certbot --nginx -d your-domain.com   # 自动签证书并改 Nginx 配置
```

注意事项：
- `.env` 可用 systemd 的 `EnvironmentFile` 或 pm2 的 `--env` 加载；`server.mjs` 自身也会读项目根目录 `.env`。
- Supabase **Authentication → URL Configuration** 的 Site URL / Redirect URLs 白名单
  要改成 VPS 域名（`https://<VPS 域名>/**`）；Google OAuth Client 的
  Authorized JavaScript origins 也加上 VPS 域名（redirect URI 仍是 Supabase 的
  `/auth/v1/callback`，不用改）。
- Lemon Squeezy webhook URL 改为 `https://<VPS 域名>/api/webhook/lemonsqueezy`。

## 第 5 步 · 端到端验证

1. 打开部署域名：未登录时右上角显示「登录」；若已开 Anonymous provider，
   打开引擎设置切到「托管 AI」应能直接试用（自动游客身份）。
2. 点「登录」→ 邮箱魔法链接：收邮件点链接回到站点，右上角显示邮箱/姓名。
   再试「使用 Google 登录」按钮（账户弹窗与引擎托管面板各有一个）：跳 Google 授权后回到站点、
   右上角显示 Google 姓名。
3. 登录后建一个角色 / 改引擎设置 → 刷新页面或换浏览器登录同一账号，数据应自动同步（走 `/api/data`）。
4. 游客模式下添加角色，再点 Google 登录：登录后角色应保留（自动合并）。
5. 打开「配置推理引擎」→ 选「托管 AI」→ 保存 → 开始会议：角色应正常生成发言（走 `/api/chat`）。
6. 账户弹窗里应显示额度条（免费试用 20k tokens）。
7. 点「升级到 Pro」→ 跳 Lemon Squeezy → 测试卡支付 → 回调后额度条应变为 Pro（最多等 30s 轮询）。
8. 在 LS Webhooks 页面看最近事件是否 200（也可用「Send test event」测签名）。

## 本地开发

```bash
npm install
npx vercel dev     # 方式一：Vercel CLI，本地同时起前端 + /api，读 .env 环境变量
npm start          # 方式二：node server.mjs，同样读 .env，访问 http://localhost:3000
```

> `node bridge.mjs` 只服务于旧的「本地 Agent / 云端 LLM(自带 key)」模式，不含 `/api`；托管模式需 `vercel dev`、`node server.mjs` 或已部署环境。

---

## 常见问题

- **登录邮件进垃圾箱**：接自定义 SMTP（Resend 免费档即可），并配置发件域名 SPF/DKIM。
- **支付后额度没变**：多半是 webhook 未配置或签名密钥不一致；检查 Vercel Functions Logs 里 `/api/webhook/lemonsqueezy` 的日志。
- **额度用尽返回 402**：前端会提示「额度已用完，请升级到 Pro」，自动刷新额度条。
- **Google 登录报 `redirect_uri_mismatch` / 不回跳**：检查 Google Cloud OAuth Client 的
  Authorized redirect URIs 是否为 `https://<project-ref>.supabase.co/auth/v1/callback`，
  以及 Supabase Redirect URLs 白名单是否含站点域名。
- **游客数据没同步**：未开 Anonymous provider 时未登录用户只有 localStorage；
  登录后若云端已有数据以云端为准（本地数据会在游客→正式账号升级时自动合并）。
- **并发超用**：MVP 采用「先查后记」+ 数据库原子累加，极端并发下可能略微超发几百分之一；量大了可改为严格预扣。

## 上线前检查清单

- [ ] 环境变量全部设好，`service_role` / `OPENAI_API_KEY` / `LEMONSQUEEZY_API_KEY` 只在服务端
- [ ] SQL Editor 已执行最新 `sql/schema.sql`（含 `user_data` 表）
- [ ] Supabase 中 Google Provider 已启用且 Client ID/Secret 正确；Anonymous sign-ins 已按需开启
- [ ] Supabase URL Configuration 的 Site URL / Redirect URLs 含正式域名（VPS 同理）
- [ ] LS 商店从 Test mode 切到 Live
- [ ] 隐私政策、服务条款页面上线（可先用简单模板）
- [ ] 配置自定义 SMTP 发登录邮件
- [ ] webhook 签名密钥与线上一致（VPS 部署时 webhook URL 改为 VPS 域名）
