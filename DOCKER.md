# 单镜像部署

`strategy-review-docker.tar.gz` 和 `strategy-review-docker.tar` 是同一份 Linux/amd64 Docker 镜像的两种归档格式。两者都包含 MySQL 8、Spring Boot 后端、Vue 前端，以及从本机 `strategy_review_active_class_local` 导出的数据库快照。快照生成于 2026-10-25 13:11（Asia/Shanghai），包含 59 张表、9 个视图定义和当时的数据。校验时使用与归档对应的 `.sha256` 文件。

## 目标机器启动

将 `strategy-review-docker.tar.gz` 复制到已安装 Docker 的目标机器，然后导入镜像：

```bash
sha256sum -c strategy-review-docker.tar.sha256
docker load -i strategy-review-docker.tar
```

首次启动会使用镜像内的快照初始化 MySQL。设置数据库密码并挂载命名卷保存运行后的数据：

```bash
docker run -d --name strategy-review --restart unless-stopped -p 8081:80 -p 8080:8080 -p 3307:3306 -e MYSQL_ROOT_PASSWORD="请替换为自己的密码" -v strategy-review-data:/var/lib/mysql strategy-review:local
```

- 前端：<http://localhost:8081/>
- 后端：<http://localhost:8080/plan-svc-lj/>
- MySQL：`127.0.0.1:3307`，数据库 `strategy_review_active_class_local`，用户 `root`

数据库只在空数据卷首次启动时初始化。删除容器会保留 `strategy-review-data`；删除该卷会清除运行后产生的数据，下次启动时恢复镜像里的原始快照。镜像要求 Linux 容器运行环境。

## 修复分日查询的版本

`strategy-review-docker-no-env-daily-fix.tar` 对应镜像 `strategy-review:no-env-daily-fix`，启动时不需要传 `-e MYSQL_ROOT_PASSWORD`，内置密码为 `123456`。启动时会自动把旧数据卷中 `t_sr_strategy_daily_ap.stat_month` 列迁为 `stat_date`，保留原来的日期和记录，兼容首次初始化和已有数据卷。

先导入新镜像，然后停止旧容器并用原来的命名卷启动新容器。不要删除 `strategy-review-data` 数据卷：

```bash
sha256sum -c strategy-review-docker-no-env-daily-fix.tar.sha256
docker load -i strategy-review-docker-no-env-daily-fix.tar
docker stop strategy-review-v2
docker run -d --name strategy-review-v3 --restart unless-stopped -p 8089:80 -p 8080:8080 -v strategy-review-data:/var/lib/mysql strategy-review:no-env-daily-fix
```

如果旧容器名称不同，把 `strategy-review-v2` 换成当前正在运行的容器名。升级后前端访问 `http://服务器IP:8089/`。
