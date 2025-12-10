#!/usr/bin/env bash
set -euo pipefail

# ===========================
# CONFIGURAÇÕES
# ===========================
APP_DIR="/var/www/agro-plan-assist"
SERVER_DIR="$APP_DIR/server"
VENV_PATH="$APP_DIR/.venv"        # se seu venv tiver outro caminho, ajuste aqui
SERVICE_NAME="agroplan-backend"

NOTES="${1:-Deploy sem notas}"

cd "$APP_DIR"

# ===========================
# 1. VERSÃO E BUILD
# ===========================
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
BUILD=$(git rev-parse --short HEAD || echo "unknown")

echo ">>> Deploy da versão $VERSION (build $BUILD) para prod"
echo ">>> Notas: $NOTES"
echo

# ===========================
# 2. ATUALIZAR CÓDIGO (git pull)
# ===========================
echo ">>> Atualizando código (git pull)..."
git pull origin main
echo

# ===========================
# 3. BACKEND: VENV + PIP + MIGRATIONS
# ===========================
echo ">>> Preparando ambiente Python (venv + dependências + migrations)..."

# Garante que o venv existe
if [ ! -d "$VENV_PATH" ]; then
  echo ">>> Nenhum venv encontrado. Criando em $VENV_PATH..."
  python3 -m venv "$VENV_PATH"
fi

echo ">>> Usando venv em: $VENV_PATH"
# shellcheck disable=SC1090
source "$VENV_PATH/bin/activate"

cd "$SERVER_DIR"

echo
echo ">>> Instalando dependências backend (pip install -r requirements.txt)..."
pip install -r requirements.txt --quiet
echo

echo ">>> Aplicando migrations (alembic upgrade head)..."
if command -v alembic >/dev/null 2>&1; then
  alembic upgrade head
else
  echo ">>> AVISO: alembic não está instalado no venv! (verifique server/requirements.txt)"
fi

deactivate
cd "$APP_DIR"
echo

# ===========================
# 4. BUILD FRONTEND
# ===========================
echo ">>> Build do frontend (npm run build)..."
npm run build
echo

# ===========================
# 5. REINICIAR BACKEND
# ===========================
echo ">>> Reiniciando serviço do backend ($SERVICE_NAME)..."
sudo systemctl restart "$SERVICE_NAME"

sleep 2
sudo systemctl status "$SERVICE_NAME" --no-pager -l || true
echo

echo ">>> Deploy concluído!"
echo ">>> Versão: $VERSION  | Build: $BUILD  | Ambiente: prod"
