import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { v7 as uuidv7 } from 'uuid';
import type { ImagePlacement, SnapshotQuestion } from '@/db/repositories';

function generateId(): string {
	return uuidv7();
}

// ─── tags ───────────────────────────────────────────────────────────────────

export const tags = sqliteTable('tags', {
	tagName: text('tag_name').primaryKey().notNull(),
});

// ─── questions ──────────────────────────────────────────────────────────────

export const questions = sqliteTable('questions', {
	id: text('id').primaryKey().$defaultFn(generateId),

	content: text('content').notNull(),

	type: text('type').notNull().$type<'choice' | 'true_false'>(),

	image: text('image'),

	imageHeight: integer('image_height'),

	imagePlacement: text('image_placement').notNull().default('over').$type<ImagePlacement>(),

	createdAt: integer('created_at', {
		mode: 'timestamp_ms',
	})
		.notNull()
		.$defaultFn(() => new Date()),

	updatedAt: integer('updated_at', {
		mode: 'timestamp_ms',
	})
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date()),
});

// ─── question_tags ──────────────────────────────────────────────────────────

export const questionTags = sqliteTable(
	'question_tags',
	{
		questionId: text('question_id')
			.notNull()
			.references(() => questions.id, {
				onDelete: 'cascade',
			}),

		tagName: text('tag_name')
			.notNull()
			.references(() => tags.tagName, {
				onDelete: 'cascade',
			}),
	},
	(table) => [
		primaryKey({
			columns: [table.questionId, table.tagName],
		}),
	]
);

// ─── answers ────────────────────────────────────────────────────────────────

export const answers = sqliteTable('answers', {
	id: text('id').primaryKey().$defaultFn(generateId),

	questionId: text('question_id')
		.notNull()
		.references(() => questions.id, {
			onDelete: 'cascade',
		}),

	content: text('content').notNull(),

	isCorrect: integer('is_correct', {
		mode: 'boolean',
	})
		.notNull()
		.default(false),
});

// ─── tests ──────────────────────────────────────────────────────────────────

export const tests = sqliteTable('tests', {
	id: text('id').primaryKey().$defaultFn(generateId),

	name: text('name').notNull(),

	createdAt: integer('created_at', {
		mode: 'timestamp_ms',
	})
		.notNull()
		.$defaultFn(() => new Date()),

	updatedAt: integer('updated_at', {
		mode: 'timestamp_ms',
	})
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date()),
});

// ─── test_questions ─────────────────────────────────────────────────────────

export const testQuestions = sqliteTable(
	'test_questions',
	{
		testId: text('test_id')
			.notNull()
			.references(() => tests.id, {
				onDelete: 'cascade',
			}),

		questionId: text('question_id')
			.notNull()
			.references(() => questions.id, {
				onDelete: 'restrict',
			}),

		questionOrder: integer('question_order').notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.testId, table.questionId],
		}),
	]
);

// ─── test_revisions ─────────────────────────────────────────────────────────

export const testRevisions = sqliteTable('test_revisions', {
	id: text('id').primaryKey().$defaultFn(generateId),

	testId: text('test_id')
		.notNull()
		.references(() => tests.id, {
			onDelete: 'cascade',
		}),

	name: text('name').notNull(),

	content: text('content', {
		mode: 'json',
	})
		.$type<SnapshotQuestion[]>()
		.notNull(),

	createdAt: integer('created_at', {
		mode: 'timestamp_ms',
	})
		.notNull()
		.$defaultFn(() => new Date()),
});
