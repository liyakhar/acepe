//! Migration to create pre-session creation attempts.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(CreationAttempts::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CreationAttempts::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::AgentId)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::ProjectPath)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::WorktreePath)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::LaunchToken)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::Status)
                            .string()
                            .not_null()
                            .default("pending"),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::FailureReason)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::ProviderSessionId)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::SequenceId)
                            .integer()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CreationAttempts::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_creation_attempts_project_agent_status")
                    .table(CreationAttempts::Table)
                    .col(CreationAttempts::ProjectPath)
                    .col(CreationAttempts::AgentId)
                    .col(CreationAttempts::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_creation_attempts_launch_token")
                    .table(CreationAttempts::Table)
                    .col(CreationAttempts::LaunchToken)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_creation_attempts_status_created_at")
                    .table(CreationAttempts::Table)
                    .col(CreationAttempts::Status)
                    .col(CreationAttempts::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_creation_attempts_project_sequence")
                    .table(CreationAttempts::Table)
                    .col(CreationAttempts::ProjectPath)
                    .col(CreationAttempts::SequenceId)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(CreationAttempts::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum CreationAttempts {
    Table,
    Id,
    AgentId,
    ProjectPath,
    WorktreePath,
    LaunchToken,
    Status,
    FailureReason,
    ProviderSessionId,
    SequenceId,
    CreatedAt,
    UpdatedAt,
}
