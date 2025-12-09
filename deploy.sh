#!/bin/bash
set -e

# ===========================
# CONFIG BÁSICA DO DEPLOY
# ===========================

APP_DIR="/var/www/agro-plan-assist"
SERVER_DIR="$APP_DIR/server"

# Se já usa DATABASE_URL no sistema, pode exportar aqui.
# Ajuste a SENHA se precisar.
DB_URL="${DATABASE_URL:-postgresql://agroplan_user:SENHA@localhost:5432/agroplan_assist}"

ENVIRONMENT="prod"

# NOTAS DA RELEASE = tudo que você passar depois do ./deploy.sh
NOTES="${*:-Deploy sem notas}"

cd "$APP_DIR"

# ===========================
# 1. COLETAR VERSION E BUILD
# ===========================

# Versão vem do package.json
VERSION=$(node -p "require('./package.json').version")

# Build = hash curto do commit atual
BUILD=$(git rev-parse --short HEAD)

echo ">>> Deploy da versão $VERSION (build $BUILD) para $ENVIRONMENT"
echo ">>> Notas: $NOTES"
echo

# ===========================
# 2. GIT PULL
# ===========================

echo ">>> Atualizando código (git pull)..."
git pull origin main
echo

# ===========================
# 3. MIGRATIONS (Alembic)
# ===========================
echo ">>> Aplicando migrations (alembic upgrade head)..."

cd "$SERVER_DIR"

# tenta venv do backend primeiro
if [ -d ".venv" ]; then
  echo ">>> Usando venv do backend em $SERVER_DIR/.venv"
  source .venv/bin/activate
elif [ -d "$APP_DIR/.venv" ]; then
  echo ">>> Usando venv da raiz em $APP_DIR/.venv"
  source "$APP_DIR/.venv/bin/activate"
else
  echo ">>> AVISO: nenhum venv encontrado (.venv). Pulando migrations Alembic."
  cd "$APP_DIR"
  echo
  # volta pro fluxo sem derrubar o deploy
  # (remova o 'return' se seu deploy.sh não estiver dentro de função)
  :
fi

# só roda alembic se ele existir no PATH (dentro do venv)
if command -v alembic >/dev/null 2>&1; then
  alembic upgrade head
else
  echo ">>> AVISO: alembic não encontrado no venv atual. Pulando migrations."
fi

# se um venv foi ativado, desativa
if [ -n "$VIRTUAL_ENV" ]; then
  deactivate
fi

cd "$APP_DIR"
echo

# ===========================
# 4. FRONTEND BUILD
# ===========================

echo ">>> Build do frontend (npm run build)..."
# Só rode npm install se mudar deps:
# npm install
npm run build
echo

# ===========================
# 5. REINICIAR BACKEND
# ===========================

echo ">>> Reiniciando serviço do backend (agroplan-backend)..."
sudo systemctl restart agroplan-backend
sudo systemctl status agroplan-backend --no-pager
echo

# ===========================
# 6. GARANTIR TABELA app_versions
# ===========================

echo ">>> Garantindo tabela app_versions..."
psql "$DB_URL" <<'EOF'
CREATE TABLE IF NOT EXISTS app_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version     text NOT NULL,
  build       text NOT NULL,
  environment text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
EOF
echo

# ===========================
# 7. REGISTRAR RELEASE NO BANCO
# ===========================

echo ">>> Registrando release em app_versions..."
psql "$DB_URL" <<EOF
INSERT INTO app_versions (version, build, environment, notes)
VALUES ('$VERSION', '$BUILD', '$ENVIRONMENT', '$NOTES');
EOF

echo
echo ">>> Deploy concluído com sucesso!"
echo ">>> Versão: $VERSION  | Build: $BUILD  | Ambiente: $ENVIRONMENT"
