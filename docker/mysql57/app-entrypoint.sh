#!/usr/bin/env bash
set -Eeuo pipefail

java -jar /opt/strategy-review/strategy-review.jar &
java_pid=$!
nginx -g 'daemon off;' &
nginx_pid=$!

stop_children() {
  for child_pid in "$nginx_pid" "$java_pid"; do
    kill -TERM "$child_pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap stop_children TERM INT

set +e
wait -n "$java_pid" "$nginx_pid"
status=$?
set -e
stop_children
exit "$status"
