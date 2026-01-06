#!/usr/bin/env bash
set -euo pipefail

# ===========================++
# CONFIGURAÇÕES BÁSICAS
# ===========================++
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
# 1. ATUALIZAR CÓDIGO
# ===========================
echo ">>> git pull origin main..."
git pull origin main
echo

# ===========================
# 2. VENV + DEPENDÊNCIAS BACKEND
# ===========================
echo ">>> Preparando ambiente virtual Python..."

if [ ! -d "$VENV_PATH" ]; then
  echo ">>> Nenhum venv encontrado em $VENV_PATH. Criando..."
  python3 -m venv "$VENV_PATH"
fi

echo ">>> Usando venv em: $VENV_PATH"
# shellcheck disable=SC1090
source "$VENV_PATH/bin/activate"

cd "$SERVER_DIR"

echo ">>> Instalando dependências backend (pip install -r requirements.txt)..."
pip install -r requirements.txt

deactivate
cd "$APP_DIR"
echo

# ===========================
# 3. BUILD FRONTEND
# ===========================
echo ">>> Build do frontend (npm run build)..."
npm run build
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