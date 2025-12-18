from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251218_add_assist'
down_revision = '20251218_add_tipocoop'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS assistencia TEXT")


def downgrade():
    op.execute("ALTER TABLE public.produtores DROP COLUMN IF EXISTS assistencia")
