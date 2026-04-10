import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import {
	deleteConnection,
	executeQuery,
	exploreTable,
	listConnections,
	listSchema,
	saveConnection,
	testConnection,
	updateTableCell,
} from "../api/sql-studio-api.js";
import type {
	ConnectionFormInput,
	QueryExecutionResult,
	SavedConnectionSummary,
	SchemaNode,
	TableNode,
	TestConnectionResult,
} from "../types/index.js";

const EXPLORER_PAGE_SIZE = 50;

interface PendingExplorerEdit {
	readonly rowIndex: number;
	readonly columnName: string;
	readonly nextValue: string;
}

export class SqlStudioStore {
	overlayOpen = $state(false);
	queryText = $state("");
	selectedConnectionId = $state<string | null>(null);
	connections = $state<readonly SavedConnectionSummary[]>([]);
	schema = $state<readonly SchemaNode[]>([]);
	result = $state<QueryExecutionResult | null>(null);
	selectedSchemaName = $state<string | null>(null);
	selectedTableName = $state<string | null>(null);
	selectedTablePrimaryKeyColumns = $state<readonly string[]>([]);
	explorerColumns = $state<readonly string[]>([]);
	explorerRows = $state<readonly (readonly string[])[]>([]);
	explorerNextOffset = $state<number | null>(null);
	explorerReadOnlyReason = $state<string | null>(null);
	pendingExplorerEdits = $state<Record<string, string>>({});
	isLoadingConnections = $state(false);
	isExecutingQuery = $state(false);
	isSavingConnection = $state(false);
	isDeletingConnection = $state(false);
	isTestingConnection = $state(false);
	isLoadingExplorer = $state(false);
	isLoadingExplorerMore = $state(false);
	isSavingExplorerEdits = $state(false);
	lastError = $state<string | null>(null);
	lastInfo = $state<string | null>(null);
	sortColumn = $state<string | null>(null);
	sortDirection = $state<"asc" | "desc">("asc");
	filterColumn = $state<string | null>(null);
	filterOperator = $state<"equals" | "contains" | "starts with" | "greater than" | "less than">(
		"equals"
	);
	filterValue = $state("");

	open(): void {
		this.overlayOpen = true;
	}

	close(): void {
		this.overlayOpen = false;
	}

	private resetExplorerState(): void {
		this.selectedSchemaName = null;
		this.selectedTableName = null;
		this.selectedTablePrimaryKeyColumns = [];
		this.explorerColumns = [];
		this.explorerRows = [];
		this.explorerNextOffset = null;
		this.explorerReadOnlyReason = null;
		this.pendingExplorerEdits = {};
		this.sortColumn = null;
		this.sortDirection = "asc";
		this.filterColumn = null;
		this.filterOperator = "equals";
		this.filterValue = "";
	}

	setSortColumn(column: string): void {
		if (this.sortColumn === column) {
			this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
		} else {
			this.sortColumn = column;
			this.sortDirection = "asc";
		}
	}

	private pendingCellKey(rowIndex: number, columnName: string): string {
		return `${rowIndex}:${columnName}`;
	}

	private parsePendingCellKey(key: string): PendingExplorerEdit | null {
		const separatorIndex = key.indexOf(":");
		if (separatorIndex < 1 || separatorIndex === key.length - 1) {
			return null;
		}

		const rowIndex = Number.parseInt(key.slice(0, separatorIndex), 10);
		if (!Number.isFinite(rowIndex) || rowIndex < 0) {
			return null;
		}

		return {
			rowIndex,
			columnName: key.slice(separatorIndex + 1),
			nextValue: this.pendingExplorerEdits[key] ?? "",
		};
	}

	private findSelectedTableNode(): TableNode | null {
		if (this.selectedSchemaName === null || this.selectedTableName === null) {
			return null;
		}

		const schemaNode = this.schema.find((schema) => schema.name === this.selectedSchemaName);
		if (!schemaNode) {
			return null;
		}

		return schemaNode.tables.find((table) => table.name === this.selectedTableName) ?? null;
	}

	loadConnections(): ResultAsync<void, Error> {
		this.isLoadingConnections = true;
		this.lastError = null;
		return listConnections()
			.map((connections) => {
				this.connections = connections;
				if (this.selectedConnectionId !== null) {
					const stillExists = connections.some(
						(connection) => connection.id === this.selectedConnectionId
					);
					if (!stillExists) {
						this.selectedConnectionId = null;
						this.schema = [];
						this.resetExplorerState();
					}
				}
			})
			.andThen(() => okAsync(undefined))
			.andTee(() => {
				this.isLoadingConnections = false;
			})
			.orTee(() => {
				this.isLoadingConnections = false;
			});
	}

	selectConnection(id: string): ResultAsync<void, Error> {
		this.selectedConnectionId = id;
		this.result = null;
		this.lastError = null;
		this.resetExplorerState();
		return listSchema(id)
			.map((schema) => {
				this.schema = schema;
				this.lastInfo = `Loaded schema (${schema.length} schema${schema.length === 1 ? "" : "s"})`;
			})
			.andThen(() => okAsync(undefined));
	}

	runQuery(): ResultAsync<void, Error> {
		if (this.selectedConnectionId === null) {
			return errAsync(new Error("No connection selected"));
		}

		this.isExecutingQuery = true;
		this.lastError = null;
		return executeQuery({
			connectionId: this.selectedConnectionId,
			sql: this.queryText,
		})
			.map((result) => {
				this.result = result;
				this.lastInfo = `Query completed in ${result.durationMs}ms`;
			})
			.andThen(() => okAsync(undefined))
			.andTee(() => {
				this.isExecutingQuery = false;
			})
			.orTee((error) => {
				this.lastError = error.message;
				this.result = null;
				this.isExecutingQuery = false;
			});
	}

	selectTable(schemaName: string, tableName: string): ResultAsync<void, Error> {
		const schemaNode = this.schema.find((schema) => schema.name === schemaName);
		const tableNode = schemaNode?.tables.find((table) => table.name === tableName) ?? null;
		if (!tableNode) {
			return errAsync(new Error(`Table not found: ${schemaName}.${tableName}`));
		}

		this.selectedSchemaName = schemaName;
		this.selectedTableName = tableName;
		this.selectedTablePrimaryKeyColumns = tableNode.primaryKeyColumns;
		this.explorerReadOnlyReason =
			tableNode.primaryKeyColumns.length === 0
				? "Editing unavailable: table has no primary key."
				: null;
		this.explorerColumns = [];
		this.explorerRows = [];
		this.explorerNextOffset = null;
		this.pendingExplorerEdits = {};
		return this.loadExplorerPage(0, true);
	}

	private loadExplorerPage(offset: number, resetRows: boolean): ResultAsync<void, Error> {
		if (
			this.selectedConnectionId === null ||
			this.selectedSchemaName === null ||
			this.selectedTableName === null
		) {
			return errAsync(new Error("No table selected"));
		}

		if (resetRows) {
			this.isLoadingExplorer = true;
		} else {
			this.isLoadingExplorerMore = true;
		}
		this.lastError = null;

		return exploreTable({
			connectionId: this.selectedConnectionId,
			schemaName: this.selectedSchemaName,
			tableName: this.selectedTableName,
			offset,
			limit: EXPLORER_PAGE_SIZE,
		})
			.map((response) => {
				this.explorerColumns = response.columns;
				this.explorerRows = resetRows ? response.rows : [...this.explorerRows, ...response.rows];
				this.explorerNextOffset = response.nextOffset;
				this.lastInfo = `Loaded ${this.explorerRows.length} row${this.explorerRows.length === 1 ? "" : "s"}`;
			})
			.andThen(() => okAsync(undefined))
			.andTee(() => {
				this.isLoadingExplorer = false;
				this.isLoadingExplorerMore = false;
			})
			.orTee((error) => {
				this.isLoadingExplorer = false;
				this.isLoadingExplorerMore = false;
				this.lastError = error.message;
			});
	}

	loadMoreExplorerRows(): ResultAsync<void, Error> {
		if (this.explorerNextOffset === null) {
			return errAsync(new Error("No more rows to load"));
		}

		return this.loadExplorerPage(this.explorerNextOffset, false);
	}

	getExplorerCellValue(rowIndex: number, columnName: string): string {
		const pendingKey = this.pendingCellKey(rowIndex, columnName);
		const pendingValue = this.pendingExplorerEdits[pendingKey];
		if (pendingValue !== undefined) {
			return pendingValue;
		}

		const columnIndex = this.explorerColumns.indexOf(columnName);
		if (columnIndex < 0) {
			return "";
		}

		const row = this.explorerRows[rowIndex];
		if (!row) {
			return "";
		}

		return row[columnIndex] ?? "";
	}

	isExplorerCellDirty(rowIndex: number, columnName: string): boolean {
		return this.pendingExplorerEdits[this.pendingCellKey(rowIndex, columnName)] !== undefined;
	}

	get pendingExplorerEditCount(): number {
		return Object.keys(this.pendingExplorerEdits).length;
	}

	setExplorerCellEdit(rowIndex: number, columnName: string, nextValue: string): void {
		const columnIndex = this.explorerColumns.indexOf(columnName);
		if (columnIndex < 0) {
			return;
		}

		const row = this.explorerRows[rowIndex];
		if (!row) {
			return;
		}

		const originalValue = row[columnIndex] ?? "";
		const key = this.pendingCellKey(rowIndex, columnName);
		if (nextValue === originalValue) {
			const { [key]: _ignored, ...remaining } = this.pendingExplorerEdits;
			this.pendingExplorerEdits = remaining;
			return;
		}

		this.pendingExplorerEdits = {
			...this.pendingExplorerEdits,
			[key]: nextValue,
		};
	}

	discardExplorerEdits(): void {
		this.pendingExplorerEdits = {};
	}

	saveExplorerEdits(): ResultAsync<void, Error> {
		if (
			this.selectedConnectionId === null ||
			this.selectedSchemaName === null ||
			this.selectedTableName === null
		) {
			return errAsync(new Error("No table selected"));
		}

		if (this.explorerReadOnlyReason !== null) {
			return errAsync(new Error(this.explorerReadOnlyReason));
		}

		if (this.selectedTablePrimaryKeyColumns.length === 0) {
			return errAsync(new Error("Cannot save edits without primary key columns"));
		}

		const connectionId = this.selectedConnectionId;
		const schemaName = this.selectedSchemaName;
		const tableName = this.selectedTableName;

		const parsedEdits = Object.keys(this.pendingExplorerEdits)
			.map((key) => this.parsePendingCellKey(key))
			.filter((entry): entry is PendingExplorerEdit => entry !== null);

		if (parsedEdits.length === 0) {
			return okAsync(undefined);
		}

		this.isSavingExplorerEdits = true;
		this.lastError = null;

		const saveChain = parsedEdits.reduce((chain, edit) => {
			return chain.andThen(() => {
				const row = this.explorerRows[edit.rowIndex];
				if (!row) {
					return errAsync(new Error("Cannot save edit: row is not loaded"));
				}

				const primaryKeyValues = this.selectedTablePrimaryKeyColumns.map((pkColumn) => {
					const pkIndex = this.explorerColumns.indexOf(pkColumn);
					if (pkIndex < 0) {
						return "";
					}
					return row[pkIndex] ?? "";
				});

				if (primaryKeyValues.some((value) => value.length === 0)) {
					return errAsync(
						new Error("Cannot save edit: missing primary key value in current row snapshot")
					);
				}

				return updateTableCell({
					connectionId,
					schemaName,
					tableName,
					primaryKeyColumns: this.selectedTablePrimaryKeyColumns,
					primaryKeyValues,
					columnName: edit.columnName,
					newValue: edit.nextValue,
				}).andThen((result) => {
					if (result.rowsAffected !== 1) {
						return errAsync(new Error(`Expected 1 row updated, got ${result.rowsAffected}`));
					}

					const updatedRows = [...this.explorerRows];
					const rowToUpdate = [...updatedRows[edit.rowIndex]];
					const columnIndex = this.explorerColumns.indexOf(edit.columnName);
					if (columnIndex >= 0) {
						rowToUpdate[columnIndex] = edit.nextValue;
						updatedRows[edit.rowIndex] = rowToUpdate;
						this.explorerRows = updatedRows;
					}

					const key = this.pendingCellKey(edit.rowIndex, edit.columnName);
					const { [key]: _ignored, ...remaining } = this.pendingExplorerEdits;
					this.pendingExplorerEdits = remaining;

					return okAsync(undefined);
				});
			});
		}, okAsync<void, Error>(undefined));

		return saveChain
			.andTee(() => {
				this.isSavingExplorerEdits = false;
				this.lastInfo = "Saved explorer changes";
			})
			.orTee((error) => {
				this.isSavingExplorerEdits = false;
				this.lastError = error.message;
			});
	}

	createOrUpdateConnection(input: ConnectionFormInput): ResultAsync<SavedConnectionSummary, Error> {
		this.isSavingConnection = true;
		this.lastError = null;
		return saveConnection(input)
			.andThen((connection) =>
				this.loadConnections().map(() => {
					this.selectedConnectionId = connection.id;
					this.lastInfo = `Saved connection "${connection.name}"`;
					return connection;
				})
			)
			.andTee(() => {
				this.isSavingConnection = false;
			})
			.orTee((error) => {
				this.lastError = error.message;
				this.isSavingConnection = false;
			});
	}

	deleteSelectedConnection(): ResultAsync<void, Error> {
		if (this.selectedConnectionId === null) {
			return errAsync(new Error("No connection selected"));
		}
		return this.deleteConnectionById(this.selectedConnectionId);
	}

	deleteConnectionById(connectionId: string): ResultAsync<void, Error> {
		this.isDeletingConnection = true;
		this.lastError = null;
		const wasSelected = this.selectedConnectionId === connectionId;
		return deleteConnection(connectionId)
			.andThen(() => this.loadConnections())
			.map(() => {
				if (wasSelected) {
					this.selectedConnectionId = null;
					this.schema = [];
					this.result = null;
					this.resetExplorerState();
				}
				this.lastInfo = "Connection deleted";
			})
			.andTee(() => {
				this.isDeletingConnection = false;
			})
			.orTee((error) => {
				this.lastError = error.message;
				this.isDeletingConnection = false;
			});
	}

	testSelectedConnection(): ResultAsync<TestConnectionResult, Error> {
		if (this.selectedConnectionId === null) {
			return errAsync(new Error("No connection selected"));
		}

		this.isTestingConnection = true;
		this.lastError = null;
		const connectionId = this.selectedConnectionId;
		return testConnection(connectionId)
			.map((result) => {
				if (result.ok) {
					this.lastInfo = result.message;
				} else {
					this.lastError = result.message;
				}
				return result;
			})
			.andTee(() => {
				this.isTestingConnection = false;
			})
			.orTee((error) => {
				this.lastError = error.message;
				this.isTestingConnection = false;
			});
	}
}

let sqlStudioStore: SqlStudioStore | null = null;

export function getSqlStudioStore(): SqlStudioStore {
	if (sqlStudioStore === null) {
		sqlStudioStore = new SqlStudioStore();
	}
	return sqlStudioStore;
}

export function resetSqlStudioStore(): void {
	sqlStudioStore = null;
}
