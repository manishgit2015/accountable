"""People: the users table, and who added and last changed each record (spec 6.1, 6.5, R110–R114, ADR-022).

Revision ID: 0002_people
Revises: 0001_initial
Create Date: 2026-11-27

It only adds: a table, nullable columns with their foreign keys and indexes, and on activities `created_at`
and `updated_at`, filled from `occurred_at` for the rows already there before they become NOT NULL. No row
is deleted or changed otherwise (E-8), so it's safe on the team's data. Batch mode copies each table on
SQLite; on Postgres it's plain ALTER TABLE. Written out in full, like 0001.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_people"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RECORD_TABLES = ("organizations", "contacts", "deals", "activities")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("last_seen_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    for table in RECORD_TABLES:
        with op.batch_alter_table(table) as batch:
            for column in ("created_by", "updated_by"):
                batch.add_column(sa.Column(column, sa.String(), nullable=True))
                batch.create_foreign_key(op.f(f"fk_{table}_{column}_users"), "users", [column], ["id"])
                batch.create_index(op.f(f"ix_{table}_{column}"), [column])

    # Activities get their own times. Existing ones were added when they happened, so occurred_at is used.
    with op.batch_alter_table("activities") as batch:
        batch.add_column(sa.Column("created_at", sa.String(), nullable=True))
        batch.add_column(sa.Column("updated_at", sa.String(), nullable=True))
    activities = sa.table("activities", sa.column("occurred_at"), sa.column("created_at"), sa.column("updated_at"))
    op.execute(activities.update().values(created_at=activities.c.occurred_at, updated_at=activities.c.occurred_at))
    with op.batch_alter_table("activities") as batch:
        batch.alter_column("created_at", existing_type=sa.String(), nullable=False)
        batch.alter_column("updated_at", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    raise NotImplementedError("Accountable's migrations are forward-only (DEP-4).")
