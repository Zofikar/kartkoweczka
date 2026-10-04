import type { SnapshotQuestion } from '@/db/repositories';

export interface QuestionResponseRow {
	questionNumber: number;
	subQuestionNumber: number;
	displayNumber: string;
	answerLabels: string[];
	correctAnswerIndex: number;
}

export interface TrueFalseResponseLabels {
	trueLabel: string;
	falseLabel: string;
}

const DEFAULT_TRUE_FALSE_LABELS: TrueFalseResponseLabels = {
	trueLabel: 'T',
	falseLabel: 'F',
};

export function buildQuestionResponseRows(
	questions: SnapshotQuestion[],
	trueFalseLabels: TrueFalseResponseLabels = DEFAULT_TRUE_FALSE_LABELS
): QuestionResponseRow[] {
	return questions.flatMap((question, questionIndex) => {
		const questionNumber = questionIndex + 1;
		if (question.type === 'true_false') {
			return question.answers.map((statement, statementIndex) => ({
				questionNumber,
				subQuestionNumber: statementIndex + 1,
				displayNumber: `${questionNumber}.${statementIndex + 1}`,
				answerLabels: [trueFalseLabels.trueLabel, trueFalseLabels.falseLabel],
				correctAnswerIndex: statement.is_correct ? 0 : 1,
			}));
		}

		return [
			{
				questionNumber,
				subQuestionNumber: 0,
				displayNumber: String(questionNumber),
				answerLabels: question.answers.map((_, answerIndex) =>
					String.fromCharCode(65 + answerIndex)
				),
				correctAnswerIndex: question.answers.findIndex((answer) => answer.is_correct),
			},
		];
	});
}
