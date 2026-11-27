/**
 * @packageDocumentation
 *
 * ユーザーを検索する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/search`（GET `/api/users/search` で呼び出し）
 * CHANGED: mkkey は認証必須のため `kind: read:account` を追加し、アプリトークンからの利用を許可する。
 * - ページ送りは `offset`（先頭から何件飛ばすか）で行う。`untilId` には対応しない。
 *   画面側の MkPagination では `offsetMode: true` を付けること（付けないと同じ結果を読み続ける）。
 * - 検索の種類は 3 つ。
 *   - 先頭が「誕生日」などのとき: 今日が誕生日のユーザー
 *   - 先頭が `@` のとき: ユーザー名の前方一致
 *   - それ以外: ①名前・ユーザー名の部分一致 → ②自己紹介・場所・プロフィール項目の部分一致、の順に並べる
 * - ②は①に当たらなかった人だけを対象にし、同じ人が 2 回出ないようにする。
 *   `offset` は①と②を続けて並べた全体での位置として数える（{@link searchByNameThenProfile}）。
 * - 返す件数は必ず `limit` 以下。画面は「limit 件より少なければ終わり」と判断するため。
 * - 並び順は最終更新の新しい順。同じ時刻のときは ID で決め、ページ間で順番が揺れないようにする。
 *   NB: 検索中に誰かの最終更新が変わると、ページの境目で重複や抜けが出ることはある（画面側で重複は除く）。
 * - NOTE: ①と②を 1 本の SQL にまとめると本番で 2.2 秒ほどかかった（2026-11-27 実測）。
 *   分けた方が速い（①0.17 秒、②0.63 秒）ので、2 段構えのままにしている。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets, type SelectQueryBuilder } from "typeorm";
import { UserProfiles, Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import define from "../../define.js";
import { sqlLikeEscape } from "@/misc/sql-like-escape.js";

export const meta = {
	tags: ["users"],

	requireCredential: true,
	kind: "read:account",
	requireCredentialPrivateMode: true,

	description:
		"クエリに基づいてユーザーを検索する。ユーザー名・表示名・@username などで検索可能。offset/limit でページネーション、origin でローカル/リモートを絞れる。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "User",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		query: {
			type: "string",
			description: "検索する文字列。ユーザー名や @username など。",
		},
		offset: {
			type: "integer",
			default: 0,
			description: "先頭からスキップする件数。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
		origin: {
			type: "string",
			enum: ["local", "remote", "combined"],
			default: "combined",
			description: "検索対象。local はローカルのみ、remote はリモートのみ、combined は両方。",
		},
		detail: {
			type: "boolean",
			default: true,
			description: "true のとき詳細情報を含めて返す。",
		},
	},
	required: ["query"],
} as const;

/**
 * 「誕生日のユーザー」検索に切り替える、検索語の先頭の言葉。
 *
 * @internal
 */
const BIRTHDAY_WORDS = ["誕生日", "たんじょうび", "birthday"];

/**
 * 検索の対象にする、最近動きのあったユーザーの期間（ミリ秒）。
 *
 * @internal
 */
const ACTIVE_PERIOD_MS = 1000 * 60 * 60 * 24 * 30; // 30 日

export default define(meta, paramDef, async (ps, me) => {
	const activeThreshold = new Date(Date.now() - ACTIVE_PERIOD_MS);

	// 空白と + を区切りとみなし、先頭の言葉だけで検索する
	const word = ps.query.replaceAll(/\s/g, "+").split("+")[0] ?? "";

	let users: User[];

	if (BIRTHDAY_WORDS.includes(word.toLowerCase())) {
		users = await searchBirthday(ps, activeThreshold);
	} else if (ps.query.startsWith("@")) {
		const query = baseUserQuery(activeThreshold, ps.origin).andWhere(
			"user.usernameLower LIKE :username",
			{ username: `${sqlLikeEscape(word.replace("@", "").toLowerCase())}%` },
		);
		users = await orderAndPage(query).take(ps.limit).skip(ps.offset).getMany();
	} else {
		users = await searchByNameThenProfile(ps, word, activeThreshold);
	}

	return await Users.packMany(users, me, { detail: ps.detail });
});

// #region 検索の種類ごとの処理

/**
 * 今日が誕生日のユーザーを探す。
 *
 * @param ps - API のパラメータ（offset / limit / origin を使う）
 * @param activeThreshold - これより前から更新の無いユーザーは除く
 * @returns 見つかったユーザー
 *
 * @remarks
 * - CHANGED: 以前は存在しない `user.birthday` を見ていて SQL エラーになり、
 *   月も `getMonth()`（0 始まり）のままで 1 か月ずれていた。
 * - 日付はサーバーの時刻（JST）で決める。
 *
 * @internal
 */
async function searchBirthday(
	ps: { offset: number; limit: number; origin: string },
	activeThreshold: Date,
): Promise<User[]> {
	const now = new Date();
	const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(
		now.getDate(),
	).padStart(2, "0")}`;

	const profQuery = UserProfiles.createQueryBuilder("prof")
		.select("prof.userId")
		// 誕生日は YYYY-MM-DD の形なので、後ろの MM-DD で比べる
		.where("prof.birthday LIKE :birthday", { birthday: `%-${monthDay}` });

	const query = baseUserQuery(activeThreshold, ps.origin)
		.andWhere(`user.id IN (${profQuery.getQuery()})`)
		.setParameters(profQuery.getParameters());

	return await orderAndPage(query).take(ps.limit).skip(ps.offset).getMany();
}

/**
 * ①名前・ユーザー名 → ②自己紹介など、の順に並べて検索する。
 *
 * @param ps - API のパラメータ（offset / limit / origin を使う）
 * @param word - 検索語（先頭の言葉）
 * @param activeThreshold - これより前から更新の無いユーザーは除く
 * @returns 見つかったユーザー（`limit` 件以下）
 *
 * @remarks
 * - ①の結果だけで `limit` 件そろえば、②は検索しない（②は重いため）。
 * - ②は①に当たらない人だけ。①と②を続けて並べた全体で `offset` 件目から返す。
 * - ①が 1 件も取れなかったときは、①の全件数を数えて②の開始位置を決める。
 *   ①が 1 件以上取れて足りなかったときは、①の全件数は `offset + 取れた件数` と分かる。
 *
 * @internal
 */
async function searchByNameThenProfile(
	ps: { offset: number; limit: number; origin: string },
	word: string,
	activeThreshold: Date,
): Promise<User[]> {
	const likeWord = `%${sqlLikeEscape(word)}%`;
	// ユーザー名として使える文字だけのときは、ユーザー名でも探す
	const matchUsername = Users.validateLocalUsername(word);

	/** ①に当たる条件（②で「①に当たらない」を表すのにも使う） */
	const nameCondition = new Brackets((qb) => {
		qb.where("user.name ILIKE :likeWord");
		if (matchUsername) qb.orWhere("user.usernameLower LIKE :likeUsername");
	});
	const nameParams = {
		likeWord,
		likeUsername: `%${sqlLikeEscape(word.toLowerCase())}%`,
	};

	const nameQuery = baseUserQuery(activeThreshold, ps.origin)
		.andWhere(nameCondition)
		.setParameters(nameParams);

	const byName = await orderAndPage(nameQuery.clone())
		.take(ps.limit)
		.skip(ps.offset)
		.getMany();
	if (byName.length >= ps.limit) return byName;

	// ②を何件目から取るか（①と②を続けて並べた全体での offset から、①の分を引く）
	const nameTotal =
		byName.length > 0 ? ps.offset + byName.length : await nameQuery.getCount();
	const profileOffset = Math.max(0, ps.offset - nameTotal);

	const profQuery = UserProfiles.createQueryBuilder("prof")
		.select("prof.userId")
		.where(
			new Brackets((qb) => {
				qb.where("prof.description ILIKE :likeWord");
				qb.orWhere("prof.location LIKE :likeWord");
				qb.orWhere("(prof.fields->>'name') LIKE :likeWord");
				qb.orWhere("(prof.fields->>'value') LIKE :likeWord");
			}),
		);
	if (ps.origin === "local") {
		profQuery.andWhere("prof.userHost IS NULL");
	} else if (ps.origin === "remote") {
		profQuery.andWhere("prof.userHost IS NOT NULL");
	}

	const profileQuery = baseUserQuery(activeThreshold, ps.origin)
		.andWhere(`user.id IN (${profQuery.getQuery()})`)
		// ①で出した人を②でもう一度出さない
		.andWhere(
			new Brackets((qb) => {
				qb.where("NOT (user.name ILIKE :likeWord)").orWhere("user.name IS NULL");
			}),
		)
		.setParameters(nameParams);
	if (matchUsername) {
		profileQuery.andWhere("user.usernameLower NOT LIKE :likeUsername");
	}

	const byProfile = await orderAndPage(profileQuery)
		.take(ps.limit - byName.length)
		.skip(profileOffset)
		.getMany();

	return byName.concat(byProfile);
}

// #endregion

// #region 共通の条件

/**
 * 検索の土台になるクエリ（アバター・バナー付き、最近動きのある、凍結も削除もされていないユーザー）を作る。
 *
 * @param activeThreshold - これより前から更新の無いユーザーは除く
 * @param origin - local / remote / combined
 * @returns `user` を別名にしたクエリ
 *
 * @internal
 */
function baseUserQuery(
	activeThreshold: Date,
	origin: string,
): SelectQueryBuilder<User> {
	const query = Users.createQueryBuilder("user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner")
		.where(
			new Brackets((qb) => {
				qb.where("user.updatedAt IS NULL").orWhere(
					"user.updatedAt > :activeThreshold",
					{ activeThreshold },
				);
			}),
		)
		.andWhere("user.isSuspended = FALSE")
		// 削除済みは名前が「🗑」になるだけで行が残っているので、検索に出さない
		.andWhere("user.isDeleted = FALSE");

	if (origin === "local") {
		query.andWhere("user.host IS NULL");
	} else if (origin === "remote") {
		query.andWhere("user.host IS NOT NULL");
	}

	return query;
}

/**
 * 検索結果の並び順を付ける（最終更新の新しい順、同じなら ID の新しい順）。
 *
 * @param query - 並べるクエリ
 * @returns 並び順を付けたクエリ（同じものを返す）
 *
 * @remarks
 * ID を最後に足すのは、offset でページを送るときに順番が揺れないようにするため。
 *
 * @internal
 */
function orderAndPage(query: SelectQueryBuilder<User>): SelectQueryBuilder<User> {
	return query
		.orderBy("user.updatedAt", "DESC", "NULLS LAST")
		.addOrderBy("user.id", "DESC");
}

// #endregion
