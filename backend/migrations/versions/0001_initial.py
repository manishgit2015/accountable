"""Initial schema: the five tables, their constraints and indexes (spec 6.1–6.2).

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-21

Written out in full rather than imported from app.db, so it stays the same when app.db
changes in later versions. Names follow app.db's naming convention, and test_migrations.py
checks the two agree.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STAGES = ("new", "qualified", "proposal", "negotiation", "won", "lost")
CONTACT_STATUSES = ("lead", "qualified", "customer")
ACTIVITY_TYPES = ("note", "call", "email")
MAX_VALUE = 1_000_000_000


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.String(), nullable=False), sa.Column("updated_at", sa.String(), nullable=False)]


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("website", sa.String(), nullable=True),
        sa.Column("industry", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )

    op.create_table(
        "contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("job_title", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="lead", nullable=False),
        *_timestamps(),
        sa.CheckConstraint(sa.column("status").in_(CONTACT_STATUSES), name=op.f("ck_contacts_status")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_contacts_organization_id_organizations"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contacts")),
    )
    op.create_index(op.f("ix_contacts_organization_id"), "contacts", ["organization_id"])

    op.create_table(
        "deals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("contact_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("stage", sa.String(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("probability", sa.Integer(), nullable=False),
        sa.Column("close_date", sa.String(), nullable=False),
        sa.Column("position", sa.Float(), nullable=False),
        sa.Column("closed_at", sa.String(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(sa.column("stage").in_(STAGES), name=op.f("ck_deals_stage")),
        sa.CheckConstraint(sa.column("value").between(0, MAX_VALUE), name=op.f("ck_deals_value")),
        sa.CheckConstraint(sa.column("probability").between(0, 100), name=op.f("ck_deals_probability")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_deals_organization_id_organizations"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"], ["contacts.id"], name=op.f("fk_deals_contact_id_contacts"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deals")),
    )
    op.create_index(op.f("ix_deals_organization_id"), "deals", ["organization_id"])
    op.create_index(op.f("ix_deals_contact_id"), "deals", ["contact_id"])
    op.create_index(op.f("ix_deals_stage_position"), "deals", ["stage", "position"])
    op.create_index(op.f("ix_deals_closed_at"), "deals", ["closed_at"])

    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("contact_id", sa.Integer(), nullable=True),
        sa.Column("deal_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("occurred_at", sa.String(), nullable=False),
        sa.Column("follow_up_date", sa.String(), nullable=True),
        sa.Column("done", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(sa.column("type").in_(ACTIVITY_TYPES), name=op.f("ck_activities_type")),
        sa.CheckConstraint(
            sa.column("contact_id").is_(None) != sa.column("deal_id").is_(None), name=op.f("ck_activities_one_parent")
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"], ["contacts.id"], name=op.f("fk_activities_contact_id_contacts"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["deals.id"], name=op.f("fk_activities_deal_id_deals"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activities")),
    )
    op.create_index(op.f("ix_activities_contact_id"), "activities", ["contact_id"])
    op.create_index(op.f("ix_activities_deal_id"), "activities", ["deal_id"])
    op.create_index(op.f("ix_activities_occurred_at"), "activities", ["occurred_at"])
    op.create_index(op.f("ix_activities_follow_up_date_done"), "activities", ["follow_up_date", "done"])

    op.create_table(
        "stage_changes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("from_stage", sa.String(), nullable=True),
        sa.Column("to_stage", sa.String(), nullable=False),
        sa.Column("changed_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["deals.id"], name=op.f("fk_stage_changes_deal_id_deals"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stage_changes")),
    )
    op.create_index(op.f("ix_stage_changes_deal_id_changed_at"), "stage_changes", ["deal_id", "changed_at"])


def downgrade() -> None:
    # Migrations are forward-only in the MVP (DEP-4, DEP-6).
    raise NotImplementedError("Restore the copy of backend/data/ made before upgrading.")
