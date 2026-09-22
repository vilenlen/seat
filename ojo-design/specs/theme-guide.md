# Theme Guide

## 核心设计理念 (Core Design Philosophy)

本项目采用 **Innovation Track - Narrative-driven (情境驱动)** 与 **Convention Track - Utility (效用导向)** 混合的方法论。
核心品牌关键词：`warm-minimal (温暖极简)`、`layered-depth (层级深度)`、`multi-perspective (多重视角)`。

作为一款多角色 AI 会议模拟工具，该应用旨在为知识工作者提供决策推演的“思维圆桌”。参考了 ojo 平台的视觉语言，将“多角色同时思考”的抽象概念，通过**柔和的多色径向渐变光晕 (Gradient Halos)** 和**具有实体感的浮动卡片 (Layered Cards)** 具象化，创造出一个既具有专业生产力工具的严肃性，又带有“思考发酵”温度的沉浸式空间。

**Register (风格基调拨盘)：**
- `Energy (能量)`: **Quiet (安静)** — 界面需要留白和低饱和度的背景，让用户的思维和文本内容成为焦点。只有在状态流转（思考/发言）时才加入微小的色彩波动。
- `Finish (完成度)`: **Polished (精致)** — 柔软的大圆角 (16-20px)、极细微的 1px 高光边框、平滑的弹簧动效。
- `Density (密度)`: **Standard to Sparse (标准偏稀疏)** — 给思考留出空间，卡片内部保持舒适的间距，角色网格呼吸感强。
- `Weight (重量)`: **Light (轻盈)** — 界面元素（如角色卡片）仿佛漂浮在光晕之上，通过柔和的投影 (Soft Shadow) 与浅色背景分离。
- `Seriousness (严肃度)`: **Balanced (平衡)** — 虽然是工作工具（深色的控制顶栏带来重力感与专业感），但角色卡片的插画风格、柔和的色彩标签中和了 B2B 工具常见的冷硬感。

---

## 视觉原则与排版规则 (Visual & Layout Principles)

1. **Layout Vibe (布局氛围): HYBRID**
   - **会议进行页 (/room)**: 采用全屏沉浸式 (Immersive) 体验。顶部使用深色（接近黑色的深炭灰）`fg-background` 作为会议元信息和节拍器的载体，压住阵脚；下方主体区域则是柔和温暖的近白背景 `F8F7F5` 搭配彩色光晕，提供开阔的思考画布。
   - **角色库管理页 (/library)**: 采用经典的实用型 (Utility) 拆分视图。左侧目录树，右侧角色卡片网格，确保管理效率。

2. **Corner Philosophy (圆角哲学): SOFT (16-20px)**
   - 卡片、弹窗和抽屉使用大圆角 `20px`。
   - 按钮、输入框、标签使用匹配的 `12px - 16px` 圆角，整体感觉亲和、不带攻击性。

3. **Accent Temperature (点缀色温度): WARM & MULTI-HUE**
   - **主行动色 (Primary)**: 深炭灰 (接近黑色，但带有极微弱的暖色相，非死黑)，提供坚实、肯定的点击感。
   - **角色/状态色彩 (Role/Status Accents)**: 借鉴 ojo 的头像芯片，使用一系列低饱和度的粉彩 (Pastel) 色系（薰衣草紫、桃粉、天蓝、薄荷绿）。这些色彩用于角色徽章和背景的光晕漂浮，不抢夺文本视线，但能清晰区分不同角色和状态（如 thinking/speaking）。

4. **Depth Strategy (深度策略): IMMERSIVE & LAYERED**
   - 整体背景是一层。
   - 彩色渐变光晕作为背景的“底层氛围层”。
   - 内容卡片 (角色卡、聊天气泡、弹窗) 是纯白的浮岛，带有 `1px` 非常微弱的白色/浅灰描边和极度柔和的弥散阴影，仿佛悬浮在光晕之上。

---

## Typography System (排版系统)

- **比例缩放规则 (Ratio)**: `1.250` (Major Third)，提供清晰但不过分夸张的层级。Base size: `16px`。
- **字体选择**:
  - **Latin Display/Body**: `Inter` (干净、几何感的无衬线，符合 ojo 参考，提供专业的阅读体验。针对大标题收紧字距)。
  - **CJK (中文字体)**: `jfOpenHuninn` (粉圓體) 作为角色名称或特殊强调字体，提供温润的圆体质感，配合大圆角的卡片设计；正文回退到高质量的系统无衬线字体 (`PingFang SC` / `Microsoft YaHei`) 以确保长文本（打字机消息流）的绝对可读性。

---

## Component Recipes (组件配方)

这些是将 Token 转化为实际 Tailwind 类的原子配方。

### 1. 容器与卡片 (Containers & Cards)

**会议室主舞台容器 (Room Canvas)**
带有渐变光晕的沉浸式背景。
```html
<main class="relative bg-surface-canvas overflow-hidden">
  <!-- 渐变光晕层 -->
  <div class="absolute inset-0 opacity-40 pointer-events-none">
    <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-accent-peach rounded-full mix-blend-multiply filter blur-[100px] animate-drift-slow"></div>
    <div class="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-accent-sky rounded-full mix-blend-multiply filter blur-[120px] animate-drift-slower"></div>
  </div>
  <!-- 内容层 -->
  <div class="relative z-10 p-comfortable">...</div>
</main>
```

**白卡 (White Floating Card - 例如角色档案卡)**
平滑圆角，微妙边框，柔和投影。
```html
<div class="bg-surface-card rounded-card border border-border-subtle shadow-card-soft transition-all duration-300 ease-out hover:shadow-card-hover hover:-translate-y-[2px] p-comfortable flex flex-col gap-snug">
  <!-- 内容 -->
</div>
```

**深色顶部控制栏 (Dark Header Bar)**
```html
<header class="bg-surface-header-dark text-text-on-dark h-[52px] px-comfortable flex items-center justify-between border-b border-white/10 shadow-elevation-1">
  <!-- 会议元信息与节拍器 -->
</header>
```

### 2. 按钮 (Buttons)

**主按钮 (Primary Action - 纯色深炭灰)**
```html
<button class="inline-flex items-center justify-center gap-tight px-base py-tight bg-brand-primary text-text-on-dark font-body rounded-button shadow-sm transition-all duration-200 ease-out hover:bg-black hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
  <span>Start Meeting</span>
</button>
```

**次要按钮 (Secondary Action - 浅色带描边)**
```html
<button class="inline-flex items-center justify-center gap-tight px-base py-tight bg-surface-card text-text-primary border border-border-strong rounded-button transition-all duration-200 ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
  <span>Cancel</span>
</button>
```

**幽灵按钮 / 图标按钮 (Ghost / Icon Button)**
```html
<button class="p-tight rounded-button text-text-muted transition-colors duration-200 ease-out hover:text-text-primary hover:bg-surface-hover active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle cursor-pointer">
  <svg>...</svg>
</button>
```

### 3. 表单与输入 (Forms & Inputs)

**文本输入框 (Text Input)**
```html
<div class="flex flex-col gap-micro">
  <label class="text-caption text-text-secondary">Meeting Topic</label>
  <input type="text" class="px-snug py-tight bg-surface-card border border-border-strong rounded-input text-body text-text-primary placeholder:text-text-muted transition-all duration-200 ease-out focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary disabled:bg-surface-hover disabled:text-text-muted" placeholder="Enter topic..." />
</div>
```

### 4. 徽章与标签 (Badges & Tags - 角色状态)**

借鉴 ojo 头像芯片的柔和色彩。
```html
<!-- Thinking State Badge -->
<span class="inline-flex items-center gap-micro px-tight py-micro bg-brand-accent-lavender/15 text-[#6D5D8B] text-caption font-medium rounded-full border border-brand-accent-lavender/30">
  <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
  Thinking...
</span>

<!-- Speaking State Badge -->
<span class="inline-flex items-center gap-micro px-tight py-micro bg-brand-accent-peach/15 text-[#8B5D5D] text-caption font-medium rounded-full border border-brand-accent-peach/30">
  <svg class="w-3 h-3 fill-current">...</svg>
  Speaking
</span>
```

---

## Motion & Behavior (动效与交互行为)

基于 **Slide** 和 **Drift** 两个原型 (Archetypes)，营造“思绪发酵”与“从容不迫”的会议氛围。

1. **背景光晕 (Gradient Halos - Drift 动效)**:
   - 极慢的位移和缩放循环。
   - `animate-drift`: `15s` - `20s` 一个周期，平滑的 `ease-in-out`。
   - **注意**: 必须支持 `prefers-reduced-motion`，在减弱动态时停止运动，仅保留静态渐变背景。

2. **状态徽章 & 打字机消息流 (Feedback & Flow)**:
   - 会议进行中，角色的状态切换（idle -> thinking -> speaking）应该有平滑的颜色淡入淡出（200ms）。
   - 打字机文本流出：不要生硬的逐字蹦出，可以加上极短的 `fade-in` 或透明度过渡。

3. **侧边栏与弹窗 (Drawers & Modals - Slide 动效)**:
   - 角色档案侧边栏（SideDrawer）从右侧滑入：`duration-300 ease-out`。
   - 推理引擎/账户弹窗 (Modals) 从屏幕中心下方微量上浮并淡入：`translateY(10px) -> translateY(0)`，`opacity: 0 -> 1`，`duration-250 ease-out`。

4. **物理反馈 (Tactile Feedback)**:
   - 所有按钮按下时缩放 `active:scale-[0.98]`。

---

## 质量门禁 (Quality Gates - Audit Checklist)

- [x] **Anti-AI Slop**: 无霓虹发光，无紫蓝色背景，无廉价高对比渐变按钮。使用的是克制的色温偏移（深炭灰顶栏 + 暖白主画板 + 低饱和度粉彩光晕）。
- [x] **Honest Copy**: 确保原型中不出现 "Lorem ipsum" 或 "User 1"。所有角色名、职位、会议议题都必须是真实的、具有行业背景的示例（例如："Jessica Chen, 增长产品经理", 议题 "Q3 商业化变现策略推演"）。
- [x] **Hierarchy & Readability**: 虽然使用了光晕，但所有文本所在的卡片（气泡）必须是不透明的白色背景，确保文本对比度完全满足 WCAG AA 4.5:1。
- [x] **No Fake Chrome**: 绝对禁止在原型内绘制假浏览器外框或假 macOS 交通灯按钮。
- [x] **State Completeness**: 输入框、按钮确保覆盖 Hover、Focus (`focus-visible:ring`)、Active 状态。
- [x] **Component Coherence**: 确保“会议进行页”的沉浸式体验和“角色库管理页”的实用列表体验在圆角、字体、按钮样式上共享同一套设计语言（Token）。
