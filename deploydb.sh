#!/usr/bin/env bash
set -euo pipefail

# ===========================
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
# 1. ATUALIZAR CÓDIGO
# ===========================
echo ">>> Atualizando código (git fetch + reset --hard)..."
MAX_RETRIES=5
COUNT=0
SUCCESS=0

while [ $COUNT -lt $MAX_RETRIES ]; do
  if git fetch origin main; then
    SUCCESS=1
    break
  fi
  echo ">>> Falha no git fetch. Tentativa $((COUNT+1)) de $MAX_RETRIES. Aguardando 5s..."
  sleep 5
  COUNT=$((COUNT+1))
done

if [ $SUCCESS -eq 0 ]; then
  echo ">>> Erro critico: Nao foi possivel conectar ao GitHub apos $MAX_RETRIES tentativas."
  exit 1
fi

git reset --hard origin/main
echo

# ===========================
# 2. VENV + DEPENDÊNCIAS BACKEND
# ===========================
echo ">>> Preparando ambiente virtual Python..."

if [ ! -d "$VENV_PATH" ]; then
  echo ">>> Nenhum venv encontrado em $VENV_PATH. Criando..."
  python3 -m venv "$VENV_PATH"
fi

echo ">>> Ativando venv: $VENV_PATH"
# shellcheck disable=SC1090
source "$VENV_PATH/bin/activate"

cd "$SERVER_DIR"

echo ">>> Instalando dependências backend (pip install -r requirements.txt)..."
pip install -r requirements.txt
echo

# ===========================
# 3. VALIDAR / ATUALIZAR SCHEMA DO BANCO
# ===========================
echo ">>> Validando/atualizando schema do banco (python db.py)..."

# Carrega variáveis de ambiente se existirem
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
echo ">>> Schema do banco validado com sucesso."

echo ">>> Executando migrações Alembic (python migrate.py)..."
python migrate.py
echo ">>> Migrações finalizadas."
echo

deactivate
cd "$APP_DIR"

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
echo
sudo systemctl status "$SERVICE_NAME" --no-pager -l || true


sudo chmod +x deploydb.sh
sudo chmod +x deploy.sh
echo
echo ">>> Deploy finalizado com sucesso."