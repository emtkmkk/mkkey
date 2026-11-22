/**
 * @packageDocumentation
 *
 * 管理画面の「ユーザーを照会」で、入力値からユーザー情報ページを開く
 *
 * @remarks
 * 入力がユーザー名かユーザー ID か区別できないため、両方で同時に問い合わせ、見つかった方を開く。
 * NOTE: この作りでは片方は必ず NO_SUCH_USER になるため、その場合はトーストを出さない。
 * 両方とも見つからなかったときだけ、ダイアログで「ユーザーが見つかりません」と知らせる。
 *
 * @internal
 */
import * as Acct from "calckey-js/built/acct";
import { i18n } from "@/i18n";
import * as os from "@/os";

/**
 * 照会の片方が外れるのは想定どおりなので、トーストを出さないエラーコード
 *
 * @internal
 */
const EXPECTED_ERRORS = ["NO_SUCH_USER"] as const;

/**
 * 入力ダイアログを出し、ユーザー名または ID でユーザーを探して情報ページを開く
 *
 * @returns 処理の完了（ページを開くまでは待たない）
 * @internal
 */
export async function lookupUser() {
	const { canceled, result } = await os.inputText({
		title: i18n.ts.usernameOrUserId,
	});
	if (canceled) return;

	const show = (user) => {
		os.pageWindow(`/user-info/${user.id}`);
	};

	const usernamePromise = os.api(
		"users/show",
		Acct.parse(result),
		undefined,
		EXPECTED_ERRORS,
	);
	const idPromise = os.api(
		"users/show",
		{ userId: result },
		undefined,
		EXPECTED_ERRORS,
	);
	// 2 回目の「見つからない」で初めて知らせる（両方外れたときだけ）
	let _notFound = false;
	const notFound = () => {
		if (_notFound) {
			os.alert({
				type: "error",
				text: i18n.ts.noSuchUser,
			});
		} else {
			_notFound = true;
		}
	};
	usernamePromise.then(show).catch((err) => {
		if (err.code === "NO_SUCH_USER") {
			notFound();
		}
	});
	idPromise.then(show).catch((err) => {
		notFound();
	});
}
