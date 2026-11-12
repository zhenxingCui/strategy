#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  echo "Set MYSQL_ROOT_PASSWORD when starting this container" >&2
  exit 1
fi

export SR_DB_URL="jdbc:mysql://127.0.0.1:3306/${MYSQL_DATABASE}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true"
export SR_DB_USER=root
export SR_DB_PASSWORD="$MYSQL_ROOT_PASSWORD"

/usr/local/bin/docker-entrypoint.sh mysqld &
mysql_entrypoint_pid=$!
java_pid=
nginx_pid=

stop_children() {
  for child_pid in "$nginx_pid" "$java_pid" "$mysql_entrypoint_pid"; do
    if [[ -n "$child_pid" ]]; then
      kill -TERM "$child_pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap stop_children TERM INT

database_ready=false
for _ in $(seq 1 600); do
  if ! kill -0 "$mysql_entrypoint_pid" 2>/dev/null; then
    echo "MySQL stopped before initialization completed" >&2
    wait "$mysql_entrypoint_pid" || true
    exit 1
  fi

  if mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
    object_count=$(mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -Nse \
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${MYSQL_DATABASE}'" 2>/dev/null || true)
    if [[ "$object_count" =~ ^[0-9]+$ ]] && (( object_count >= 51 )); then
      database_ready=true
      break
    fi
  fi

  sleep 1
done

if [[ "$database_ready" != true ]]; then
  echo "MySQL did not finish importing the database snapshot within 10 minutes" >&2
  exit 1
fi

# The current mapper and the daily read view expect stat_month in this table.
# Restore older volumes that were migrated to stat_date, preserving DATE values.
month_column=$(mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -Nse \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 't_sr_strategy_daily_ap' AND column_name = 'stat_month'")
date_column=$(mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -Nse \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 't_sr_strategy_daily_ap' AND column_name = 'stat_date'")
if [[ "$month_column" == "0" && "$date_column" == "1" ]]; then
  echo "Restoring t_sr_strategy_daily_ap.stat_date to stat_month"
  mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -e \
    "ALTER TABLE t_sr_strategy_daily_ap CHANGE COLUMN stat_date stat_month DATE DEFAULT NULL"
elif [[ "$month_column" != "1" ]]; then
  echo "Expected stat_month or stat_date on t_sr_strategy_daily_ap; refusing to start" >&2
  exit 1
fi

java -jar /opt/strategy-review/strategy-review.jar &
java_pid=$!
nginx -g 'daemon off;' &
nginx_pid=$!

set +e
wait -n "$mysql_entrypoint_pid" "$java_pid" "$nginx_pid"
status=$?
set -e
stop_children
exit "$status"
