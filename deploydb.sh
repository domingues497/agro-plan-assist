#!/usr/bin/env bash
set -euo pipefail

# ===========================++
# CONFIGURAÇÕES BÁSICAS
# ===========================
APP_DIR="/var/www/agro-plan-assist"
SERVER_DIR="$APP_DIR/server"
VENV_PATH="$APP_DIR/.venv"
SERVICE_NAME="agroplan-backend"

MSG="${1:-Deploy}"

cd "$APP_DIR"

echo "======================================="
echo ">>> Deploy: $MSG"
echo ">>> Diretório: $APP_DIR"
echo "======================================="
echo



# ===========================
# 2.1. ATUALIZAR/VALIDAR SCHEMA DO BANCO (NOVO)
# ===========================
echo ">>> Validando/atualizando schema do banco (python db.py)..."

# (Opcional) carregar variáveis de ambiente, se existirem.
# Isso ajuda quando o db.py depende de DATABASE_URL / configs e o systemd é quem seta em runtime.
# Ajuste conforme sua realidade (pode remover se não usa .env).
if [ -f "$APP_DIR/.env" ]; then
  echo ">>> Carregando $APP_DIR/.env"
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$APP_DIR/.env" | xargs) || true
fi

if [ -f "$SERVER_DIR/.env" ]; then
  echo ">>> Carregando $SERVER_DIR/.env"
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$SERVER_DIR/.env" | xargs) || true
fi

python db.py
echo ">>> Schema OK."
echo

deactivate
cd "$APP_DIR"
echo


# ===========================
# 4. REINICIAR BACKEND
# ===========================
echo ">>> Reiniciando serviço do backend ($SERVICE_NAME)..."
sudo systemctl restart "$SERVICE_NAME"

sleep 2
echo
sudo systemctl status "$SERVICE_NAME" --no-pager -l || true

echo
echo ">>> Deploy finalizado."
