#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} != --container ]]; then
  test_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  exec podman run --rm --network none --read-only \
    --tmpfs /data:rw,mode=0777 --tmpfs /tmp:rw,mode=1777 \
    --volume "$test_directory/../configs/start-redis.sh:/etc/start-redis.sh:ro" \
    --volume "$test_directory/redis-startup.sh:/etc/test-redis-startup.sh:ro" \
    --entrypoint bash "${REDIS_TEST_IMAGE:-docker.io/library/redis:8.10.3-trixie}" \
    /etc/test-redis-startup.sh --container
fi

trap 'echo "Redis startup regression failed at line $LINENO." >&2; tail -n 25 /tmp/redis.log >&2' ERR

export REDISCLI_AUTH=synthetic-regression-password
redis_args=(/data/redis.conf --requirepass "$REDISCLI_AUTH" --masterauth "$REDISCLI_AUTH" --logfile /tmp/redis.log)

wait_for_redis() {
  for attempt in {1..50}; do
    if redis-cli ping >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done
  cat /tmp/redis.log >&2
  echo "Redis did not become ready." >&2
  exit 1
}

printf 'appendonly yes\nappendfilename "primary.aof"\n' > /data/primary.conf
ln -s /data/primary.conf /data/redis.conf

bash /etc/start-redis.sh "${redis_args[@]}" --daemonize yes
wait_for_redis
[[ $(readlink /data/redis.conf) == /data/primary.conf ]]
echo "PASS: fresh startup preserved the initialization symlink."
[[ $(redis-cli set regression-key synthetic-value) == OK ]]
[[ $(redis-cli replicaof 127.0.0.1 6399) == OK ]]
[[ $(redis-cli config rewrite) == OK ]]
grep -q '^loadmodule ' /data/redis.conf
redis-cli shutdown nosave

if timeout 10s /usr/local/bin/docker-entrypoint.sh "${redis_args[@]}" --daemonize no > /tmp/baseline.log 2>&1; then
  echo "Expected the unmodified entrypoint to reject the rewritten configuration." >&2
  exit 1
fi
grep -q 'redisbloom.so.*server aborting' /tmp/redis.log
echo "PASS: reproduced the duplicate-module startup failure."

for restart in 1 2; do
  ownership_and_mode=$(stat -c '%u:%g:%a' /data/redis.conf)
  bash /etc/start-redis.sh "${redis_args[@]}" --daemonize yes
  wait_for_redis
  [[ $(stat -c '%u:%g:%a' /data/redis.conf) == "$ownership_and_mode" ]]
  [[ $(redis-cli --raw get regression-key) == synthetic-value ]]
  [[ $(redis-cli --raw config get requirepass | tail -n 1) == "$REDISCLI_AUTH" ]]
  [[ $(redis-cli --raw config get masterauth | tail -n 1) == "$REDISCLI_AUTH" ]]
  [[ $(redis-cli --raw config get appendfilename | tail -n 1) == primary.aof ]]
  redis_pid=$(redis-cli --raw info server | tr -d '\r' | sed -n 's/^process_id://p')
  [[ $redis_pid =~ ^[0-9]+$ ]]
  [[ $(stat -c '%u' "/proc/$redis_pid") == "$(id -u redis)" ]]
  grep -q '^replicaof 127.0.0.1 6399$' /data/redis.conf
  if grep -q '^loadmodule ' /data/redis.conf; then
    echo "Bundled module directives were not removed." >&2
    exit 1
  fi
  [[ $(redis-cli --raw module list | grep -c '^bf$') == 1 ]]
  [[ $(redis-cli config rewrite) == OK ]]
  grep -q '^loadmodule ' /data/redis.conf
  redis-cli shutdown nosave
  echo "PASS: rewrite/restart $restart preserved data, authentication, replication, ownership, and non-root execution."
done

cp -p /data/redis.conf /tmp/original.conf
printf 'loadmodule /usr/local/lib/redis/modules//redisbloom.so custom-argument\n' >> /data/redis.conf
cp -p /data/redis.conf /tmp/custom-arguments.conf
if bash /etc/start-redis.sh "${redis_args[@]}" > /tmp/custom-arguments.log 2>&1; then
  echo "Expected custom bundled module arguments to require manual review." >&2
  exit 1
fi
grep -q 'bundled module arguments require manual review' /tmp/custom-arguments.log
cmp /data/redis.conf /tmp/custom-arguments.conf
cp -p /tmp/original.conf /data/redis.conf
echo "PASS: custom module arguments fail without modifying the configuration."

rm /data/redis.conf
if bash /etc/start-redis.sh "${redis_args[@]}" > /tmp/missing-config.log 2>&1; then
  echo "Expected startup to reject a missing configuration." >&2
  exit 1
fi
grep -q '/data/redis.conf is missing' /tmp/missing-config.log
echo "PASS: missing configuration fails explicitly."
