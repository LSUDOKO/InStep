#!/usr/bin/env bash
# Creates a locally trusted HTTPS certificate for the companion (phone camera needs a secure context).
# Requires mkcert (Arch: sudo pacman -S mkcert nss && mkcert -install).
set -euo pipefail
cd "$(dirname "$0")/.."
IP=${1:-$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')}
mkdir -p certs
mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem "$IP" localhost 127.0.0.1
echo
echo "Certificate for $IP written to certs/. Put these in .env:"
echo "  PUBLIC_URL=https://$IP:8787"
echo "  HTTPS_CERT=../../certs/dev.pem"
echo "  HTTPS_KEY=../../certs/dev-key.pem"
echo
echo "Phone: install the mkcert root CA so it trusts the cert — file: $(mkcert -CAROOT)/rootCA.pem"
echo "  Android: Settings → Security → Encryption & credentials → Install a certificate → CA certificate"
echo "  iOS: AirDrop/email the file, install the profile, then Settings → General → About → Certificate Trust Settings"
