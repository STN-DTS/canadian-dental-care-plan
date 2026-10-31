#
# Runs before the Sentinel container stops. Kubernetes runs every container's
# preStop hook at the same time, so Sentinel stays up while the Redis preStop
# hook hands the primary role to a replica through it.
#

set -uo pipefail

wait_timeout_seconds=25

# Sentinel quotes announce-ip when it rewrites its config.
pod_host=$(awk '$1 == "sentinel" && $2 == "announce-ip" { gsub(/"/, "", $3); print $3 }' /data/sentinel.conf)
deadline=$((SECONDS + wait_timeout_seconds))
while ((SECONDS < deadline)); do
  primary=$(timeout 3 redis-cli -p 26379 --raw sentinel get-master-addr-by-name myprimary 2>/dev/null | head -n 1)
  [[ $primary == "$pod_host" ]] || exit 0
  # Stop waiting once Redis in this pod has stopped, such as when it had no replicas to fail over to.
  timeout 1 bash -c '> /dev/tcp/127.0.0.1/6379' 2>/dev/null || exit 0
  sleep 0.5
done
