import type { WhereExpressionBuilder } from "typeorm";

const noteHasContentCondition = (noteAlias: string): string => {
	return `(${noteAlias}.text IS NOT NULL OR CARDINALITY(${noteAlias}."fileIds") > 0 OR ${noteAlias}."hasPoll" = TRUE)`;
};

export const applyOrWhereNoteHasContent = (
	qb: WhereExpressionBuilder,
	noteAlias: string,
): void => {
	qb.orWhere(noteHasContentCondition(noteAlias));
};
