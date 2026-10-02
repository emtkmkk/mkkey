/**
 * @packageDocumentation
 *
 * フォローの API を呼び、Bluesky ユーザーへの初めてのフォローなら同意の確認を出してから送り直す。
 *
 * @remarks
 * - サーバーは、Bluesky 上の身元（DID）がまだ無い人の Bluesky ユーザーへのフォローを `BLUESKY_BRIDGE_CONSENT_REQUIRED` で断る。
 *   そのときだけ、OK を 7 秒押せない確認ダイアログを出し、同意（`agreeBlueskyBridge: true`）を付けて送り直す。
 *   「初めてか」をサーバーが判定するので、画面は身元の有無を知らなくてよい。
 * - 1 日の上限（`BLUESKY_FOLLOW_RATE_LIMITED`）と公開前（`BLUESKY_BRIDGE_NOT_AVAILABLE`）は、理由をダイアログで伝える。
 * - それ以外のエラーは、そのまま呼び出し側に投げる（これまでのフォローボタンの扱いを変えないため）。
 *
 * @internal
 */
import * as os from "@/os";
import { i18n } from "@/i18n";

/** 確認ダイアログの OK を押せるようになるまでの秒数（警告付きユーザーのフォロー確認と同じ） */
const CONSENT_WAIT_SECONDS = 7;

/**
 * ユーザーをフォローする。Bluesky ユーザーへの初めてのフォローなら、同意の確認を出してから送り直す。
 *
 * @param userId - フォローするユーザー
 * @returns `following/create` の結果。確認でキャンセルされた・理由をダイアログで伝えたときは null
 * @throws Bluesky ブリッジ以外の理由で API が失敗したとき
 * @internal
 */
export async function followWithBlueskyConsent(userId: string) {
	try {
		return await os.api("following/create", { userId });
	} catch (err) {
		const code = (err as { code?: string } | null)?.code;

		if (code === "BLUESKY_BRIDGE_CONSENT_REQUIRED") {
			const { canceled } = await os.confirm({
				type: "warning",
				text: i18n.ts.blueskyBridgeFirstFollowConfirm,
				wait: CONSENT_WAIT_SECONDS,
			});
			if (canceled) return null;
			return await os.api("following/create", { userId, agreeBlueskyBridge: true });
		}
		if (code === "BLUESKY_FOLLOW_RATE_LIMITED") {
			await os.alert({ type: "error", text: i18n.ts.blueskyFollowRateLimited });
			return null;
		}
		if (code === "BLUESKY_BRIDGE_NOT_AVAILABLE") {
			await os.alert({ type: "error", text: i18n.ts.blueskyBridgeNotAvailable });
			return null;
		}
		throw err;
	}
}
