FROM maven:3.9.9-eclipse-temurin-8 AS backend-build
WORKDIR /workspace/back
COPY back/pom.xml ./pom.xml
COPY back/lib ./lib
COPY back/src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /workspace/front
COPY front/package.json front/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY front/ ./
RUN npm run build

FROM eclipse-temurin:8-jre-jammy
ENV TZ=Asia/Shanghai
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx \
    && rm -f /etc/nginx/sites-enabled/default \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/strategy-review
COPY --from=backend-build /workspace/back/target/strategy-review.jar /opt/strategy-review/strategy-review.jar
COPY --from=frontend-build /workspace/front/dist/ /usr/share/nginx/html/
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/mysql57/app-entrypoint.sh /usr/local/bin/strategy-review-app-entrypoint.sh
RUN chmod +x /usr/local/bin/strategy-review-app-entrypoint.sh

EXPOSE 80 8080
ENTRYPOINT ["/usr/local/bin/strategy-review-app-entrypoint.sh"]
