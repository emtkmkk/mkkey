/**
 * @packageDocumentation
 *
 * 互換用 API エンドポイント一覧。旧パス（v1/instance 等）で同じ処理を提供する。
 *
 * @remarks
 * - **役割**: Mastodon 等との互換のため、別パスで同じエンドポイントを提供。call で compatibility として参照される。
 * - 例: v1/instance → instance-info、v1/custom_emojis → custom-emojis。
 *
 * @see {@link call} 互換ルート解決
 * @see {@link endpoints} メインエンドポイント一覧
 * @internal
 */
import type { IEndpoint } from "./endpoints";

import * as cp___instanceInfo from "./endpoints/compatibility/instance-info.js";
import * as cp___customEmojis from "./endpoints/compatibility/custom-emojis.js";

const cps = [
	["v1/instance", cp___instanceInfo],
	["v1/custom_emojis", cp___customEmojis],
];

const compatibility: IEndpoint[] = cps.map(([name, cp]) => {
	return {
		name: name,
		exec: cp.default,
		meta: cp.meta || {},
		params: cp.paramDef,
	} as IEndpoint;
});

export default compatibility;
