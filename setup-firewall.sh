#!/bin/bash
# Allow outbound ONLY to whitelisted APIs for NIC DAK Logbook

# Flush existing OUTPUT rules to avoid duplicates
sudo iptables -F OUTPUT

# Allow loopback completely (safe and necessary for internal communication)
sudo iptables -A OUTPUT -o lo -j ACCEPT

# Allow DNS resolution (Critical for resolving API domains)
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Resolve IPs
HF_IP=$(dig +short d-jaden02-pys-deep-transalator.hf.space | head -1)
PINCODE_IP=$(dig +short api.postalpincode.in | head -1)

# Exception 1: HuggingFace API
if [ -n "$HF_IP" ]; then
    sudo iptables -A OUTPUT -p tcp -d $HF_IP --dport 443 -j ACCEPT
fi

# Exception 2: India Post Pincode API
if [ -n "$PINCODE_IP" ]; then
    sudo iptables -A OUTPUT -p tcp -d $PINCODE_IP --dport 443 -j ACCEPT
fi

# Exception 3: PostgreSQL (internal fallback)
sudo iptables -A OUTPUT -p tcp -d 127.0.0.1 --dport 5432 -j ACCEPT

# Default: DROP all other outbound traffic
sudo iptables -A OUTPUT -j DROP

# Save permanently
sudo iptables-save | sudo tee /etc/iptables/rules.v4
echo "Firewall rules applied successfully."
