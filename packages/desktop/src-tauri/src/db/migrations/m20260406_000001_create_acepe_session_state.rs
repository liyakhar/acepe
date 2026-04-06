//! Migration to create Acepe-owned per-session state.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AcepeSessionState::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AcepeSessionState::SessionId)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::Relationship)
                            .string()
                            .not_null()
                            .default("discovered"),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::ProjectPath)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::TitleOverride)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::WorktreePath)
                            .string()
                            .null(),
                    )
                    .col(ColumnDef::new(AcepeSessionState::PrNumber).integer().null())
                    .col(
                        ColumnDef::new(AcepeSessionState::SequenceId)
                            .integer()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AcepeSessionState::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_acepe_session_state_session_id")
                            .from(AcepeSessionState::Table, AcepeSessionState::SessionId)
                            .to(SessionMetadata::Table, SessionMetadata::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_acepe_session_state_project_sequence")
                    .table(AcepeSessionState::Table)
                    .col(AcepeSessionState::ProjectPath)
                    .col(AcepeSessionState::SequenceId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_acepe_session_state_relationship")
                    .table(AcepeSessionState::Table)
                    .col(AcepeSessionState::Relationship)
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();
        db.execute_unprepared(
            "INSERT INTO acepe_session_state (
                session_id,
                relationship,
                project_path,
                worktree_path,
                pr_number,
                sequence_id,
                created_at,
                updated_at
            )
            SELECT
                id,
                CASE
                    WHEN is_acepe_managed = 0 THEN 'discovered'
                    WHEN file_path LIKE '__session_registry__/%' OR file_path LIKE '__worktree__/%' THEN 'created'
                    ELSE 'opened'
                END,
                project_path,
                worktree_path,
                pr_number,
                sequence_id,
                created_at,
                updated_at
            FROM session_metadata
            WHERE is_acepe_managed != 0
               OR worktree_path IS NOT NULL
               OR pr_number IS NOT NULL
               OR sequence_id IS NOT NULL",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AcepeSessionState::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum AcepeSessionState {
    Table,
    SessionId,
    Relationship,
    ProjectPath,
    TitleOverride,
    WorktreePath,
    PrNumber,
    SequenceId,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SessionMetadata {
    Table,
    Id,
}
