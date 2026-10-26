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

FROM eclipse-temurin:8-jre AS java-runtime

FROM mysql:8.0
USER root
RUN microdnf install -y nginx && microdnf clean all
COPY --from=java-runtime /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV MYSQL_DATABASE=strategy_review_active_class_local
ENV MYSQL_ROOT_PASSWORD=123456
ENV TZ=Asia/Shanghai

COPY --from=backend-build /workspace/back/target/strategy-review.jar /opt/strategy-review/strategy-review.jar
COPY --from=frontend-build /workspace/front/dist/ /usr/share/nginx/html/
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/mysql/init/01-strategy-review.sql.gz /docker-entrypoint-initdb.d/01-strategy-review.sql.gz
COPY docker-entrypoint.sh /usr/local/bin/strategy-review-entrypoint.sh
RUN chmod +x /usr/local/bin/strategy-review-entrypoint.sh

EXPOSE 80 3306 8080
ENTRYPOINT ["/usr/local/bin/strategy-review-entrypoint.sh"]
