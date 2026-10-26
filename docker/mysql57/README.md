# 策略复盘 MySQL 5.7 Docker 包

本包由前端、后端和 MySQL 5.7.44 镜像组成。数据库首次初始化时会导入 2026-10-26 21:05:50 的快照。快照由 part_1.sql、part_2.sql、part_3.sql 按顺序合并；三份文件已在 MySQL 5.7.44 中分别执行成功。

## 启动

先把镜像归档和 docker-compose.yml 放在同一目录，在该目录执行：

    docker load -i strategy-review-mysql57-images.tar
    docker compose up -d

PowerShell 中可先设置数据库密码：

    $env:MYSQL_ROOT_PASSWORD = "请替换为自己的密码"
    $env:MYSQL_APP_PASSWORD = "请替换为应用数据库用户密码"

默认访问地址：

- 前端：http://localhost:8081/
- 后端：http://localhost:8080/plan-svc-lj/
- MySQL：127.0.0.1:3307，数据库 strategy_review_active_class_local，应用用户 strategy_review；管理员用户 root

如默认端口已被占用，可设置 WEB_PORT、API_PORT 或 MYSQL_PORT 环境变量后再启动。

## 数据与升级

数据库只会在空数据卷首次启动时导入镜像内的快照。命名卷 strategy-review-mysql57_strategy_review_mysql57_data 保存之后的数据库变化。更新应用镜像后直接重新运行 docker compose up -d 即可保留数据库。

删除容器不会删除数据卷。若执行 docker compose down -v，会删除数据库数据；下次启动会从镜像中的快照重新初始化。

镜像归档针对 Linux/amd64 Docker Engine。
