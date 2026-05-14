# AGENTS.md

## 项目定位

这是 `cloud-mail` 的本地协作说明。项目由两个主要部分组成：

- `mail-worker/`: Cloudflare Workers 后端，入口是 `src/index.js`，路由由 `src/hono/webs.js` 汇总。
- `mail-vue/`: Vue 3 前端，生产构建输出到 `mail-worker/dist`，由 Worker 的 `[assets]` 绑定托管。

默认用中文沟通和写项目说明；命令、路径、配置键、API 名称保持英文。

## 工作区规则

- 这个仓库经常带有未提交的本地改动。开始前先跑 `git status --short --branch`，不要回滚或覆盖不是自己刚刚产生的改动。
- 只改用户要求相关的文件。若只需要写文档，就不要顺手整理代码或格式化大文件。
- 读写文件优先用 `rg`、`Get-Content` 和 `apply_patch`；避免用临时脚本做简单文本编辑。
- 文档和脚本优先使用 UTF-8。Windows PowerShell 中查看中文时可先设置输出编码：

```powershell
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

## Cloudflare 和远程 D1

本地远程资源验证使用 `mail-worker/wrangler-dev.toml`：

- Worker name: `cloud-mail-dev`
- D1 binding: `db`
- D1 database: `mail-d1`
- D1 database id: `2888ab95-5cc6-4135-baab-fd3e8545a806`
- KV binding: `kv`
- R2 binding: `r2`

`wrangler-dev.toml` 里的 D1/KV/R2 都设置了 `remote = true`，所以本地 `wrangler dev --config wrangler-dev.toml` 会连接真实 Cloudflare 资源。验证时默认只做只读查询；不要在未得到明确授权时执行写入、迁移、初始化或清空类操作。

常用只读验证：

```powershell
cd E:\code\IdeaProjects\cloud-mail\mail-worker
pnpm exec wrangler whoami
pnpm exec wrangler d1 execute mail-d1 --config wrangler-dev.toml --remote --command "SELECT COUNT(*) AS setting_count FROM setting"
```

如果本机设置了 `HTTP_PROXY`/`HTTPS_PROXY` 且 Wrangler 远程连接超时，可在当前 PowerShell 会话临时直连：

```powershell
$env:HTTP_PROXY=$null
$env:HTTPS_PROXY=$null
```

如果需要走本地代理，建议同时设置这几个变量，避免 Wrangler 的远程绑定长连接漏走代理：

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7890'
$env:HTTPS_PROXY='http://127.0.0.1:7890'
$env:ALL_PROXY='http://127.0.0.1:7890'
$env:NO_PROXY='localhost,127.0.0.1'
pnpm run dev
```

如果需要使用 Cloudflare 插件里的账号数据验证，优先通过 Cloudflare API MCP 或 `wrangler d1 execute --remote` 读取真实 D1 元数据和表数据，再跑本地 API。

## 本地运行

后端 Worker 本地启动：

```powershell
cd E:\code\IdeaProjects\cloud-mail\mail-worker
pnpm run dev
```

默认访问地址是 `http://127.0.0.1:8787`。Worker 会把 `/api/...` 转发给 Hono 路由，其他路径交给 `mail-worker/dist` 静态资源。

如果 Wrangler 的 remote binding 长连接持续超时，可用 REST 兼容启动器绕过该长连接，仍然连接远程 D1/KV：

```powershell
cd E:\code\IdeaProjects\cloud-mail\mail-worker
$env:HTTPS_PROXY='socks5://127.0.0.1:7890'
$env:HTTP_PROXY='socks5://127.0.0.1:7890'
pnpm run dev:rest
```

`dev:rest` 会读取本机 Wrangler OAuth 登录信息和 `wrangler-dev.toml`，用 Cloudflare REST API 代理 D1/KV 调用。它和 `wrangler-dev.toml` 一样会操作真实远程资源，测试写入会影响线上 D1/KV。

如果前端页面需要重新构建：

```powershell
cd E:\code\IdeaProjects\cloud-mail\mail-vue
pnpm run build
```

`mail-vue/.env.release` 已配置 `VITE_OUT_DIR = ../mail-worker/dist`，构建后可继续用 Worker 托管完整页面。前端开发服务器默认端口是 `3001`，`mail-vue/.env.dev` 的 API 指向 `http://127.0.0.1:8787/api`。

## 验证建议

优先验证这些低风险接口：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/setting/websiteConfig
Invoke-RestMethod "http://127.0.0.1:8787/api/public-inbox/random"
```

匿名收件箱相关实现入口：

- `mail-worker/src/api/public-inbox-api.js`
- `mail-worker/src/service/email-service.js`
- `mail-worker/src/service/setting-service.js`
- `mail-vue/src/views/public-inbox/index.vue`
- `doc/public-inbox-api.md`

涉及数据库初始化或结构变更时，先检查 `mail-worker/src/init/init.js` 和 `mail-worker/src/entity/*.js`，再决定是否需要迁移或手动 SQL。远程 D1 是真实数据源，禁止为了测试随意执行 `/api/init/:secret`。

## 发布和同步

- 未明确要求时，不要提交或推送。
- 如果用户要求提交 GitHub，先确认 `git status --short --branch`、`git diff --stat` 和 `git diff --name-status`，只提交本次任务相关改动。
- 这个仓库历史上本地 `main` 可能和远程分支差异较大，推送前必须确认当前分支和 `origin` 指向。
