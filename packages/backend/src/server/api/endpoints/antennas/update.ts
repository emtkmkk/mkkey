/**
 * @packageDocumentation
 *
 * アンテナを更新する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `antennas/update`（POST `/api/antennas/update` で呼び出し）
 * - 認証必須。antennaId で指定したアンテナの名前・キーワード・ユーザーリスト等を更新する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { Antennas, UserLists, UserGroupJoinings } from "@/models/index.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["antennas"],

	requireCredential: true,

	kind: "write:account",

	description:
		"既存のアンテナを更新する。名前・取得元・キーワード・除外キーワード・通知の有無などを変更できる。",

	errors: {
		noSuchAntenna: {
			message: "そのantennaは存在しません。",
			code: "NO_SUCH_ANTENNA",
			id: "10c673ac-8852-48eb-aa1f-f5b67f069290",
		},

		noSuchUserList: {
			message: "そのuser listは存在しません。",
			code: "NO_SUCH_USER_LIST",
			id: "1c6b35c9-943e-48c2-81e4-2844989407f7",
		},

		noSuchUserGroup: {
			message: "そのuser groupは存在しません。",
			code: "NO_SUCH_USER_GROUP",
			id: "109ed789-b6eb-456e-b8a9-6059d567d385",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Antenna",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		antennaId: {
			type: "string",
			format: "misskey:id",
			description: "更新するアンテナの ID。",
		},
		name: {
			type: "string",
			minLength: 1,
			maxLength: 100,
			description: "アンテナの名前。一覧で表示される。",
		},
		src: {
			type: "string",
			enum: ["home", "all", "users", "list", "group", "instances"],
			description:
				"取得元。home=ホームTL、all=全投稿、users=指定ユーザー、list=ユーザーリスト、group=グループ、instances=指定インスタンス。",
		},
		userListId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "src が list のとき、対象のユーザーリスト ID。",
		},
		userGroupId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "src が group のとき、対象のユーザーグループ ID。",
		},
		keywords: {
			type: "array",
			items: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"含めたいキーワード。各要素は AND、要素内は OR。例: [['A','B'],['C']] は (A または B) かつ C。",
		},
		excludeKeywords: {
			type: "array",
			items: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"除外するキーワード。含む投稿は表示しない。構造は keywords と同じ。",
		},
		users: {
			type: "array",
			items: {
				type: "string",
			},
			description: "src が users のとき、対象ユーザー ID の配列。",
		},
		instances: {
			type: "array",
			items: {
				type: "string",
			},
			description: "src が instances のとき、対象ホスト名の配列。",
		},
		caseSensitive: {
			type: "boolean",
			description: "キーワードを大文字小文字区別するか。",
		},
		withReplies: {
			type: "boolean",
			description: "返信を含めるか。",
		},
		withFile: {
			type: "boolean",
			description: "ファイル付き投稿に絞るか。",
		},
		notify: {
			type: "boolean",
			description: "マッチした投稿で通知するか。",
		},
	},
	required: [
		"antennaId",
		"name",
		"src",
		"keywords",
		"excludeKeywords",
		"users",
		"instances",
		"caseSensitive",
		"withReplies",
		"withFile",
		"notify",
	],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// アンテナを取得する
	const antenna = await Antennas.findOneBy({
		id: ps.antennaId,
		userId: user.id,
	});

	if (antenna == null) {
		throw new ApiError(meta.errors.noSuchAntenna);
	}

	let userList;
	let userGroupJoining;

	if (ps.src === "list" && ps.userListId) {
		userList = await UserLists.findOneBy({
			id: ps.userListId,
			userId: user.id,
		});

		if (userList == null) {
			throw new ApiError(meta.errors.noSuchUserList);
		}
	} else if (ps.src === "group" && ps.userGroupId) {
		userGroupJoining = await UserGroupJoinings.findOneBy({
			userGroupId: ps.userGroupId,
			userId: user.id,
		});

		if (userGroupJoining == null) {
			throw new ApiError(meta.errors.noSuchUserGroup);
		}
	}

	await Antennas.update(antenna.id, {
		name: ps.name,
		src: ps.src,
		userListId: userList ? userList.id : null,
		userGroupJoiningId: userGroupJoining ? userGroupJoining.id : null,
		keywords: ps.keywords,
		excludeKeywords: ps.excludeKeywords,
		users: ps.users,
		instances: ps.instances,
		caseSensitive: ps.caseSensitive,
		withReplies: ps.withReplies,
		withFile: ps.withFile,
		notify: ps.notify,
	});

	publishInternalEvent(
		"antennaUpdated",
		await Antennas.findOneByOrFail({ id: antenna.id }),
	);

	return await Antennas.pack(antenna.id);
});
