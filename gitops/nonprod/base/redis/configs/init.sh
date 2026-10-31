#
# Prepares the Redis and Sentinel configuration for this pod.
#
# The running Sentinels decide the role, so a recreated pod rejoins the current
# primary. When no Sentinel answers, such as when every pod restarts, the
# primary saved in this pod's sentinel.conf decides. The StatefulSet ordinal
# (0 = primary) is used only when neither is available.
#
# Redis and Sentinel announce stable pod DNS names instead of pod IP addresses,
# so the saved primary still points at the right pod after pods are recreated.
#

set -euo pipefail

discovery_timeout_seconds=90

[[ $(hostname) =~ -([0-9]+)$ ]] || { echo "Unexpected hostname: $(hostname)" >&2; exit 1; }
pod_ordinal=${BASH_REMATCH[1]}
pod_ip=$(hostname -i | awk '{ print $1 }')

# The seeded monitor host (e.g. redis-0.redis-headless) also names the headless service.
read -r _ _ _ seed_host seed_port _ < <(grep '^sentinel monitor myprimary ' /etc/sentinel.conf)
headless_service=${seed_host#*.}
pod_host=$(hostname).$headless_service

# Only DNS names are kept. Older Sentinel configs saved pod IP addresses, which change when pods are recreated.
saved_host='' saved_port=''
if [[ -f /data/sentinel.conf ]]; then
  read -r _ _ _ saved_host saved_port _ < <(grep '^sentinel monitor myprimary ' /data/sentinel.conf || true) || true
  [[ $saved_host == *."$headless_service" && $saved_port =~ ^[0-9]+$ ]] || saved_host='' saved_port=''
fi

#
# Prints "host port flags" when every Sentinel that answers agrees on the primary.
# The flags are the union of the Sentinels' flags for the primary, such as o_down.
# Returns 1 when no Sentinel answers and 2 when they disagree.
#
sentinel_primary() {
  local peer answer flags=''
  local -A answers=()
  for peer in $(getent ahostsv4 "$headless_service" | awk '{ print $1 }' | sort -u || true); do
    [[ $peer == "$pod_ip" ]] && continue
    answer=$(timeout 3 redis-cli -h "$peer" -p 26379 --raw sentinel get-master-addr-by-name myprimary 2>/dev/null | paste -sd ' ') || continue
    [[ $answer =~ ^[^[:space:]]+\ [0-9]+$ ]] || continue
    answers[$answer]=1
    flags+=,$(timeout 3 redis-cli -h "$peer" -p 26379 --raw sentinel master myprimary 2>/dev/null | awk 'found { print; exit } $0 == "flags" { found = 1 }' || true)
  done
  case ${#answers[@]} in
  0) return 1 ;;
  1) echo "${!answers[@]} ${flags#,}" ;;
  *) return 2 ;;
  esac
}

is_primary() {
  [[ $(REDISCLI_AUTH=$REDIS_PASSWORD timeout 3 redis-cli -h "$1" -p "$2" --raw role 2>/dev/null | head -n 1) == master ]]
}

role=''
primary_host=$seed_host
primary_port=$seed_port
deadline=$((SECONDS + discovery_timeout_seconds))
while ((SECONDS < deadline)); do
  if answer=$(sentinel_primary); then
    read -r host port flags <<< "$answer"
    failing_over=false
    [[ ,$flags, == *,o_down,* || ,$flags, == *,failover_in_progress,* ]] && failing_over=true
    if [[ $host == "$pod_host" || $host == "$pod_ip" ]]; then
      # Sentinel still lists this pod as primary. Wait if it is already failing over away from it.
      if ! $failing_over; then
        role=primary primary_host=$pod_host primary_port=$port
        break
      fi
      echo "Sentinel is failing over away from this pod. Waiting."
    elif is_primary "$host" "$port" || { [[ $host == "$saved_host" ]] && ! $failing_over; }; then
      # A primary that is still starting is accepted when this pod saved the same one, such as when every pod restarts.
      role=replica primary_host=$host primary_port=$port
      break
    else
      echo "Sentinel reports primary $host:$port, but it does not answer as a primary yet. Waiting."
    fi
  elif (($? == 1)); then
    echo "No Sentinel answered."
    break
  else
    echo "Sentinels disagree on the primary. Waiting."
  fi
  sleep 2
done

if [[ -z $role && -n $saved_host ]]; then
  echo "Using the primary saved in sentinel.conf."
  primary_host=$saved_host primary_port=$saved_port
  [[ $saved_host == "$pod_host" ]] && role=primary || role=replica
fi
if [[ -z $role ]]; then
  echo "Using the StatefulSet ordinal to choose the role."
  primary_host=$seed_host primary_port=$seed_port
  ((pod_ordinal == 0)) && role=primary || role=replica
fi
[[ $role == primary ]] && primary_host=$pod_host
echo "Configuring this pod as $role (primary $primary_host:$primary_port)."

# Every node keeps the primary's append-only file settings, so a replica promoted by Sentinel restarts with its data.
{
  cat /etc/primary.conf
  echo
  echo "replica-announce-ip $pod_host"
} > /data/primary.conf
{
  cat /data/primary.conf
  grep -v '^replicaof ' /etc/replica.conf || true
  echo
  echo "replicaof $primary_host $primary_port"
} > /data/replica.conf

#
# Sentinel rewrites its config at runtime, so it must stay owned by redis.
# Keep its myid so the other Sentinels update this one's address instead of
# keeping a stale entry for every pod recreation.
#
sentinel_id=$(awk '$1 == "sentinel" && $2 == "myid" { print $3 }' /data/sentinel.conf 2>/dev/null || true)
{
  awk -v host="$primary_host" -v port="$primary_port" \
    '$1 == "sentinel" && $2 == "monitor" && $3 == "myprimary" { $4 = host; $5 = port } { print }' /etc/sentinel.conf
  echo
  if [[ -n $sentinel_id ]]; then
    echo "sentinel myid $sentinel_id"
  fi
  echo "sentinel announce-hostnames yes"
  echo "sentinel announce-ip $pod_host"
  echo "sentinel auth-pass myprimary ${REDIS_PASSWORD}"
} > /data/sentinel.conf.new
chown redis:redis /data/sentinel.conf.new
mv /data/sentinel.conf.new /data/sentinel.conf

ln --force --symbolic "/data/$role.conf" /data/redis.conf
