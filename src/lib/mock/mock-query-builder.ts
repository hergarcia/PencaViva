// src/lib/mock/mock-query-builder.ts
import {
  type MockStore,
  type TableName,
  getRowKey,
  findByConflictKey,
} from "./mock-store";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result<T = any> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

// ── Join parsing ────────────────────────────────────────────────────
// Handles nested joins like: group:groups!inner ( id, name, group_members ( count ) )
// and FK hints like: profiles!user_id, groups!inner

type JoinSpec = {
  alias: string;
  table: TableName;
  fk: string;
  columns: string[];
  isCount: boolean;
  children: JoinSpec[]; // nested joins inside this join
};

const JOIN_TYPE_HINTS = new Set(["inner", "left"]);

function inferFk(table: string, fkHint: string | undefined): string {
  // If no hint or hint is a join type keyword (inner/left), infer from table name
  if (!fkHint || JOIN_TYPE_HINTS.has(fkHint)) {
    return `${table.replace(/s$/, "")}_id`;
  }
  return fkHint;
}

function findMatchingParen(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "(") depth++;
    if (str[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseSelectLevel(selectStr: string): {
  columns: string[];
  joins: JoinSpec[];
} {
  const joins: JoinSpec[] = [];
  const columns: string[] = [];
  let remaining = selectStr;

  // Repeatedly find the next join pattern: [alias:]table[!fk] ( ... )
  while (true) {
    const match = remaining.match(/(?:(\w+):)?(\w+)(?:!(\w+))?\s*\(/);
    if (!match || match.index === undefined) break;

    // Extract plain columns before this join
    const before = remaining.substring(0, match.index);
    for (const col of before.split(",")) {
      const c = col.trim();
      if (c) columns.push(c);
    }

    const alias = match[1] || match[2];
    const table = match[2];
    const fkHint = match[3];
    const openParenIdx = match.index + match[0].length - 1;
    const closeParenIdx = findMatchingParen(remaining, openParenIdx);
    if (closeParenIdx === -1) break;

    const innerContent = remaining
      .substring(openParenIdx + 1, closeParenIdx)
      .trim();
    const fk = inferFk(table, fkHint);
    const isCount = innerContent === "count";

    // Recursively parse inner content for nested joins
    const inner = isCount
      ? { columns: [], joins: [] }
      : parseSelectLevel(innerContent);

    joins.push({
      alias,
      table: table as TableName,
      fk,
      columns: isCount ? [] : inner.columns,
      isCount,
      children: inner.joins,
    });

    remaining = remaining.substring(closeParenIdx + 1);
  }

  // Any remaining text after the last join
  for (const col of remaining.split(",")) {
    const c = col.trim();
    if (c) columns.push(c);
  }

  return { columns, joins };
}

// ── Query Builder ───────────────────────────────────────────────────

export class MockQueryBuilder {
  private store: MockStore;
  private table: TableName;
  private filters: Filter[] = [];
  private selectStr = "*";
  private limitCount: number | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private mutationData: Row | Row[] | null = null;
  private upsertConflict: string | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private postMutationSelect: string | null = null;

  constructor(store: MockStore, table: TableName) {
    this.store = store;
    this.table = table;
  }

  // ── Select ──────────────────────────────────────────────────────

  select(columns?: string): this {
    if (this.mode !== "select" && columns) {
      // Post-mutation select
      this.postMutationSelect = columns;
      return this;
    }
    this.selectStr = columns || "*";
    return this;
  }

  // ── Filters ─────────────────────────────────────────────────────

  eq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  is(col: string, val: null | boolean): this {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    this.filters.push((row) => {
      switch (op) {
        case "eq":
          return row[col] !== val;
        case "neq":
          return row[col] === val;
        case "gt":
          return (row[col] as number) <= (val as number);
        case "lt":
          return (row[col] as number) >= (val as number);
        case "is":
          return row[col] !== val; // NOT IS NULL → not null
        default:
          return true;
      }
    });
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) > (val as string));
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) >= (val as string));
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) < (val as string));
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push((row) => (row[col] as string) <= (val as string));
    return this;
  }

  // ── Modifiers ───────────────────────────────────────────────────

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  // ── Mutations ───────────────────────────────────────────────────

  insert(data: Row | Row[]): this {
    this.mode = "insert";
    this.mutationData = data;
    return this;
  }

  upsert(data: Row, opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.mutationData = data;
    this.upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  update(data: Row): this {
    this.mode = "update";
    this.mutationData = data;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  // ── Execution (thenable) ────────────────────────────────────────

  private getRows(): Row[] {
    return Array.from(this.store[this.table].values());
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((row) => this.filters.every((f) => f(row)));
  }

  private applyOrder(rows: Row[]): Row[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const dir = this.orderAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return dir;
      if (bVal == null) return -dir;
      if (typeof aVal === "string" && typeof bVal === "string")
        return aVal.localeCompare(bVal) * dir;
      return ((aVal as number) - (bVal as number)) * dir;
    });
  }

  private resolveJoin(
    join: JoinSpec,
    parentRow: Row,
    parentTable: TableName,
  ): unknown {
    if (join.isCount) {
      // Count aggregate: count rows in the join table matching the parent row's id
      const joinTable = this.store[join.table];
      if (!joinTable) return [{ count: 0 }];
      const fkCol = `${parentTable.replace(/s$/, "")}_id`;
      const parentId = parentRow.id;
      let count = 0;
      for (const jRow of joinTable.values()) {
        if (jRow[fkCol] === parentId) count++;
      }
      return [{ count }];
    }

    // Data join: find the related row via FK
    const joinTable = this.store[join.table];
    if (!joinTable) return null;
    const fkVal = parentRow[join.fk];
    let found: Row | null = null;
    for (const jRow of joinTable.values()) {
      if (jRow.id === fkVal) {
        found = jRow;
        break;
      }
    }
    if (!found) return null;

    // Project columns from the joined row
    const joinProjected: Row = {};
    for (const col of join.columns) {
      joinProjected[col] = found[col];
    }

    // Recursively resolve nested joins (e.g., group_members(count) inside groups)
    for (const child of join.children) {
      joinProjected[child.alias] = this.resolveJoin(child, found, join.table);
    }

    return joinProjected;
  }

  private projectColumns(rows: Row[]): Row[] {
    const sel = this.postMutationSelect || this.selectStr;
    if (sel === "*") return rows;

    const { columns, joins } = parseSelectLevel(sel);

    return rows.map((row) => {
      const projected: Row = {};

      // Plain columns
      if (columns.length === 0 && joins.length > 0) {
        Object.assign(projected, row);
      } else {
        for (const col of columns) {
          if (col === "*") {
            Object.assign(projected, row);
          } else {
            projected[col] = row[col];
          }
        }
      }

      // Resolve joins (with recursive nesting support)
      for (const join of joins) {
        projected[join.alias] = this.resolveJoin(join, row, this.table);
      }

      return projected;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private executeSelect(): Result<any> {
    let rows = this.getRows();
    rows = this.applyFilters(rows);
    rows = this.applyOrder(rows);
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    rows = this.projectColumns(rows);

    if (this.isSingle) {
      if (rows.length === 0)
        return { data: null, error: { message: "Row not found" } };
      return { data: rows[0], error: null };
    }
    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private executeInsert(): Result {
    const tableMap = this.store[this.table];
    const rows = Array.isArray(this.mutationData)
      ? this.mutationData
      : [this.mutationData!];
    for (const row of rows) {
      tableMap.set(getRowKey(this.table, row), { ...row });
    }
    return { data: rows, error: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private executeUpsert(): Result<any> {
    const tableMap = this.store[this.table];
    const row = this.mutationData as Row;

    if (this.upsertConflict) {
      const existing = findByConflictKey(tableMap, this.upsertConflict, row);
      if (existing) {
        const [key, existingRow] = existing;
        const merged = { ...existingRow, ...row };
        tableMap.set(key, merged);
        const result = [merged];
        if (this.isSingle) return { data: result[0], error: null };
        return { data: result, error: null };
      }
    }

    // Insert new
    const key = getRowKey(this.table, row);
    tableMap.set(key, { ...row });
    const result = [row];
    if (this.isSingle) return { data: result[0], error: null };
    return { data: result, error: null };
  }

  private executeUpdate(): Result {
    const tableMap = this.store[this.table];
    const patch = this.mutationData as Row;
    const rows = this.applyFilters(Array.from(tableMap.values()));
    for (const row of rows) {
      const key = getRowKey(this.table, row);
      tableMap.set(key, { ...row, ...patch });
    }
    return { data: rows, error: null };
  }

  private executeDelete(): Result {
    const tableMap = this.store[this.table];
    const rows = this.applyFilters(Array.from(tableMap.values()));
    for (const row of rows) {
      const key = getRowKey(this.table, row);
      tableMap.delete(key);
    }
    return { data: rows, error: null };
  }

  // ── Then (makes the builder thenable / awaitable) ───────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then<TResult1 = Result<any>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve?: (value: Result<any>) => TResult1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<TResult1> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: Result<any>;
    switch (this.mode) {
      case "insert":
        result = this.executeInsert();
        break;
      case "upsert":
        result = this.executeUpsert();
        break;
      case "update":
        result = this.executeUpdate();
        break;
      case "delete":
        result = this.executeDelete();
        break;
      default:
        result = this.executeSelect();
    }
    return Promise.resolve(
      resolve ? resolve(result) : (result as unknown as TResult1),
    );
  }
}
