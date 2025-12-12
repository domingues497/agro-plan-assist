from alembic import op

revision = "20251212_add_cod_item_columns"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TABLE public.programacao_adubacao ADD COLUMN IF NOT EXISTS cod_item TEXT")
    op.execute("ALTER TABLE public.programacao_cultivares_defensivos ADD COLUMN IF NOT EXISTS cod_item TEXT")
    op.execute("ALTER TABLE public.programacao_defensivos ADD COLUMN IF NOT EXISTS cod_item TEXT")

def downgrade():
    pass
