import { customType } from 'drizzle-orm/pg-core';
import type { SnapshotQuestion } from '../repositories/types';

export const snapshotJsonb = customType<{
	data: SnapshotQuestion[];
	driverData: string;
}>({
	dataType: () => 'jsonb',
	toDriver: (value: SnapshotQuestion[]): string => JSON.stringify(value),
	fromDriver: (value: unknown): SnapshotQuestion[] =>
		typeof value === 'string'
			? (JSON.parse(value) as SnapshotQuestion[])
			: (value as SnapshotQuestion[]),
});
