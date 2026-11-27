/**
 * @packageDocumentation
 *
 * フォロー申請（承認待ち）のリポジトリと、API 応答への変換（pack）。
 *
 * @remarks
 * - 申請一覧の画面で「許可するか」を判断できるよう、申請日時と、必要なら申請者の詳細を返す。
 *
 * @see {@link server/api/endpoints/following/requests/list} 受けた申請の一覧 API
 * @internal
 */
import { db } from "@/db/postgre.js";
import { FollowRequest } from "@/models/entities/follow-request.js";
import { Users } from "../index.js";
import type { User } from "@/models/entities/user.js";

/**
 * フォロー申請のリポジトリ。
 *
 * @internal
 */
export const FollowRequestRepository = db.getRepository(FollowRequest).extend({
	/**
	 * フォロー申請を API 応答の形にする。
	 *
	 * @param src - 申請の ID か、申請の行
	 * @param me - 見ている人（フォロー関係を付けるため）
	 * @typeParam D - 申請者を詳細版で返すか（`opts.detailFollower` の型）
	 * @param opts - `detailFollower` が true なら申請者を詳細版（自己紹介・登録日・フォロー数など）で返す
	 * @returns 申請の ID・申請日時・申請者・申請先
	 *
	 * @remarks
	 * - 詳細版は重いので、申請一覧のように件数を絞った場面だけで使う。
	 * - 申請先（followee）は見ている本人なので、常に簡易版で返す。
	 *
	 * @internal
	 */
	async pack<D extends boolean = false>(
		src: FollowRequest["id"] | FollowRequest,
		me?: { id: User["id"] } | null | undefined,
		opts?: { detailFollower?: D },
	) {
		const request =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return {
			id: request.id,
			createdAt: request.createdAt.toISOString(),
			// detailFollower の型（D）をそのまま渡し、戻り値の型を詳細版・簡易版で切り替える
			follower: await Users.pack<null, D>(request.followerId, me, {
				detail: opts?.detailFollower,
			}),
			followee: await Users.pack(request.followeeId, me),
		};
	},
});
