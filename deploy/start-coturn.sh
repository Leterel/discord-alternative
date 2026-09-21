#!/bin/sh
set -eu

fail() { printf '%s\n' "$1" >&2; exit 1; }
valid_ipv4() {
  case "$1" in ''|*[!0-9.]*|.*|*.|*..*) return 1 ;; esac
  saved_ifs=$IFS
  IFS=.
  set -- $1
  IFS=$saved_ifs
  [ "$#" -eq 4 ] || return 1
  for octet do
    [ "${#octet}" -le 3 ] && [ "$octet" -le 255 ] || return 1
  done
}

# Reject config metacharacters rather than interpolating arbitrary input into
# a turnserver config. Values and secrets are never printed in error messages.
[ "${#TURN_SECRET}" -eq 64 ] || fail 'TURN_SECRET must contain 64 random hex characters.'
case "$TURN_SECRET" in *[!a-fA-F0-9]*) fail 'TURN_SECRET must contain only hex characters.' ;; esac
case "$TURN_DOMAIN" in ''|*[!a-zA-Z0-9.-]*|.*|*.|*..*) fail 'TURN_DOMAIN must be a DNS hostname.' ;; esac
valid_ipv4 "$TURN_PUBLIC_IP" || fail 'TURN_PUBLIC_IP must be an IPv4 address.'
valid_ipv4 "$TURN_LISTEN_IP" || fail 'TURN_LISTEN_IP must be an IPv4 address.'

umask 077
config=/tmp/sofafunk-turnserver.conf
cat /etc/sofafunk/coturn.conf > "$config"
printf '\nrealm=%s\nserver-name=%s\nlistening-ip=%s\nrelay-ip=%s\nexternal-ip=%s/%s\nstatic-auth-secret=%s\n' \
  "$TURN_DOMAIN" "$TURN_DOMAIN" "$TURN_LISTEN_IP" "$TURN_LISTEN_IP" \
  "$TURN_PUBLIC_IP" "$TURN_LISTEN_IP" "$TURN_SECRET" >> "$config"
unset TURN_SECRET
exec turnserver -c "$config"
