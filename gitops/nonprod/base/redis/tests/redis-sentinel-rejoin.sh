#!/usr/bin/env bash
#
# Runs three Redis + Sentinel "pods" in Podman, fails over away from redis-0,
# then recreates pods with new IP addresses and checks that they rejoin the
# current primary instead of resetting roles by StatefulSet ordinal. Finally
# restarts every pod and checks that the current primary and its data survive.
# Last, runs the preStop hooks on a replica and on the primary, and checks that
# the primary hands over to a replica before it stops.
#
set -euo pipefail

test_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
config_directory=${REDIS_CONFIG_DIRECTORY:-$test_directory/../configs}
config_directory=$(cd -- "$config_directory" && pwd)
image=${REDIS_TEST_IMAGE:-docker.io/library/redis:8.10.3-trixie}
password=synthetic-regression-password
prefix=redis-rejoin-$$
subnet_octet=$((RANDOM % 200 + 20))
subnet=10.89.$subnet_octet

cleanup() {
  podman rm --force --time 0 "$prefix-redis-0" "$prefix-redis-1" "$prefix-redis-2" >/dev/null 2>&1 || true
  podman volume rm --force "$prefix-data-0" "$prefix-data-1" "$prefix-data-2" >/dev/null 2>&1 || true
  podman network rm --force "$prefix" >/dev/null 2>&1 || true
  rm -f "/tmp/$prefix-prestop-redis.log" "/tmp/$prefix-prestop-sentinel.log"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  for ordinal in 0 1 2; do
    if podman container exists "$prefix-redis-$ordinal"; then
      echo "--- redis-$ordinal init log" >&2
      podman exec "$prefix-redis-$ordinal" cat /tmp/init.log >&2 2>/dev/null || podman logs "$prefix-redis-$ordinal" >&2 || true
      echo "--- redis-$ordinal Sentinel log" >&2
      podman exec "$prefix-redis-$ordinal" tail -n 40 /tmp/sentinel.log >&2 2>/dev/null || true
    fi
  done
  exit 1
}

pod_script='bash /etc/init.sh > /tmp/init.log 2>&1 \
  && bash /etc/start-redis.sh /data/redis.conf --requirepass "$REDIS_PASSWORD" --masterauth "$REDIS_PASSWORD" --daemonize yes --logfile /tmp/redis.log \
  && docker-entrypoint.sh /data/sentinel.conf --sentinel --daemonize yes --logfile /tmp/sentinel.log \
  && exec sleep infinity'

start_pod() {
  local ordinal=$1 ip=$2 file
  local mounts=()
  for file in init.sh prestop-redis.sh prestop-sentinel.sh primary.conf replica.conf sentinel.conf start-redis.sh; do
    mounts+=(--volume "$config_directory/$file:/etc/$file:ro")
  done
  podman run --detach --name "$prefix-redis-$ordinal" --hostname "redis-$ordinal" \
    --network "$prefix" --ip "$ip" \
    --network-alias "redis-$ordinal.redis-headless" --network-alias redis-headless \
    --env REDIS_PASSWORD="$password" \
    --volume "$prefix-data-$ordinal:/data" "${mounts[@]}" \
    --entrypoint bash "$image" -c "$pod_script" >/dev/null
}

redis_cli() {
  local ordinal=$1
  shift
  podman exec --env REDISCLI_AUTH="$password" "$prefix-redis-$ordinal" redis-cli --raw "$@" 2>/dev/null | tr -d '\r'
}

sentinel_cli() {
  local ordinal=$1
  shift
  podman exec "$prefix-redis-$ordinal" redis-cli -p 26379 --raw "$@" 2>/dev/null | tr -d '\r'
}

info_field() {
  redis_cli "$1" info replication | sed -n "s/^$2://p"
}

eventually() {
  local seconds=$1 description=$2
  shift 2
  for ((attempt = 0; attempt < seconds * 2; attempt++)); do
    if "$@"; then
      return
    fi
    sleep 0.5
  done
  fail "$description"
}

is_ready() {
  [[ $(podman container inspect --format '{{.State.Running}}' "$prefix-redis-$1") == true ]] || fail "redis-$1 container exited"
  [[ $(sentinel_cli "$1" ping) == PONG && $(redis_cli "$1" ping) == PONG ]]
}
has_replicas() { [[ $(info_field "$1" connected_slaves) == "$2" ]]; }
link_is_up() { [[ $(info_field "$1" master_link_status) == up ]]; }
sentinel_peers_are() { [[ $(sentinel_cli "$1" sentinel sentinels myprimary | grep -c '^runid$') == "$2" ]]; }
primary_moved_from() {
  local reported
  reported=$(sentinel_cli "$1" sentinel get-master-addr-by-name myprimary | head -n 1)
  [[ -n $reported && $reported != "$2" ]]
}
sentinel_lists_replicas() {
  [[ $(sentinel_cli "$1" sentinel replicas myprimary | awk 'previous == "flags" && $0 == "slave" { count++ } { previous = $0 } END { print count + 0 }') == "$2" ]]
}

podman network create --internal --subnet "$subnet.0/24" "$prefix" >/dev/null

# Existing PVCs have /data and sentinel.conf owned by the redis user from earlier image versions.
for ordinal in 0 1 2; do
  podman run --rm --volume "$prefix-data-$ordinal:/data" --entrypoint bash "$image" \
    -c 'touch /data/sentinel.conf && chown redis:redis /data /data/sentinel.conf'
done

for ordinal in 0 1 2; do
  start_pod "$ordinal" "$subnet.1$ordinal"
  eventually 60 "redis-$ordinal did not become ready" is_ready "$ordinal"
done
[[ $(redis_cli 0 role | head -n 1) == master ]] || fail "cold start did not make redis-0 primary"
eventually 30 "redis-0 did not get two replicas" has_replicas 0 2
echo "PASS: cold start made redis-0 primary with two replicas."

redis_cli 0 set rejoin-key before-failover >/dev/null
podman rm --force --time 0 "$prefix-redis-0" >/dev/null
eventually 60 "Sentinel did not fail over away from redis-0" primary_moved_from 1 redis-0.redis-headless
primary_host=$(sentinel_cli 1 sentinel get-master-addr-by-name myprimary | head -n 1)
[[ $primary_host =~ ^redis-([12])\.redis-headless$ ]] || fail "Sentinel reports primary $primary_host instead of a pod DNS name"
primary=${BASH_REMATCH[1]}
replica=$((primary == 1 ? 2 : 1))
eventually 30 "redis-$primary did not become primary" test "$(redis_cli "$primary" role | head -n 1)" = master
redis_cli "$primary" set rejoin-key after-failover >/dev/null
echo "PASS: Sentinel promoted redis-$primary after redis-0 was removed and reports it by DNS name."

start_pod 0 "$subnet.20"
eventually 120 "recreated redis-0 did not become ready" is_ready 0
role=$(redis_cli 0 role | head -n 1)
[[ $role == slave ]] || fail "recreated redis-0 started as $role instead of a replica of redis-$primary"
[[ $(info_field 0 master_host) == "$primary_host" ]] || fail "recreated redis-0 does not replicate from redis-$primary"
eventually 30 "recreated redis-0 replication link is not up" link_is_up 0
[[ $(redis_cli 0 get rejoin-key) == after-failover ]] || fail "recreated redis-0 does not have the post-failover data"
eventually 30 "redis-$primary does not have two replicas" has_replicas "$primary" 2
echo "PASS: recreated former primary rejoined redis-$primary as a replica."

podman rm --force --time 0 "$prefix-redis-$replica" >/dev/null
start_pod "$replica" "$subnet.2$replica"
eventually 120 "recreated redis-$replica did not become ready" is_ready "$replica"
[[ $(info_field "$replica" master_host) == "$primary_host" ]] || fail "recreated redis-$replica does not replicate from redis-$primary"
eventually 30 "recreated redis-$replica replication link is not up" link_is_up "$replica"
echo "PASS: recreated replica rejoined redis-$primary."

for ordinal in 0 1 2; do
  eventually 30 "Sentinel on redis-$ordinal still lists stale Sentinel identities" sentinel_peers_are "$ordinal" 2
  [[ $(redis_cli "$ordinal" config get appendonly | tail -n 1) == yes ]] || fail "redis-$ordinal does not use the append-only file"
  eventually 30 "redis-$ordinal did not write its append-only file" podman exec "$prefix-redis-$ordinal" test -s /data/appendonlydir/primary.aof.manifest
done
echo "PASS: every Sentinel kept its identity, and every node uses the append-only file."

redis_cli "$primary" set rejoin-key before-full-restart >/dev/null
[[ $(redis_cli "$primary" wait 2 5000) == 2 ]] || fail "replicas did not acknowledge the last write"
# Kill every pod without a clean shutdown, which is harsher than deleting the pods.
podman rm --force --time 0 "$prefix-redis-0" "$prefix-redis-1" "$prefix-redis-2" >/dev/null
# Like a StatefulSet with OrderedReady, each pod starts after the previous one is ready, with a new IP address.
for ordinal in 0 1 2; do
  start_pod "$ordinal" "$subnet.3$ordinal"
  eventually 60 "redis-$ordinal did not become ready after the full restart" is_ready "$ordinal"
done
eventually 30 "redis-$primary is not primary after the full restart" test "$(redis_cli "$primary" role | head -n 1)" = master
eventually 30 "redis-$primary does not have two replicas after the full restart" has_replicas "$primary" 2
[[ $(redis_cli "$primary" get rejoin-key) == before-full-restart ]] || fail "the last write was lost in the full restart"
for ordinal in 0 1 2; do
  [[ $(sentinel_cli "$ordinal" sentinel get-master-addr-by-name myprimary | head -n 1) == "$primary_host" ]] \
    || fail "Sentinel on redis-$ordinal does not report redis-$primary after the full restart"
done
echo "PASS: after every pod restarted, redis-$primary stayed primary with the last write."

# Kubernetes runs every container's preStop hook at the same time before it stops the containers.
run_prestop_hooks() {
  podman exec "$prefix-redis-$1" bash /etc/prestop-redis.sh > "/tmp/$prefix-prestop-redis.log" 2>&1 &
  local redis_hook=$!
  podman exec "$prefix-redis-$1" bash /etc/prestop-sentinel.sh > "/tmp/$prefix-prestop-sentinel.log" 2>&1 || true
  wait "$redis_hook" || true
}

replica=$(((primary + 1) % 3))
started=$SECONDS
run_prestop_hooks "$replica"
((SECONDS - started <= 2)) || fail "preStop hooks on replica redis-$replica took $((SECONDS - started)) seconds"
[[ $(sentinel_cli 0 sentinel get-master-addr-by-name myprimary | head -n 1) == "$primary_host" ]] \
  || fail "preStop hooks on replica redis-$replica moved the primary"
echo "PASS: preStop hooks on a replica return at once and leave the primary in place."

redis_cli "$primary" set rejoin-key before-graceful-delete >/dev/null
# Time only the handover: after the full restart, Sentinel takes several seconds to rediscover the replicas.
eventually 60 "Sentinel on redis-$primary does not list two healthy replicas" sentinel_lists_replicas "$primary" 2
started=$SECONDS
run_prestop_hooks "$primary"
elapsed=$((SECONDS - started))
new_primary_host=$(sentinel_cli "$replica" sentinel get-master-addr-by-name myprimary | head -n 1)
[[ $new_primary_host =~ ^redis-([0-2])\.redis-headless$ && $new_primary_host != "$primary_host" ]] \
  || fail "preStop hooks did not fail over away from redis-$primary: $(cat "/tmp/$prefix-prestop-redis.log")"
new_primary=${BASH_REMATCH[1]}
# Without the hook, Sentinel needs down-after-milliseconds (5 s) just to notice the primary is gone.
((elapsed < 5)) || fail "preStop failover took $elapsed seconds, so Sentinel did not act on the hook's request: $(cat "/tmp/$prefix-prestop-redis.log" "/tmp/$prefix-prestop-sentinel.log")"
[[ $(redis_cli "$new_primary" role | head -n 1) == master ]] || fail "redis-$new_primary is not primary after the preStop hooks"
[[ $(redis_cli "$new_primary" get rejoin-key) == before-graceful-delete ]] || fail "the last write was lost in the preStop failover"
podman rm --force --time 0 "$prefix-redis-$primary" >/dev/null
redis_cli "$new_primary" set rejoin-key after-graceful-delete >/dev/null
echo "PASS: preStop hooks on redis-$primary promoted redis-$new_primary in $elapsed seconds without losing the last write."

start_pod "$primary" "$subnet.4$primary"
eventually 120 "redis-$primary did not become ready after the graceful delete" is_ready "$primary"
[[ $(info_field "$primary" master_host) == "$new_primary_host" ]] || fail "redis-$primary does not replicate from redis-$new_primary"
eventually 30 "redis-$primary replication link is not up" link_is_up "$primary"
[[ $(redis_cli "$primary" get rejoin-key) == after-graceful-delete ]] || fail "redis-$primary does not have the post-failover data"
echo "PASS: the gracefully deleted primary rejoined redis-$new_primary as a replica."

for ordinal in 0 1 2; do
  if podman exec "$prefix-redis-$ordinal" grep -qF "$password" /tmp/init.log; then
    fail "redis-$ordinal init log contains the Redis password"
  fi
done
echo "PASS: init logs do not contain the Redis password."
