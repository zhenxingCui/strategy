#!/bin/bash
# =====================================================================
#  Strategy Review startup script (Linux)
#  Usage: ./start.sh              start with default settings
#         ./start.sh <dir>        start with external config dir <dir>
#  Log   : logs/strategy-review.log  (nohup background)
#  JDK   : uses $JAVA_HOME/bin/java first, then java from PATH
#          Spring Boot 2.3 (Tomcat 9.0.35) requires JDK 8/11 at runtime
# =====================================================================
set -e

APP_HOME=$(cd "$(dirname "$0")" && pwd)
cd "$APP_HOME"

JAR_NAME="strategy-review.jar"
LOG_DIR="$APP_HOME/logs"
LOG_FILE="$LOG_DIR/strategy-review.log"

# External config dir (default: config/ under app dir, overrides jar-internal yml)
if [ -z "$1" ]; then
  CONFIG_DIR="$APP_HOME/config"
else
  CONFIG_DIR="$1"
fi

if [ ! -f "$APP_HOME/$JAR_NAME" ]; then
  echo "[ERROR] $JAR_NAME not found in $APP_HOME"
  exit 1
fi
if [ ! -d "$CONFIG_DIR" ]; then
  echo "[ERROR] config dir not found: $CONFIG_DIR"
  exit 1
fi
mkdir -p "$LOG_DIR"

# ---- resolve java: JAVA_HOME first, then PATH ----
JAVA_CMD="java"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  JAVA_CMD="$JAVA_HOME/bin/java"
fi

echo "=========================================="
echo " JAR    : $APP_HOME/$JAR_NAME"
echo " Config : $CONFIG_DIR"
echo " Log    : $LOG_FILE"
echo " Java   : $JAVA_CMD"
"$JAVA_CMD" -version
echo "=========================================="

# --spring.config.additional-location: external yml wins over jar-internal one
nohup "$JAVA_CMD" -jar "$APP_HOME/$JAR_NAME" \
  --spring.config.additional-location="file:$CONFIG_DIR/" \
  >> "$LOG_FILE" 2>&1 &

echo "strategy-review started, pid=$!, log=$LOG_FILE"
