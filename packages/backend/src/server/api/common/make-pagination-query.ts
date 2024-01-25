import { genId } from "@/misc/gen-id";
import type { SelectQueryBuilder } from "typeorm";

export function makePaginationQuery<T>(
	q: SelectQueryBuilder<T>,
	sinceId?: string,
	untilId?: string,
	sinceDate?: number,
	untilDate?: number,
) {
	if (sinceId && untilId) {
		q.andWhere(`${q.alias}.id > :sinceId`, { sinceId: sinceId });
		q.andWhere(`${q.alias}.id < :untilId`, { untilId: untilId });
		q.orderBy(`${q.alias}.id`, "DESC");
	} else if (sinceId) {
		q.andWhere(`${q.alias}.id > :sinceId`, { sinceId: sinceId });
		q.orderBy(`${q.alias}.id`, "ASC");
	} else if (untilId) {
		q.andWhere(`${q.alias}.id < :untilId`, { untilId: untilId });
		q.orderBy(`${q.alias}.id`, "DESC");
	} else if (sinceDate && untilDate) {
		q.andWhere(`${q.alias}.id > :since`, {
			since: genId(new Date(sinceDate)),
		});
		q.andWhere(`${q.alias}.id < :until`, {
			until: genId(new Date(untilDate)),
		});
		q.orderBy(`${q.alias}.id`, "DESC");
	} else if (sinceDate) {
		q.andWhere(`${q.alias}.id > :sinceDate`, {
			sinceDate: genId(new Date(sinceDate)),
		});
		q.orderBy(`${q.alias}.id`, "ASC");
	} else if (untilDate) {
		q.andWhere(`${q.alias}.id < :untilDate`, {
			untilDate: genId(new Date(untilDate)),
		});
		q.orderBy(`${q.alias}.id`, "DESC");
	} else {
		q.orderBy(`${q.alias}.id`, "DESC");
	}
	return q;
}
