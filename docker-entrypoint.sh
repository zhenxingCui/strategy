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
    if [[ "$object_count" =~ ^[0-9]+$ ]] && (( object_count >= 67 )); then
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

# The packaged legacy snapshot stores daily dates in `stat_month` for this table.
# The current mapper expects `stat_date`, so rename the column in-place. Keeping
# the DATE values intact preserves the existing per-day rows on both fresh and
# pre-existing data volumes. This check is idempotent across container restarts.
legacy_daily_column=$(mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -Nse \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 't_sr_strategy_daily_ap' AND column_name = 'stat_month'")
current_daily_column=$(mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -Nse \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 't_sr_strategy_daily_ap' AND column_name = 'stat_date'")

if [[ "$legacy_daily_column" == "1" && "$current_daily_column" == "0" ]]; then
  echo "Migrating t_sr_strategy_daily_ap.stat_month to stat_date"
  mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$MYSQL_DATABASE" -e \
    "ALTER TABLE t_sr_strategy_daily_ap CHANGE COLUMN stat_month stat_date DATE DEFAULT NULL"
elif [[ "$current_daily_column" != "1" ]]; then
  echo "Expected stat_date or legacy stat_month on t_sr_strategy_daily_ap; refusing to start" >&2
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
