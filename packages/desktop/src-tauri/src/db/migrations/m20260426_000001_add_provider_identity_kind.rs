use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::Statement;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        if !provider_identity_kind_exists(db).await? {
            manager
                .alter_table(
                    Table::alter()
                        .table(SessionMetadata::Table)
                        .add_column(
                            ColumnDef::new(SessionMetadata::ProviderIdentityKind)
                                .string()
                                .not_null()
                                .default("unknown"),
                        )
                        .to_owned(),
                )
                .await?;
        }

        if provider_session_id_exists(db).await? {
            db.execute_unprepared(
                "UPDATE session_metadata
                 SET provider_identity_kind = 'provider_owned_canonical',
                     provider_session_id = NULL
                 WHERE provider_session_id IS NOT NULL
                   AND provider_session_id = id",
            )
            .await?;

            db.execute_unprepared(
                "UPDATE session_metadata
                 SET provider_identity_kind = 'legacy_provider_alias'
                 WHERE provider_session_id IS NOT NULL
                   AND provider_session_id != id",
            )
            .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        if provider_identity_kind_exists(db).await? {
            if provider_session_id_exists(db).await? {
                db.execute_unprepared(
                    "UPDATE session_metadata
                     SET provider_session_id = id
                     WHERE provider_identity_kind = 'provider_owned_canonical'
                       AND provider_session_id IS NULL",
                )
                .await?;
            }

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
}

async fn provider_identity_kind_exists<C>(db: &C) -> Result<bool, DbErr>
where
    C: ConnectionTrait,
{
    let row = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "SELECT COUNT(*) AS count
             FROM pragma_table_info('session_metadata')
             WHERE name = 'provider_identity_kind'"
                .to_string(),
        ))
        .await?;

    Ok(row
        .and_then(|row| row.try_get::<i64>("", "count").ok())
        .unwrap_or(0)
        > 0)
}

async fn provider_session_id_exists<C>(db: &C) -> Result<bool, DbErr>
where
    C: ConnectionTrait,
{
    let row = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "SELECT COUNT(*) AS count
             FROM pragma_table_info('session_metadata')
             WHERE name = 'provider_session_id'"
                .to_string(),
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
    ProviderIdentityKind,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm_migration::sea_orm::Database;
    use sea_orm_migration::MigratorTrait;

    #[tokio::test]
    async fn migration_can_run_after_down() {
        let db = Database::connect("sqlite::memory:")
            .await
            .expect("connect sqlite");
        crate::db::migrations::Migrator::up(&db, None)
            .await
            .expect("run migrations");

        let manager = SchemaManager::new(&db);
        Migration.down(&manager).await.expect("run down");
        assert!(
            !provider_identity_kind_exists(&db)
                .await
                .expect("check column"),
            "down should remove provider_identity_kind"
        );

        Migration.up(&manager).await.expect("rerun up");
        assert!(
            provider_identity_kind_exists(&db)
                .await
                .expect("check column"),
            "up should recreate provider_identity_kind"
        );
    }
}
