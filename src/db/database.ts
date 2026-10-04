import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { DatabaseBridge } from './bridge';
import * as relations from './schema/relations';
import * as tables from './schema';

export function createDatabase(bridge: DatabaseBridge) {
	return drizzle((sql, params, method) => bridge.execute(sql, params, method), {
		schema: {
			...tables,
			...relations,
		},
	});
}

export type Database = ReturnType<typeof createDatabase>;
