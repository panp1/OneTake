# OneTake — Kubernetes 部署文档

## 架构概览

```
Internet
   │
   ▼
[Ingress / nginx]
   │
   ▼
[onetake-web]  ←──── Next.js 16, 2 副本, HPA 扩缩
   │
   │  (HTTP API calls)
   ▼
[Neon Postgres] ──── compute_jobs 表作为任务队列
   ▲
   │  (轮询 pending 任务)
[onetake-worker] ←── Python AI 流水线, 1 副本
```

**两个服务：**
| 服务 | 镜像来源 | 副本策略 |
|------|----------|----------|
| `onetake-web` | `Dockerfile`（根目录） | `RollingUpdate`, 默认 2 副本，HPA 最多 6 |
| `onetake-worker` | `worker/Dockerfile` | `Recreate`，固定 1 副本（避免并发争抢任务） |

---

## 前置条件

| 工具 | 最低版本 | 用途 |
|------|----------|------|
| `kubectl` | 1.28+ | 集群操作 |
| `docker` / `docker buildx` | 24+ | 镜像构建 |
| Container Registry | — | 存放镜像（Docker Hub / ECR / GCR / ACR） |
| K8s 集群 | 1.28+ | EKS / GKE / AKS / K3s 均可 |
| `nginx-ingress-controller` | 1.10+ | 入口路由 |
| `cert-manager` | 1.14+ | 自动 TLS（可选，本地测试可跳过） |

---

## 第一步：修改 next.config.ts（已完成）

`next.config.ts` 已添加 `output: "standalone"`，这是 Docker 容器化 Next.js 的必要配置。

---

## 第二步：构建并推送 Docker 镜像

### 2.1 Next.js Web App

```bash
# 在项目根目录执行

# 单架构（推荐用于 amd64 集群）
docker build -t your-registry/onetake-web:latest .

# 多架构（Apple Silicon 本地 + 云端 amd64）
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry/onetake-web:latest \
  --push .

# 打版本 tag（正式发布时用）
docker tag your-registry/onetake-web:latest your-registry/onetake-web:v1.0.0
docker push your-registry/onetake-web:v1.0.0
```

### 2.2 Python Worker

```bash
# 在 worker/ 目录执行
cd worker

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry/onetake-worker:latest \
  --push .

cd ..
```

> **注意：** Worker 依赖 Playwright Chromium 和 FFmpeg，镜像较大（~2GB），首次构建需要几分钟。

---

## 第三步：配置 Secrets

**不要**把真实密钥提交到 Git。有两种推荐方式：

### 方式 A：手动填写 YAML（适合快速部署）

```bash
# 编码每个值
echo -n "postgresql://user:pass@host/dbname?sslmode=require" | base64
echo -n "sk_live_xxx" | base64
# ...

# 编辑 k8s/secrets.yaml，填入 base64 值，然后：
kubectl apply -f k8s/secrets.yaml -n onetake
```

### 方式 B：用 kubectl 直接创建（推荐）

```bash
kubectl create secret generic onetake-secrets \
  --namespace=onetake \
  --from-literal=DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require" \
  --from-literal=CLERK_SECRET_KEY="sk_live_xxx" \
  --from-literal=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxx" \
  --from-literal=OPENROUTER_API_KEY="sk-or-v1-xxx" \
  --from-literal=BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx" \
  --from-literal=TEAMS_WEBHOOK_URL="https://outlook.office.com/webhook/xxx"
```

---

## 第四步：修改配置文件里的域名

编辑以下两个文件，将 `onetake.yourdomain.com` 替换为你的真实域名：

- `k8s/configmap.yaml` — `NEXT_PUBLIC_APP_URL` 和 `APP_URL`
- `k8s/webapp/ingress.yaml` — `host` 字段（共 2 处）

---

## 第五步：修改镜像地址

在 `k8s/webapp/deployment.yaml` 和 `k8s/worker/deployment.yaml` 中，将：

```yaml
image: your-registry/onetake-web:latest
```

替换为你实际的镜像地址，例如：

```yaml
image: ghcr.io/your-org/onetake-web:v1.0.0
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/onetake-web:v1.0.0
```

---

## 第六步：部署到集群

```bash
# 1. 创建命名空间
kubectl apply -f k8s/namespace.yaml

# 2. 应用 ConfigMap
kubectl apply -f k8s/configmap.yaml -n onetake

# 3. 应用 Secrets（如果用方式 A）
# kubectl apply -f k8s/secrets.yaml -n onetake

# 4. 部署 Web App
kubectl apply -f k8s/webapp/deployment.yaml -n onetake
kubectl apply -f k8s/webapp/service.yaml     -n onetake
kubectl apply -f k8s/webapp/hpa.yaml         -n onetake

# 5. 部署 Worker
kubectl apply -f k8s/worker/deployment.yaml  -n onetake

# 6. 部署 Ingress（需要先安装 nginx-ingress-controller）
kubectl apply -f k8s/webapp/ingress.yaml     -n onetake
```

**一键部署（全部）：**

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml   -n onetake
kubectl apply -f k8s/webapp/          -n onetake
kubectl apply -f k8s/worker/          -n onetake
```

---

## 第七步：运行数据库迁移

```bash
# 直接在 Neon 控制台执行，或通过临时 Pod：
kubectl run migrate --rm -it \
  --image=postgres:16-alpine \
  --namespace=onetake \
  --env="DATABASE_URL=$(kubectl get secret onetake-secrets -n onetake -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  --restart=Never \
  -- psql "$DATABASE_URL" -f /dev/stdin < migrations/2026-04-13-stage6-organic.sql
```

---

## 验证部署

```bash
# 查看所有资源
kubectl get all -n onetake

# 查看 Pod 状态
kubectl get pods -n onetake -w

# 查看 Web App 日志
kubectl logs -n onetake -l app=onetake-web -f

# 查看 Worker 日志
kubectl logs -n onetake -l app=onetake-worker -f

# 查看 Ingress
kubectl get ingress -n onetake

# 健康检查（集群内）
kubectl exec -n onetake deploy/onetake-web -- \
  wget -qO- http://localhost:3000/api/health
```

---

## 更新部署（CI/CD 滚动更新）

```bash
# 更新镜像（触发 Rolling Update）
kubectl set image deployment/onetake-web \
  web=your-registry/onetake-web:v1.1.0 \
  -n onetake

kubectl set image deployment/onetake-worker \
  worker=your-registry/onetake-worker:v1.1.0 \
  -n onetake

# 回滚（如果出问题）
kubectl rollout undo deployment/onetake-web    -n onetake
kubectl rollout undo deployment/onetake-worker -n onetake

# 查看滚动历史
kubectl rollout history deployment/onetake-web -n onetake
```

---

## 目录结构

```
OneTake/
├── Dockerfile                    # Next.js Web App 镜像
├── next.config.ts                # output: standalone（K8s 必须）
├── k8s/
│   ├── namespace.yaml            # onetake 命名空间
│   ├── secrets.yaml              # Secret 模板（不含真实值）
│   ├── configmap.yaml            # 非敏感配置
│   ├── webapp/
│   │   ├── deployment.yaml       # Web App 部署（2 副本）
│   │   ├── service.yaml          # ClusterIP Service
│   │   ├── ingress.yaml          # Nginx Ingress + TLS
│   │   └── hpa.yaml              # 水平自动扩缩（2-6 副本）
│   └── worker/
│       └── deployment.yaml       # Worker 部署（1 副本）
└── worker/
    └── Dockerfile                # Python Worker 镜像
```

---

## 常见问题

### Pod 一直 CrashLoopBackOff

```bash
kubectl describe pod -n onetake <pod-name>
kubectl logs -n onetake <pod-name> --previous
```

最常见原因：Secret 里的 `DATABASE_URL` 格式不对，或 Neon 连接需要 `?sslmode=require`。

### Worker 不处理任务

检查 `compute_jobs` 表是否有 `status='pending'` 的行：

```bash
kubectl exec -n onetake deploy/onetake-worker -- \
  python -c "import asyncio; from neon_client import query; asyncio.run(query('SELECT id, status FROM compute_jobs LIMIT 5'))"
```

### Ingress 返回 404

确认 nginx-ingress-controller 已安装并运行：

```bash
kubectl get pods -n ingress-nginx
kubectl get ingressclass
```

### 本地测试（不需要 Ingress）

```bash
kubectl port-forward svc/onetake-web 3000:80 -n onetake
# 访问 http://localhost:3000
```

---

## 资源估算

| 服务 | CPU Request | Memory Request | 推荐节点规格 |
|------|-------------|----------------|-------------|
| onetake-web × 2 | 500m | 1Gi | 2 vCPU / 4GB |
| onetake-worker × 1 | 500m | 1Gi | 2 vCPU / 4GB |
| **合计** | **1.5 cores** | **3Gi** | **4 vCPU / 8GB** |

> Worker 运行图像生成时内存峰值可达 3-4GB，推荐节点至少 8GB RAM。
