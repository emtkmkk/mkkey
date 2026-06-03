/**
 * @packageDocumentation
 *
 * VAPID 鍵ペアを生成する管理者 API。
 *
 * @internal
 */
import push from "web-push";
import define from "../../define.js";

export const meta = {
	tags: ["admin"],
	requireCredential: true,
	requireAdmin: true,
	description: "Web Push 用の VAPID 鍵ペアを新規生成する（管理画面から設定にコピーする用途）。",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
} as const;

export default define(meta, paramDef, async () => {
	const keys = push.generateVAPIDKeys();
	return {
		publicKey: keys.publicKey,
		privateKey: keys.privateKey,
	};
});
