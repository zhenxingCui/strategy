# 策略复盘 前端工程（web-front）

基于 Vue 2 + Element UI 的策略复盘前端工程，提供策略整体情况、策略触点执行、策略执行明细、历史预警规则、策略收藏等页面。

## 技术栈

- Vue `2.6.14` + Vue Router `3.2` + Vuex `3.5`
- Element UI `2.15.7`
- ECharts `5.2.1`（图表）
- Axios `0.19.2`（HTTP 请求）
- Vue CLI `4.4`（构建工具）

## 环境要求

- Node.js `>= 16`（推荐 `20.18.0`，见 [.nvmrc](./.nvmrc)）
- npm

使用 nvm-windows 固定版本（`.nvmrc` 在 nvm-windows 下不会自动切换，需手动执行）：

```powershell
nvm use 20.18.0
```

> 提示：Vue CLI 4.4 基于 webpack 4，在 Node 17+ 下需要 OpenSSL 旧版算法支持，
> `serve` 脚本已内置 `NODE_OPTIONS=--openssl-legacy-provider`，无需手动设置。

## 安装依赖

```bash
npm install
```

## 脚本说明

| 脚本 | 命令 | 说明 |
|---|---|---|
| 启动开发服务 | `npm run serve` | 启动本地开发服务器，默认 `8081` 端口 |
| 生产打包 | `npm run build` | 构建产物输出到 `dist/` 目录 |

> 若在 Node 17+ 下执行 `npm run build` 报 `ERR_OSSL_EVP_UNSUPPORTED`，请为构建命令加上同样的兼容参数：
>
> ```powershell
> $env:NODE_OPTIONS="--openssl-legacy-provider"; npm run build
> ```

## 启动开发服务

```bash
npm run serve
```

启动后访问：<http://localhost:8081/>

## 后端代理配置

开发环境下，前端通过 [vue.config.js](./vue.config.js) 的 `devServer.proxy` 将接口反向代理到后端：

| 配置项 | 值 |
|---|---|
| 开发端口 | `8081` |
| 代理前缀 | `/plan-svc-lj` |
| 代理目标 | `http://localhost:8080` |
| 路径重写 | 不重写（透传） |

后端 `context-path` 为 `/plan-svc-lj`，前端接口基路径为 `/plan-svc-lj/strategyReview`，请求透传后即可命中后端对应 Controller，开发时无需改动前端地址。

## 目录结构

```
front/
├─ .nvmrc                    # 固定 Node 版本
├─ babel.config.js           # Babel 配置
├─ vue.config.js             # Vue CLI 配置（别名、代理、端口）
├─ package.json              # 依赖与脚本
├─ package-lock.json         # 依赖锁定
├─ public/
│  └─ index.html             # HTML 入口
└─ src/
   ├─ main.js                # 应用入口，挂载 Element UI
   ├─ App.vue                # 根组件
   ├─ router/
   │  └─ index.js            # 路由配置
   ├─ store/
   │  └─ index.js            # Vuex store
   ├─ api/                   # 接口封装
   │  ├─ manage.js           # post/get 请求封装
   │  ├─ StrategyReviewApi.js
   │  └─ strategyReview.js
   ├─ components/
   │  └─ EChart.vue          # ECharts 通用图表封装组件
   └─ views/
      └─ strategyReview/     # 策略复盘业务页面
         ├─ index.vue
         ├─ components/      # 业务子组件
         ├─ styles/          # 样式
         └─ utils/           # 工具（CSV 导出等）
```

## 常见问题

1. **Node 版本过低导致安装失败**：`npm install` 报 `EBADPLATFORM`（`fsevents`）等错误时，请先执行 `nvm use 20.18.0` 再重新安装。
2. **接口返回 500**：多为后端未启动或数据库未创建，请确认后端已启动（`8080` 端口）且数据库表已初始化。
3. **构建报 OpenSSL 错误**：按上文为 `build` 添加 `--openssl-legacy-provider` 参数。