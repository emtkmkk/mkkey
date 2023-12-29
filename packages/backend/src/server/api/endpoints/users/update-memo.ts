import { Users, UserMemos } from "@/models/index.js";
import { ApiError } from "../../error.js";
import define from "../../define.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:account",

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '6fef56f3-e765-4957-88e5-c6f65329b8a5',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		customName: {
			type: 'string',
			nullable: true,
		},
		memo: {
			type: 'string',
			nullable: true,
			description: 'A personal memo for the target user. If null or empty, delete the memo.',
		},
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {

			// Get target
			const target = await Users.findOneBy({ id: ps.userId });
			if (target == null || !user.id) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			// 引数がnullか空文字であれば、パーソナルメモを削除する
			if (!ps.memo && !ps.customName) {
				await UserMemos.delete({
					userId: user.id,
					targetUserId: target.id,
				});
				return;
			}

			// 以前に作成されたパーソナルメモがあるかどうか確認
			const previousmemo = await UserMemos.findOneBy({
				userId: user.id,
				targetUserId: target.id,
			});

			if (!previousmemo) {
				await UserMemos.insert({
					id: genId(),
					userId: user.id,
					targetUserId: target.id,
					customName: ps.customName,
					memo: ps.memo,
				});
			} else {
				await UserMemos.update(previousmemo.id, {
					userId: user.id,
					targetUserId: target.id,
					customName: ps.customName,
					memo: ps.memo,
				});
			}
});
