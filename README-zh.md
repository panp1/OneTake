# OneTake — AI 招聘营销平台

> 需求表单 → AI 生成流水线 → 创意审批 → 设计师交付 → 招聘团队发布 → 广告公司导出

**约 80K 行代码** | Next.js 16 + Python Worker | Neon Postgres | Clerk Auth | Vercel

---

## 目录

- [项目背景](#项目背景)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [端到端工作流](#端到端工作流)
- [AI 生成流水线](#ai-生成流水线)
- [角色与权限](#角色与权限)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 参考](#api-参考)
- [数据库结构](#数据库结构)
- [部署指南](#部署指南)
- [故障排查](#故障排查)

---

## 项目背景

### 它解决了什么问题？

招聘团队在启动每一次招聘营销活动时，都要经历一场 **3-5 天的协调混乱**：

- 招聘人员用邮件或即时消息提交无结构化的需求
- 市场经理手动整理信息、联系设计师、等待素材
- 设计师凭直觉制作，多轮来回修改
- 广告公司收到的素材包往往不完整或格式混乱

**OneTake 把这 3-5 天压缩到 30 分钟：**

1. 招聘人员通过结构化表单提交活动需求
2. AI 流水线自动生成文化研究、人物角色、演员形象、广告文案和合成创意素材
3. 市场经理在仪表板上审批
4. 设计师通过魔法链接（无需登录）访问、下载、上传终稿
5. 招聘人员获得可用的素材库，广告公司获得一键导出的 ZIP 包

### 技术定位

OneTake 是 **VYRA（557K 行代码自动化营销平台）** 在生产环境的实战验证。  
运营 2-3 周后，将以数据驱动的方式向 VP of Product 提案接入 VYRA 全套能力。

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                       Vercel（生产环境）                      │
│                                                              │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │   Next.js 应用      │   │       30+ API 路由            │  │
│  │                    │   │                              │  │
│  │  - 仪表板          │──▶│  /api/intake    (需求 CRUD)  │  │
│  │  - 需求表单        │   │  /api/generate  (排队任务)   │  │
│  │  - 营销审批        │   │  /api/approve   (审批流程)   │  │
│  │  - 设计师门户      │   │  /api/designer  (魔法链接)   │  │
│  │  - 招聘师工作区    │   │  /api/export    (ZIP/Figma)  │  │
│  │  - 广告公司交付    │   │  /api/admin     (运维管理)   │  │
│  │  - 管理后台        │   │  /api/extract   (RFP 解析)   │  │
│  └────────────────────┘   └──────────────┬───────────────┘  │
└─────────────────────────────────────────┼─────────────────  ┘
                                          │
              ┌───────────────────────────▼───────────────────┐
              │            Neon Postgres（无服务器）            │
              │                                               │
              │  intake_requests  │  compute_jobs（任务队列）  │
              │  creative_briefs  │  generated_assets         │
              │  actor_profiles   │  tracked_links            │
              │  + 12 张表        │  design_artifacts         │
              └───────────────────┬───────────────────────────┘
                                  │
          ┌───────────────────────▼───────────────────────────┐
          │              Python Worker（本地 / 容器）           │
          │                                                   │
          │  main.py ← 每 30 秒轮询 compute_jobs              │
          │                                                   │
          │  Stage 1 → Stage 2 → Stage 3 → Stage 4           │
          │  情报研究   角色图像   广告文案   版面合成           │
          │                      ↓                           │
          │               Stage 5    Stage 6                 │
          │               视频生成    着陆页                   │
          └─────────────────┬─────────────────────────────── ┘
                            │
           ┌────────────────┼───────────────────┐
           ▼                ▼                   ▼
    ┌────────────┐  ┌────────────┐      ┌──────────────┐
    │ OpenRouter  │  │ NVIDIA NIM │      │ Vercel Blob  │
    │ (LLM/图像) │  │ (Seedream) │      │ (文件存储)   │
    └────────────┘  └────────────┘      └──────────────┘
```

**核心数据流：**

1. 用户提交需求 → 存入 `intake_requests`
2. 前端创建 `compute_jobs` 记录（`status = 'pending'`）
3. Worker 轮询到待处理任务，认领并将状态设为 `processing`
4. Worker 依次执行各阶段，将结果写入 `creative_briefs`、`actor_profiles`、`generated_assets`
5. 生成的图片/HTML 上传至 Vercel Blob，URL 存入数据库
6. Worker 将任务置为 `complete`，前端轮询并渲染结果
7. 市场经理审批 → 通过 Teams 发送魔法链接给设计师
8. 设计师上传终稿 → 招聘团队看到已审批素材 → 广告公司获得导出包

---

## 技术栈

| 分类 | 技术 | 用途 |
|------|------|------|
| **框架** | Next.js 16（App Router） | 服务端/客户端渲染、API 路由 |
| **语言** | TypeScript 5、React 19 | 前端与 API 层 |
| **样式** | Tailwind CSS 4 | 实用优先 CSS，亮色主题 |
| **图标** | Lucide React | 统一图标系统 |
| **认证** | Clerk | SSO、角色管理、中间件保护 |
| **数据库** | Neon Postgres（无服务器） | 主数据存储 + 任务队列 |
| **文件存储** | Vercel Blob | 图片、HTML、文件存储 |
| **托管** | Vercel | 生产环境部署 |
| **通知** | Microsoft Teams Webhook | 自适应卡片通知 |
| **Worker** | Python 3.11+ | AI 流水线编排 |
| **LLM** | OpenRouter（Kimi K2.5、GLM-5） | 研究、文案、合成 |
| **图像生成** | Seedream 4.5（NVIDIA NIM） | 演员与场景图像生成 |
| **视频生成** | Kling 3.0 API | UGC 风格短视频（可选） |
| **本地推理** | MLX（Apple Silicon） | 设备端推理备用方案 |
| **渲染** | Playwright（无头 Chromium） | HTML → PNG 创意合成 |
| **富文本** | TipTap | 内联内容编辑 |
| **Figma 集成** | figma-api | 将创意推送至 Figma |
| **测试** | Vitest | 单元测试与集成测试 |
| **包管理** | pnpm | Node.js 依赖管理 |

---

## 端到端工作流

```
招聘人员/管理员 ──提交需求──▶ 表单验证 + 字段提取
                                      │
                                      ▼
                              保存至 intake_requests
                              创建 compute_jobs（pending）
                                      │
                                      ▼
                         Python Worker 认领任务
                                      │
                          ┌───────────▼──────────┐
                          │  AI 生成流水线 1-6 阶  │
                          └───────────┬──────────┘
                                      │
                                      ▼
                              状态变为 review
                         市场经理在仪表板审批
                                      │
                    ┌─────────────────┴─────────────────┐
                    │ 请求修改                           │ 通过
                    ▼                                    ▼
              状态回到 draft                    状态变为 approved
              触发重新生成                    生成魔法链接（7天单次）
                                             Teams 通知设计师
                                                      │
                                                      ▼
                                          设计师通过魔法链接访问
                                          下载素材、添加备注、上传终稿
                                                      │
                                                      ▼
                                              状态变为 sent
                                    ┌─────────────────┴──────────────┐
                                    ▼                                 ▼
                            招聘师工作区解锁                   广告公司获得 ZIP 包
                          UTM 追踪短链接                      Figma 素材包可用
```

### 请求状态生命周期

| 状态 | 含义 |
|------|------|
| `draft` | 草稿，可编辑 |
| `generating` | AI 流水线运行中 |
| `review` | 等待市场经理审批 |
| `approved` | 营销已批准，等待设计师 |
| `sent` | 设计师提交终稿，全流程完成 |
| `rejected` | 需求被拒绝 |

---

## AI 生成流水线

Worker 按顺序执行各阶段，每阶段将结果写入数据库并将文件上传至 Vercel Blob。前端通过 `/api/intake/[id]/progress` 轮询，实时渲染生成结果。

### 第 1 阶段：战略情报

**文件：** `worker/pipeline/stage1_intelligence.py`  
**模型：** OpenRouter（Kimi K2.5）

- 按目标地区进行文化研究
- 生成用户画像与定向策略
- 制定活动策略与预算分配
- 输出创意简报与设计方向
- 质量评估打分，未达标自动重新生成
- **写入：** `creative_briefs`、`campaign_strategies`

### 第 2 阶段：角色驱动图像生成

**文件：** `worker/pipeline/stage2_images.py`  
**模型：** Seedream 4.5（NVIDIA NIM）+ Creative VQA 质量评分

- 为每个用户画像生成演员身份卡
- 通过 Seedream 生成种子图像
- 视觉质量评分（VQA ≥ 0.85 才通过）
- 生成服装变体与背景场景
- 上传至 Vercel Blob
- **写入：** `actor_profiles`、`generated_assets`（type: base_image）

### 第 3 阶段：广告文案生成

**文件：** `worker/pipeline/stage3_copy.py`  
**模型：** OpenRouter（Kimi K2.5 / GLM-5）

- 按用户画像 × 渠道 × 语言生成文案
- 基于品牌价值支柱加权的多版本文案
- 品牌声音评估，未通过自动重写
- **写入：** `generated_assets`（type: copy）

### 第 4 阶段：版面合成

**文件：** `worker/pipeline/stage4_compose_v3.py`  
**模型：** GLM-5（HTML 生成） + Playwright（HTML → PNG 渲染）

- 从设计素材库中选择元素
- GLM-5 生成平台尺寸的 HTML/CSS 创意
- Playwright 将 HTML 渲染为 PNG
- 8 维度质量评级（A/B/C），低于 B 级自动重新设计
- 上传渲染结果至 Blob
- **写入：** `generated_assets`（type: composed_creative、carousel_panel）

### 第 5 阶段：视频生成（可选）

**文件：** `worker/pipeline/stage5_video.py`  
**模型：** Kling 3.0 + Coqui TTS + Wav2Lip + FFmpeg

- 生成 UGC 风格视频脚本
- Kling 3.0 多镜头视频生成
- TTS 配音 + Wav2Lip 口型同步
- FFmpeg 最终合成

### 第 6 阶段：着陆页（可选）

**文件：** `worker/pipeline/stage6_landing_pages.py`

- 按用户画像生成 HTML 着陆页
- 上传至 Blob，通过 `/lp/[活动名--画像名]` 公开访问

---

## 角色与权限

角色存储在 `user_roles` 表，通过 `src/lib/permissions.ts` 解析。

| 能力 | 管理员 | 招聘人员 | 设计师 | 观察者 |
|------|:------:|:-------:|:------:|:------:|
| 查看所有需求 | 是 | 仅自己的 | 通过魔法链接 | 是 |
| 创建需求 | 是 | 是 | 否 | 否 |
| 编辑草稿 | 是 | 仅自己的 | 否 | 否 |
| 营销阶段审批 | 是 | 否 | 否 | 否 |
| 设计师阶段审批 | 是 | 否 | 是 | 否 |
| 最终审批 | 是 | 否 | 否 | 否 |
| 上传终稿 | 是 | 否 | 是（魔法链接） | 否 |
| 管理后台 | 是 | 否 | 否 | 否 |
| 查看招聘师工作区 | 是 | 是 | 否 | 否 |
| 创建 UTM 追踪链接 | 是 | 是 | 否 | 否 |

**魔法链接：** 设计师通过 7 天有效期的一次性 Token 访问活动，无需 Clerk 账号。  
**自动配置：** 新 Clerk 用户默认分配 `recruiter` 角色。

---

## 快速开始

### 前置要求

- **Node.js** 20+ 和 **pnpm** 9+
- **Python** 3.11+ 和 `pip`
- Neon、Clerk、Vercel 账号（用于各自服务）
- （可选）Apple Silicon Mac，用于本地 MLX 推理
- （可选）Playwright：`playwright install chromium`

### 1. 克隆与安装

```bash
git clone <repo-url>
cd OneTake

# 安装 Node 依赖
pnpm install

# 安装 Python 依赖
cd worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. 配置环境变量

```bash
# Web 应用
cp .env.example .env.local

# Worker
cp worker/.env.example worker/.env
```

两个文件**必须共享**相同的 `DATABASE_URL` 和 `BLOB_READ_WRITE_TOKEN`。

**Web 应用必填变量：**

| 变量 | 来源 | 说明 |
|------|------|------|
| `DATABASE_URL` | Neon 控制台 | Postgres 连接字符串 |
| `CLERK_SECRET_KEY` | Clerk 控制台 | 服务端认证密钥 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 控制台 | 客户端认证密钥 |
| `NEXT_PUBLIC_APP_URL` | 你的域名 | 开发环境填 `http://localhost:3000` |
| `BLOB_READ_WRITE_TOKEN` | Vercel 控制台 | Blob 存储访问令牌 |
| `OPENROUTER_API_KEY` | OpenRouter | LLM 访问（RFP 提取） |
| `TEAMS_WEBHOOK_URL` | MS Teams | 通知推送 |

**Worker 必填变量：**

| 变量 | 来源 | 说明 |
|------|------|------|
| `DATABASE_URL` | 同 Web 应用 | 共享数据库 |
| `BLOB_READ_WRITE_TOKEN` | 同 Web 应用 | 上传生成素材 |
| `OPENROUTER_API_KEY` | OpenRouter | 文案/合成 LLM |
| `NVIDIA_NIM_API_KEY` | NVIDIA | Seedream 图像生成 |
| `APP_URL` | 你的域名 | 通知链接 |

### 3. 初始化数据库

```bash
# 确保 DATABASE_URL 已配置
node scripts/init-db.mjs
```

创建全部 18 张表和索引，可重复执行（使用 `IF NOT EXISTS`）。

### 4. 启动应用

**终端 1 — Web 应用：**

```bash
pnpm dev
# 访问 http://localhost:3000
```

**终端 2 — Worker：**

```bash
cd worker
source .venv/bin/activate
python main.py
# 每 30 秒轮询 compute_jobs
```

### 5. 创建管理员账号

1. 访问 `http://localhost:3000/sign-up` 注册 Clerk 账号
2. 在 Neon SQL 控制台执行：

```sql
INSERT INTO user_roles (clerk_id, email, name, role)
VALUES ('user_xxxxx', 'you@example.com', '你的姓名', 'admin');
```

`clerk_id` 从 Clerk 控制台获取。

---

## 项目结构

```
OneTake/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── page.tsx                   # 仪表板（活动列表）
│   │   ├── api/                       # 30+ API 路由
│   │   │   ├── intake/                #   需求 CRUD + 进度轮询
│   │   │   ├── generate/              #   生成任务管理
│   │   │   ├── approve/               #   三阶段审批流程
│   │   │   ├── designer/              #   设计师魔法链接门户
│   │   │   ├── assets/                #   素材管理 + 重新排版
│   │   │   ├── export/                #   ZIP + Figma 导出
│   │   │   ├── extract/               #   RFP/文本提取
│   │   │   ├── admin/                 #   用户、任务、统计管理
│   │   │   ├── figma/                 #   Figma 连接/推送/同步
│   │   │   ├── notify/                #   Teams/Slack/Outlook 发送
│   │   │   ├── tracked-links/         #   UTM 短链接管理
│   │   │   ├── schemas/               #   动态表单 Schema CRUD
│   │   │   ├── compute/               #   任务状态轮询
│   │   │   └── health/                #   健康检查（K8s 探针）
│   │   ├── intake/                    # 需求表单 + 详情页
│   │   ├── admin/                     # 管理后台页面
│   │   ├── designer/                  # 设计师门户页面
│   │   ├── agency/                    # 广告公司交付页面
│   │   ├── lp/                        # 公开着陆页服务
│   │   └── r/                         # 短链接跳转
│   │
│   ├── components/                    # ~57 个 React 组件
│   │   ├── CampaignWorkspace.tsx      #   营销审批主工作区
│   │   ├── MediaStrategyEditor.tsx    #   媒体策略编辑器
│   │   ├── ActorCard.tsx              #   人物角色展示
│   │   ├── CreativeHtmlEditor.tsx     #   HTML 创意实时编辑器
│   │   ├── RecruiterWorkspace.tsx     #   招聘师素材库
│   │   ├── designer/                  #   设计师专属组件
│   │   └── agency/                    #   广告公司视图组件
│   │
│   ├── lib/                           # 共享工具库
│   │   ├── db.ts                      #   Neon 客户端初始化
│   │   ├── db/                        #   数据访问层
│   │   │   ├── intake.ts              #     intake_requests CRUD
│   │   │   ├── briefs.ts              #     creative_briefs CRUD
│   │   │   ├── actors.ts              #     actor_profiles CRUD
│   │   │   ├── assets.ts              #     generated_assets CRUD
│   │   │   ├── magic-links.ts         #     魔法链接创建/验证/消费
│   │   │   ├── compute-jobs.ts        #     任务队列管理
│   │   │   └── user-roles.ts          #     角色查询 + 自动配置
│   │   ├── auth.ts                    #   requireAuth()、requireRole()
│   │   ├── permissions.ts             #   角色权限工具函数
│   │   ├── types.ts                   #   共享 TypeScript 类型（~430 行）
│   │   ├── blob.ts                    #   Vercel Blob 上传封装
│   │   ├── export.ts                  #   ZIP 包生成
│   │   └── notifications/             #   Teams/Slack/Outlook 客户端
│   │
│   └── middleware.ts                  # Clerk 认证中间件
│
├── worker/                            # Python 计算 Worker
│   ├── main.py                        # 入口 — 轮询循环
│   ├── neon_client.py                 # 异步 Postgres 客户端（asyncpg）
│   ├── config.py                      # 环境配置
│   ├── pipeline/                      # 生成阶段
│   │   ├── orchestrator.py            #   阶段调度 + 错误处理
│   │   ├── stage1_intelligence.py     #   文化研究 + 简报 + 策略
│   │   ├── stage2_images.py           #   演员生成 + 图像创建
│   │   ├── stage3_copy.py             #   按画像/渠道生成文案
│   │   ├── stage4_compose_v3.py       #   HTML 合成 + Playwright 渲染
│   │   ├── stage5_video.py            #   视频生成（Kling）
│   │   └── stage6_landing_pages.py    #   着陆页 HTML 生成
│   ├── ai/                            # AI 模型客户端
│   │   ├── seedream.py                #   Seedream 图像生成
│   │   ├── compositor.py              #   Playwright HTML→PNG 渲染
│   │   ├── creative_vqa.py            #   视觉质量评分
│   │   ├── kling_client.py            #   Kling 视频 API
│   │   ├── local_llm.py               #   MLX 本地 LLM 推理
│   │   └── tts_engine.py              #   文本转语音（Coqui TTS）
│   ├── prompts/                       # 提示词模板（~29 个文件）
│   ├── brand/
│   │   └── oneforma.py                #   OneForma 品牌规则
│   ├── Dockerfile                     # Worker 生产镜像
│   ├── requirements.txt               # 完整依赖（含 MLX，本地开发用）
│   └── requirements-docker.txt        # 精简依赖（Docker/云端，不含 MLX）
│
├── migrations/                        # SQL 迁移文件
├── scripts/                           # 初始化与维护脚本
│   ├── init-db.mjs                    #   数据库 Schema 初始化
│   └── seed-design-artifacts.mjs      #   设计素材库种子数据
│
├── k8s/                               # Kubernetes 部署清单
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── configmap.yaml
│   ├── webapp/                        #   Web App 部署（Deployment/Service/Ingress/HPA）
│   └── worker/                        #   Worker 部署
│
├── docs/
│   ├── k8s-deployment.md              # K8s 详细部署文档
│   └── technical-breakdown.md         # 架构深度解析
│
├── Dockerfile                         # Next.js Web App 生产镜像
├── docker-compose.yml                 # Worker 本地开发
├── .env.example                       # Web 应用环境变量模板
└── CLAUDE.md                          # AI 助手指令
```

---

## API 参考

所有 API 路由位于 `src/app/api/`，默认通过 Clerk 中间件认证。

### 需求管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/intake` | Clerk | 创建新需求 |
| `GET` | `/api/intake/[id]` | Clerk + 归属权限 | 获取需求详情 |
| `PATCH` | `/api/intake/[id]` | Clerk + canEdit | 更新需求字段 |
| `DELETE` | `/api/intake/[id]` | Clerk + canEdit | 删除需求 |
| `GET` | `/api/intake/[id]/progress` | Clerk | 轮询生成进度 |
| `GET` | `/api/intake/[id]/assets` | Clerk + 归属权限 | 列出需求下的素材 |
| `GET` | `/api/intake/[id]/landing-pages` | Clerk + 归属权限 | 获取着陆页 URL |

### 生成管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/generate/[id]` | Clerk | 排队全流水线生成 |
| `POST` | `/api/generate/[id]/brief` | Clerk | 重新生成第 1 阶段 |
| `POST` | `/api/generate/[id]/actors` | Clerk | 重新生成第 2 阶段 |
| `POST` | `/api/generate/[id]/copy` | Clerk | 重新生成第 3 阶段文案 |
| `POST` | `/api/generate/[id]/compose` | Clerk | 重新生成第 4 阶段合成 |
| `PATCH` | `/api/generate/[id]/strategy` | Clerk | 更新活动策略（自动保存） |

### 审批流程

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/approve/[id]` | Clerk + 角色 | 三阶段审批（marketing/designer/final） |

### 设计师门户

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/designer/[id]` | 魔法链接 | 获取活动完整上下文 |
| `POST` | `/api/designer/[id]/upload` | 魔法链接或 Clerk | 上传终稿文件 |
| `GET/POST` | `/api/designer/[id]/notes` | 魔法链接或 Clerk | 读写素材备注 |
| `POST` | `/api/designer/[id]/submit-finals` | 魔法链接 | 提交终稿（消耗 Token） |

### 导出

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/export/[id]` | Clerk | 生成 ZIP 包 |
| `POST` | `/api/export/figma-package/[id]` | Clerk | 生成 Figma 准备包 |

### 公开路由（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/r/[slug]` | UTM 短链接跳转（6 位字母数字） |
| `GET` | `/lp/[slug]` | 公开着陆页（`活动名--画像名` 格式） |
| `GET` | `/api/health` | 健康检查（K8s 探针） |

---

## 数据库结构

18 张表，全部使用 `gen_random_uuid()` UUID 主键，外键级联删除。通过 `scripts/init-db.mjs` 初始化。

### 核心表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `intake_requests` | 活动需求 | `title`、`task_type`、`urgency`、`status`（草稿→生成中→审批→已批准→已发送）、`form_data`（JSONB）、`campaign_slug` |
| `creative_briefs` | 第 1 阶段输出 | `brief_data`（JSONB，含画像/策略/研究）、`channel_research`、`design_direction`、`evaluation_score` |
| `actor_profiles` | 第 2 阶段人物 | `name`、`face_lock`（JSONB，面部参数）、`prompt_seed`、`outfit_variations`、`backdrops` |
| `generated_assets` | 所有创意素材 | `asset_type`（base_image/composed_creative/carousel_panel）、`platform`、`format`、`blob_url`、`evaluation_score`、`copy_data`（JSONB） |
| `campaign_strategies` | 媒体策略 | `country`、`tier`、`monthly_budget`、`strategy_data`（JSONB） |

### 流程表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `compute_jobs` | 任务队列（Worker 轮询此表） | `job_type`（generate/regenerate/regenerate_stage）、`status`（pending→processing→complete/failed）、`error_message` |
| `pipeline_runs` | 阶段执行日志 | `stage`、`stage_name`、`status`（running/passed/failed）、`duration_ms` |
| `approvals` | 审批记录 | `approved_by`、`status`（approved/changes_requested/rejected）、`notes` |
| `magic_links` | 设计师临时访问令牌 | `token`（UUID）、`expires_at`、`used_at`（单次使用追踪） |
| `notifications` | 通知投递记录 | `channel`（teams/slack/outlook）、`recipient`、`status` |

### 辅助表

| 表名 | 用途 |
|------|------|
| `task_type_schemas` | 动态表单 Schema 定义 |
| `user_roles` | RBAC（admin/recruiter/designer/viewer） |
| `tracked_links` | UTM 短链接（6 位 slug、点击统计） |
| `design_artifacts` | 可复用设计元素库 |
| `designer_uploads` | 设计师上传的终稿文件 |
| `campaign_landing_pages` | 着陆页 URL 映射 |
| `attachments` | 上传的 RFP 文件 |

### 关键索引

| 索引 | 用途 |
|------|------|
| `idx_intake_status` | 仪表板状态筛选加速 |
| `idx_compute_jobs_pending` | 偏索引：`WHERE status = 'pending'`，Worker 轮询专用 |
| `idx_tracked_links_slug` | 短链接查找 |
| `idx_intake_campaign_slug` | 着陆页 slug 解析 |

---

## 部署指南

### 方案一：Vercel（推荐，前端）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 连接项目
vercel link

# 部署预览
vercel

# 部署生产
vercel --prod
```

**部署后必做：**

```bash
# 1. 初始化数据库
DATABASE_URL="..." node scripts/init-db.mjs

# 2. 种子设计素材库
DATABASE_URL="..." BLOB_READ_WRITE_TOKEN="..." node scripts/seed-design-artifacts.mjs

# 3. 在 user_roles 表创建管理员账号（见上文）
```

### 方案二：Kubernetes（完整部署）

详见 **[`docs/k8s-deployment.md`](docs/k8s-deployment.md)**。

```bash
# 一键部署
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml   -n onetake
kubectl apply -f k8s/webapp/          -n onetake
kubectl apply -f k8s/worker/          -n onetake
```

### Worker 部署（本地 / Docker）

**本地运行（推荐开发环境）：**

```bash
cd worker
source .venv/bin/activate
python main.py
```

**Docker 运行：**

```bash
# 构建
docker build -t onetake-worker ./worker

# 运行
docker run --env-file worker/.env onetake-worker

# 多架构构建（amd64 + arm64）
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-registry/onetake-worker:latest --push ./worker
```

> **注意：** Docker 镜像不包含 MLX/TTS/torch（Apple Silicon 专用）。  
> Docker 模式下所有推理均走云端 API（OpenRouter、NVIDIA NIM）。

---

## 故障排查

### Worker 不处理任务

```bash
# 检查是否有 pending 任务
psql $DATABASE_URL -c "SELECT id, job_type, status, created_at FROM compute_jobs ORDER BY created_at DESC LIMIT 10"
```

常见原因：`DATABASE_URL` 与 Web 应用不一致，或缺少 `?sslmode=require`。

### 流水线卡在 "generating" 超过 10 分钟

```sql
-- 查看任务状态
SELECT * FROM compute_jobs WHERE request_id = '...' ORDER BY created_at DESC;

-- 重置卡死的任务
UPDATE compute_jobs
SET status = 'pending', started_at = NULL
WHERE id = '...' AND status = 'processing';
```

### 认证错误 401/403

- **401：** 用户未登录，或 Clerk 中间件未匹配该路由
- **403：** 用户已登录但缺少所需角色，检查 `user_roles` 表：

```sql
SELECT * FROM user_roles WHERE clerk_id = 'user_xxxxx';
```

### 图片未生成

- 检查 `NVIDIA_NIM_API_KEY` 是否有效并有余额
- 检查 Worker 日志中的 Seedream API 错误
- 验证 `BLOB_READ_WRITE_TOKEN` 是否有效（图片上传至 Vercel Blob）

### Teams 通知未发送

```bash
# 手动测试 Webhook
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"OneTake 测试通知"}' \
  "$TEAMS_WEBHOOK_URL"
```

### 魔法链接无效

- 链接 7 天后过期
- 设计师提交终稿后链接被消耗（单次使用）

```sql
SELECT token, expires_at, used_at FROM magic_links WHERE request_id = '...';
```

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| K8s 部署指南 | `docs/k8s-deployment.md` | 完整 Kubernetes 部署文档 |
| 技术深度解析 | `docs/technical-breakdown.md` | 架构细节与设计决策 |
| Worker 说明 | `worker/README.md` | Worker 专属配置说明 |
| 品牌规范 | `worker/brand/oneforma.py` | OneForma 品牌规则代码 |

---

> **技术提示：** Web 应用与 Worker 共享同一个 Neon 数据库。`compute_jobs` 表同时承担数据存储和消息队列的职责——这是刻意的架构选择，避免引入 Redis 或独立消息队列的运维复杂度。
