#
# Initialization script that copies the correct config files for
# each respective redis pod. The primary
#

set -eux

#
# extract the statefulset ordinal from the pod hostname
#
[[ `hostname` =~ -([0-9]+)$ ]] || { echo "Unexpected hostname: $(hostname)"; exit 1; }
POD_ORDINAL=${BASH_REMATCH[1]}

#
# - copy config files to /data
# - append the cluster password to sentinel.conf
#
cp /etc/primary.conf /etc/replica.conf /etc/sentinel.conf /data/
echo >> /data/sentinel.conf # append newline (just in case)
echo "sentinel auth-pass myprimary ${REDIS_PASSWORD}" >> /data/sentinel.conf

#
# link to the correct configuration file for this pod
#
case $POD_ORDINAL in
0) ln --force --symbolic /data/primary.conf /data/redis.conf ;;
*) ln --force --symbolic /data/replica.conf /data/redis.conf ;;
esac