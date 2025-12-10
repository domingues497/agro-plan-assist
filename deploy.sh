#!/usr/bin/env bash
set -euo pipefail

# ===========================
# CONFIGURAÇÕES
# ===========================
APP_DIR="/var/www/agro-plan-assist"
SERVER_DIR="$APP_DIR/server"
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
# 3. BACKEND DEPENDÊNCIAS + MIGRATIONS
# ===========================
cd "$SERVER_DIR"

ACTIVATED_VENV=0

# Ativar venv da raiz, se existir
if [ -d "$APP_DIR/.venv" ]; then
  echo ">>> Ativando venv: $APP_DIR/.venv"
  source "$APP_DIR/.venv/bin/activate"
  ACTIVATED_VENV=1
elif [ -d ".venv" ]; then
  echo ">>> Ativando venv: $SERVER_DIR/.venv"
  source ".venv/bin/activate"
  ACTIVATED_VENV=1
else
  echo ">>> ERRO: Nenhum ambiente virtual encontrado (.venv)."
  exit 1
fi

echo
echo ">>> Instalando dependências backend (pip install -r requirements.txt)..."
pip install -r requirements.txt --quiet
echo

echo ">>> Aplicando migrations (alembic upgrade head)..."
if command -v alembic >/dev/null 2>&1; then
  alembic upgrade head
else
  echo ">>> AVISO: alembic não está instalado no venv!"
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
