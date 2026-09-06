/**
 * @packageDocumentation
 *
 * Service Worker からプッシュ登録のオプトアウト意図を読む。
 *
 * @remarks
 * - クライアント側の実体は localStorage だが、SW からは読めないため
 *   `client/src/scripts/push-opt-out.ts` が IDB にミラーしている。
 * - IDB が使えない環境では false（＝オプトアウトしていない）を返す。
 *   その環境ではアカウント情報自体も IDB から読めず再登録は走らない。
 *
 * @internal
 */
import { get } from "idb-keyval";

/** クライアントがミラーする IDB キー。両パッケージで一致させること */
export const PUSH_OPT_OUT_IDB_KEY = "pushOptOutUserIds";

/**
 * そのアカウントがサーバーへのプッシュ登録を明示的に切っているか。
 *
 * @param userId - ローカルユーザー ID
 * @internal
 */
export async function isPushServerOptOutInSw(userId: string): Promise<boolean> {
	try {
		const ids = await get(PUSH_OPT_OUT_IDB_KEY);
		return Array.isArray(ids) && ids.includes(userId);
	} catch {
		return false;
	}
}
