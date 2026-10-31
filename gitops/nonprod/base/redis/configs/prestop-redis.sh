#
# Runs before the Redis container stops. When this pod is the primary and has
# replicas, it pauses writes and asks Sentinel to promote a replica, so clients
# move to the new primary without waiting for Sentinel to detect a failure.
#
# Writes stay paused until Redis stops, so no write is accepted here after the
# replica has been promoted.
#

set -uo pipefail

hook_timeout_seconds=20
export REDISCLI_AUTH=$REDIS_PASSWORD

[[ $(timeout 3 redis-cli --raw role 2>/dev/null | head -n 1) == master ]] || exit 0
replicas=$(timeout 3 redis-cli --raw info replication 2>/dev/null | tr -d '\r' | sed -n 's/^connected_slaves://p')
((${replicas:-0} > 0)) || { echo "This primary has no replicas. Skipping the failover."; exit 0; }

# Sentinel quotes announce-ip when it rewrites its config.
pod_host=$(awk '$1 == "sentinel" && $2 == "announce-ip" { gsub(/"/, "", $3); print $3 }' /data/sentinel.conf)
[[ -n $pod_host ]] || { echo "sentinel.conf has no announce-ip. Skipping the failover."; exit 0; }

sentinel_cli() {
  env -u REDISCLI_AUTH timeout 3 redis-cli -p 26379 --raw "$@" 2>/dev/null | tr -d '\r'
}
healthy_replica_count() {
  sentinel_cli sentinel replicas myprimary | awk '
    key == "flags" { healthy[n] = ($0 == "slave") }
    key == "master-link-status" { linked[n] = ($0 == "ok") }
    key == "name" { n++ }
    { key = (key == "" ? $0 : "") }
    END { for (i = 1; i <= n; i++) count += healthy[i] && linked[i]; print count + 0 }'
}

deadline=$((SECONDS + hook_timeout_seconds))

# Paused writes also block the PUBLISH that Sentinel sends on its link to the
# primary, so Sentinel stops learning about replicas once writes are paused.
# After a restart, Sentinel can take several seconds to discover the replicas.
until (($(healthy_replica_count) > 0)); do
  ((SECONDS < deadline)) || { echo "Sentinel lists no healthy replica. Skipping the failover."; exit 0; }
  sleep 0.5
done

timeout 3 redis-cli client pause $(((deadline - SECONDS + 10) * 1000)) write > /dev/null
echo "Paused writes. Asking Sentinel to fail over."
until reply=$(sentinel_cli sentinel failover myprimary) && [[ $reply == OK || $reply == INPROG* ]]; do
  echo "Sentinel replied: ${reply:-no reply}"
  ((SECONDS < deadline)) || { echo "Sentinel did not accept the failover."; exit 0; }
  sleep 1
done

while ((SECONDS < deadline)); do
  primary=$(sentinel_cli sentinel get-master-addr-by-name myprimary | head -n 1)
  if [[ -n $primary && $primary != "$pod_host" ]]; then
    echo "Sentinel promoted $primary."
    exit 0
  fi
  sleep 0.5
done
echo "Sentinel did not fail over within $hook_timeout_seconds seconds."
