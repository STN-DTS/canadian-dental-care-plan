#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f /data/redis.conf ]]; then
  echo "Redis startup: /data/redis.conf is missing." >&2
  exit 1
fi

redis_config=$(readlink -f -- /data/redis.conf)
temporary_config=$(mktemp "${redis_config}.XXXXXX")
trap 'rm -f -- "$temporary_config"' EXIT

cp --preserve=mode,ownership -- "$redis_config" "$temporary_config"

# The image entrypoint injects these modules again after CONFIG REWRITE persists them.
awk '
  $1 == "loadmodule" && $2 ~ /^\/usr\/local\/lib\/redis\/modules\/+(redisearch|redisbloom|redistimeseries|rejson)[.]so$/ {
    if (NF != 2) {
      print "Redis startup: bundled module arguments require manual review." > "/dev/stderr"
      exit 1
    }
    next
  }
  { print }
' "$redis_config" > "$temporary_config"

mv -- "$temporary_config" "$redis_config"
trap - EXIT

exec /usr/local/bin/docker-entrypoint.sh "$@"
