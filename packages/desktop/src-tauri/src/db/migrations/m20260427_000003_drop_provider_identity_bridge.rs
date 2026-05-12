use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::Statement;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        if column_exists(db, "provider_session_id").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(SessionMetadata::Table)
                        .drop_column(SessionMetadata::ProviderSessionId)
                        .to_owned(),
                )
                .await?;
        }

        if column_exists(db, "provider_identity_kind").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(SessionMetadata::Table)
                        .drop_column(SessionMetadata::ProviderIdentityKind)
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        if !column_exists(db, "provider_session_id").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(SessionMetadata::Table)
                        .add_column(
                            ColumnDef::new(SessionMetadata::ProviderSessionId)
                                .string()
                                .null(),
                        )
                        .to_owned(),
                )
                .await?;
        }

        if !column_exists(db, "provider_identity_kind").await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(SessionMetadata::Table)
                        .add_column(
                            ColumnDef::new(SessionMetadata::ProviderIdentityKind)
                                .string()
                                .not_null()
                                .default("provider_owned_canonical"),
                        )
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }
}

async fn column_exists<C>(db: &C, column_name: &str) -> Result<bool, DbErr>
where
    C: ConnectionTrait,
{
    let escaped_column_name = column_name.replace('\'', "''");
    let row = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            format!(
                "SELECT COUNT(*) AS count
                 FROM pragma_table_info('session_metadata')
                 WHERE name = '{escaped_column_name}'"
            ),
        ))
        .await?;

    Ok(row
        .and_then(|row| row.try_get::<i64>("", "count").ok())
        .unwrap_or(0)
        > 0)
}

#[derive(DeriveIden)]
enum SessionMetadata {
    Table,
    ProviderSessionId,
    ProviderIdentityKind,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::Migrator;
    use sea_orm_migration::sea_orm::Database;

    #[tokio::test]
    async fn migration_removes_provider_identity_bridge_columns() {
        let db = Database::connect("sqlite::memory:")
            .await
            .expect("connect sqlite");
        Migrator::up(&db, None).await.expect("run migrations");

        assert!(!column_exists(&db, "provider_session_id")
            .await
            .expect("provider_session_id lookup"));
        assert!(!column_exists(&db, "provider_identity_kind")
            .await
            .expect("provider_identity_kind lookup"));
    }

    #[tokio::test]
    async fn migration_down_restores_bridge_columns_for_rollback() {
        let db = Database::connect("sqlite::memory:")
            .await
            .expect("connect sqlite");
        Migrator::up(&db, None).await.expect("run migrations");

        Migration
            .down(&SchemaManager::new(&db))
            .await
            .expect("down");

        assert!(column_exists(&db, "provider_session_id")
            .await
            .expect("provider_session_id lookup"));
        assert!(column_exists(&db, "provider_identity_kind")
            .await
            .expect("provider_identity_kind lookup"));
    }
}
