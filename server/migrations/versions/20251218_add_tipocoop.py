from alembic import op

revision = "20251218_add_tipocoop"
down_revision = "20251212_add_cod_item_columns"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS tipocooperado TEXT")

def downgrade():
    op.execute("ALTER TABLE public.produtores DROP COLUMN IF EXISTS tipocooperado")
