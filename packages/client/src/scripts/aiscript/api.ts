/**
 * @packageDocumentation
 *
 * AiScript ホスト API（Mk:* 等）を提供する。
 *
 * @public
 */
import { utils as defaultUtils, values as defaultValues } from "@syuilo/aiscript";
import type { AiscriptRuntime } from "./runtime";
import * as os from "@/os";
import { $i } from "@/account";

/** createAiScriptEnv のオプション */
export type CreateAiScriptEnvOpts = {
	storageKey: string;
	token?: string | null;
};

/**
 * AiScript インタプリタに注入する Mk:* 環境を構築する。
 *
 * @param opts - ストレージキー・API トークン
 * @param runtime - 動的ロードしたランタイム（省略時は @syuilo/aiscript 0.19.x）
 * @returns 定数マップ
 * @public
 */
export function createAiScriptEnv(
	opts: CreateAiScriptEnvOpts,
	runtime?: Pick<AiscriptRuntime, "utils" | "values">,
) {
	const utils = runtime?.utils ?? defaultUtils;
	const values = runtime?.values ?? defaultValues;
	let apiRequests = 0;
	return {
		USER_ID: $i ? values.STR($i.id) : values.NULL,
		USER_NAME: $i ? values.STR($i.name) : values.NULL,
		USER_USERNAME: $i ? values.STR($i.username) : values.NULL,
		"Mk:dialog": values.FN_NATIVE(async ([title, text, type]) => {
			await os.alert({
				type: type ? type.value : "info",
				title: title.value,
				text: text.value,
			});
		}),
		"Mk:confirm": values.FN_NATIVE(async ([title, text, type]) => {
			const confirm = await os.confirm({
				type: type ? type.value : "question",
				title: title.value,
				text: text.value,
			});
			return confirm.canceled ? values.FALSE : values.TRUE;
		}),
		"Mk:api": values.FN_NATIVE(async ([ep, param, token]) => {
			// GHSA-gmq6-738q-vjp2 対策: エンドポイント名に `://`（任意 URL 指定）や
			// `..`（ディレクトリトラバーサル）を含む値を渡すと、os.api が `/api` 配下
			// 以外（例: `/proxy/...` や外部 URL）へリクエストを送れてしまう。
			// 文字列であることを保証した上で、これらを含むエンドポイントを拒否する。
			utils.assertString(ep);
			if (ep.value.includes("://") || ep.value.includes("..")) {
				throw new Error("invalid endpoint");
			}
			if (token) {
				utils.assertString(token);
				// バグがあればundefinedもあり得るため念のため
				if (typeof token.value !== "string") throw new Error("invalid token");
			}
			apiRequests++;
			if (apiRequests > 16) return values.NULL;
			const res = await os.api(
				ep.value,
				utils.valToJs(param),
				token ? token.value : opts.token || null,
			);
			return utils.jsToVal(res);
		}),
		"Mk:save": values.FN_NATIVE(([key, value]) => {
			utils.assertString(key);
			localStorage.setItem(
				`aiscript:${opts.storageKey}:${key.value}`,
				JSON.stringify(utils.valToJs(value)),
			);
			return values.NULL;
		}),
		"Mk:load": values.FN_NATIVE(([key]) => {
			utils.assertString(key);
			return utils.jsToVal(
				JSON.parse(
					localStorage.getItem(`aiscript:${opts.storageKey}:${key.value}`),
				),
			);
		}),
		"Mk:url": values.FN_NATIVE(() => {
			return values.STR(window.location.href);
		}),
	};
}
