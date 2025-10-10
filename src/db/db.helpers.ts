import { type AnyPgColumn, type AnyPgTable, timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  // use timestamptz for timezone support via withTimezone: true
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}

type TableColumns<TTable extends AnyPgTable> = TTable['_']['columns']

/**
 * Build strongly typed select field object from table and column names
 * The return type is the exact `{ colName: Column }` map Drizzle expects for select, return, etc
 */
export const getSelectFields = <
  TTable extends AnyPgTable,
  K extends readonly (keyof TableColumns<TTable>)[],
>(
  table: TTable,
  keys: K,
): { [C in K[number]]: TableColumns<TTable>[C] } => {
  // Drizzle stores columns on internal `_` symbol
  const cols = table._?.columns as Record<string, AnyPgColumn>
  const out: Record<string, AnyPgColumn> = {}
  for (const k of keys as readonly string[]) out[k] = cols[k]
  return out as { [C in K[number]]: TableColumns<TTable>[C] }
}
