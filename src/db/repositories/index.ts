/**
 * Public API of the data layer — logical operations on the app's data.
 *
 * This is the ONLY db-related module pages/helpers may import. The database
 * handle, schema, and query details stay internal to `src/db`.
 */

export * from './types';
export { onDataChanged, type DataTopic } from './events';
export * from './questions';
export * from './tags';
export * from './tests';
export * from './revisions';
