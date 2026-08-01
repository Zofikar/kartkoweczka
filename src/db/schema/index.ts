import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { snapshotJsonb } from './custom-types';

function generateId(): string {
	return uuidv7();
}

// ─── tags ───────────────────────────────────────────────────────────────────

export const tags = pgTable('tags', {
	tagName: text('tag_name').primaryKey().notNull(),
});

// ─── questions ──────────────────────────────────────────────────────────────

export const questions = pgTable('questions', {
	id: uuid('id').primaryKey().$defaultFn(generateId),
	content: text('content').notNull(),
	type: text('type').notNull().$type<'choice' | 'true_false'>(),
	image: text('image'),
	imageWidth: integer('image_width'),
	imageHeight: integer('image_height'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── question_tags ──────────────────────────────────────────────────────────

export const questionTags = pgTable(
	'question_tags',
	{
		questionId: uuid('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'cascade' }),
		tagName: text('tag_name')
			.notNull()
			.references(() => tags.tagName, { onDelete: 'cascade' }),
	},
	(table) => ({
		pk: { columns: [table.questionId, table.tagName] },
	})
);

// ─── answers ────────────────────────────────────────────────────────────────

export const answers = pgTable('answers', {
	id: uuid('id').primaryKey().$defaultFn(generateId),
	questionId: uuid('question_id')
		.notNull()
		.references(() => questions.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	isCorrect: boolean('is_correct').notNull().default(false),
});

// ─── tests ──────────────────────────────────────────────────────────────────

export const tests = pgTable('tests', {
	id: uuid('id').primaryKey().$defaultFn(generateId),
	name: text('name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── test_questions ─────────────────────────────────────────────────────────

export const testQuestions = pgTable(
	'test_questions',
	{
		testId: uuid('test_id')
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		questionId: uuid('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'restrict' }),
		questionOrder: integer('question_order').notNull(),
	},
	(table) => ({
		pk: { columns: [table.testId, table.questionId] },
	})
);

// ─── test_revisions ─────────────────────────────────────────────────────────

export const testRevisions = pgTable('test_revisions', {
	id: uuid('id').primaryKey().$defaultFn(generateId),
	testId: uuid('test_id')
		.notNull()
		.references(() => tests.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	content: snapshotJsonb('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
