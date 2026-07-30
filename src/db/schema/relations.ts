import { relations } from 'drizzle-orm';
import {
	questions,
	answers,
	questionTags,
	tags,
	tests,
	testQuestions,
	testRevisions,
} from './index';

export const questionsRelations = relations(questions, ({ many }) => ({
	answers: many(answers),
	questionTags: many(questionTags),
	testQuestions: many(testQuestions),
}));

export const answersRelations = relations(answers, ({ one }) => ({
	question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	questionTags: many(questionTags),
}));

export const questionTagsRelations = relations(questionTags, ({ one }) => ({
	question: one(questions, { fields: [questionTags.questionId], references: [questions.id] }),
	tag: one(tags, { fields: [questionTags.tagName], references: [tags.tagName] }),
}));

export const testsRelations = relations(tests, ({ many }) => ({
	testQuestions: many(testQuestions),
	testRevisions: many(testRevisions),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
	test: one(tests, { fields: [testQuestions.testId], references: [tests.id] }),
	question: one(questions, { fields: [testQuestions.questionId], references: [questions.id] }),
}));

export const testRevisionsRelations = relations(testRevisions, ({ one }) => ({
	test: one(tests, { fields: [testRevisions.testId], references: [tests.id] }),
}));
