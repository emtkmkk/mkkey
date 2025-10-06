import { Brackets } from "typeorm";
import define from "../../define.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";

/*
トレンドに載るためには「『直近a分間のユニーク投稿数が今からa分前～今からb分前の間のユニーク投稿数のn倍以上』のハッシュタグの上位5位以内に入る」ことが必要
ユニーク投稿数とはそのハッシュタグと投稿ユーザーのペアのカウントで、例えば同じユーザーが複数回同じハッシュタグを投稿してもそのハッシュタグのユニーク投稿数は1とカウントされる

..が理想だけどPostgreSQLでどうするのか分からないので単に「直近Aの内に投稿されたユニーク投稿数が多いハッシュタグ」で妥協する
*/

const rangeA = 1000 * 60 * 60; // 60分
//const rangeB = 1000 * 60 * 120; // 2時間
//const coefficient = 1.25; // 「n倍」の部分
//const requiredUsers = 3; // 最低何人がそのタグを投稿している必要があるか

const max = 5;

export const meta = {
	tags: ["hashtags"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			properties: {
				tag: {
					type: "string",
					optional: false,
					nullable: false,
				},
				chart: {
					type: "array",
					optional: false,
					nullable: false,
					items: {
						type: "number",
						optional: false,
						nullable: false,
					},
				},
				usersCount: {
					type: "number",
					optional: false,
					nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const instance = await fetchMeta(true);
	const hiddenTags = instance.hiddenTags.map((t) => normalizeForSearch(t));

	const now = new Date(); // 5分単位で丸めた現在日時
	now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);

	const tagNotes = await Notes.createQueryBuilder("note")
		.where("note.createdAt > :date", { date: new Date(now.getTime() - rangeA) })
		.andWhere(
			new Brackets((qb) => {
				qb.where(`note.visibility = 'public'`).orWhere(
					`note.visibility = 'home'`,
				);
			}),
		)
		.andWhere(`note.tags != '{}'`)
		.select(["note.tags", "note.userId"])
		.cache(60000) // 1 min
		.getMany();

	if (tagNotes.length === 0) {
		return [];
	}

	const tags: {
		name: string;
		users: Note["userId"][];
	}[] = [];

	for (const note of tagNotes) {
		for (const tag of note.tags) {
			if (hiddenTags.includes(tag)) continue;

			const x = tags.find((x) => x.name === tag);
			if (x) {
				if (!x.users.includes(note.userId)) {
					x.users.push(note.userId);
				}
			} else {
				tags.push({
					name: tag,
					users: [note.userId],
				});
			}
		}
	}

	// タグを人気順に並べ替え
        const hots = tags
                .sort((a, b) => b.users.length - a.users.length)
                .map((tag) => tag.name)
                .slice(0, max);

        if (hots.length === 0) {
                return [];
        }

        //#region 2(または3)で話題と判定されたタグそれぞれについて過去の投稿数グラフを取得する
        const range = 20;

        // 10分
        const interval = 1000 * 60 * 10;
        const bucketStart = new Date(now.getTime() - interval * range);
        const bucketSeconds = interval / 1000;
        const bucketStartSec = Math.floor(bucketStart.getTime() / 1000);

        const tagIndexMap = new Map(hots.map((tag, index) => [tag, index] as const));

        const bucketizedNotesQb = Notes.createQueryBuilder("note")
                .select("note.\"userId\"", "userId")
                .addSelect("unnest(note.tags)", "tag")
                .addSelect(
                        `FLOOR((EXTRACT(EPOCH FROM note."createdAt") - :bucketStartSec) / ${bucketSeconds})`,
                        "bucket",
                )
                .where("note.createdAt > :bucketStart", { bucketStart })
                .andWhere("note.createdAt < :bucketEnd", { bucketEnd: now })
                .andWhere(
                        new Brackets((qb) => {
                                qb.where(`note.visibility = 'public'`).orWhere(
                                        `note.visibility = 'home'`,
                                );
                        }),
                )
                .andWhere(`note.tags != '{}'`)
                .setParameter("bucketStartSec", bucketStartSec);

        const bucketCountsRaw = await Notes.createQueryBuilder()
                .select("tag", "tag")
                .addSelect("bucket", "bucket")
                .addSelect("COUNT(DISTINCT userId)", "count")
                .from(`(${bucketizedNotesQb.getQuery()})`, "tagged_notes")
                .where("tag = ANY(:hots)", { hots })
                .groupBy("tag")
                .addGroupBy("bucket")
                .setParameters(bucketizedNotesQb.getParameters())
                .cache(60000) // 1 min
                .getRawMany();

        // インデックス検討: note(tags) のGINインデックスや createdAt との複合で更に高速化の余地あり

        const countsLog = Array.from({ length: range }, () => hots.map(() => 0));
        for (const row of bucketCountsRaw) {
                const tagIndex = tagIndexMap.get(row.tag);
                if (tagIndex === undefined) continue;

                const bucketIndex = Number.parseInt(row.bucket, 10);
                if (!Number.isFinite(bucketIndex) || bucketIndex < 0 || bucketIndex >= range) continue;

                const targetIndex = range - 1 - bucketIndex;
                countsLog[targetIndex][tagIndex] = Number.parseInt(row.count, 10);
        }
        //#endregion

        const totalsSubQuery = Notes.createQueryBuilder("note")
                .select("note.\"userId\"", "userId")
                .addSelect("unnest(note.tags)", "tag")
                .where("note.createdAt > :totalStart", {
                        totalStart: new Date(now.getTime() - rangeA),
                })
                .andWhere("note.createdAt < :totalEnd", { totalEnd: now })
                .andWhere(
                        new Brackets((qb) => {
                                qb.where(`note.visibility = 'public'`).orWhere(
                                        `note.visibility = 'home'`,
                                );
                        }),
                )
                .andWhere(`note.tags != '{}'`);

        const totalCountsRaw = await Notes.createQueryBuilder()
                .select("tag", "tag")
                .addSelect("COUNT(DISTINCT userId)", "count")
                .from(`(${totalsSubQuery.getQuery()})`, "recent_tagged")
                .where("tag = ANY(:hots)", { hots })
                .groupBy("tag")
                .setParameters(totalsSubQuery.getParameters())
                .cache(60000 * 60) // 60 min
                .getRawMany();

        const totalCountsMap = new Map(totalCountsRaw.map((row) => [row.tag, Number.parseInt(row.count, 10)]));
        const totalCounts = hots.map((tag) => totalCountsMap.get(tag) ?? 0);

	const stats = hots.map((tag, i) => ({
		tag,
		chart: countsLog.map((counts) => counts[i]),
		usersCount: totalCounts[i],
	}));

	return stats;
});
