import { v4 as uuid } from "uuid";
import config from "@/config/index.js";
import { getUserKeypair } from "@/misc/keypair-store.js";
import type { User } from "@/models/entities/user.js";
import { LdSignature } from "../misc/ld-signature.js";
import type { IActivity } from "../type.js";
import { WellKnownContext } from "@/remote/activitypub/misc/contexts.js";

/**
 * AP オブジェクトに `@context` を付けてアクティビティとして配信できる形にする
 *
 * @remarks
 * - `id` が無ければ `${config.url}/<uuid>` を補う（引数のオブジェクトを書き換える）。
 * - `null` / `undefined` を渡すとそのまま `null` を返す。
 * - オーバーロードで「オブジェクトを渡せば必ず IActivity」「null を渡せば null」と型を絞っている。
 *
 * @param x - 包むオブジェクト
 * @returns `@context` 付きのアクティビティ。入力が null なら null
 * @public
 */
export function renderActivity(x: object): IActivity;
export function renderActivity(x: null | undefined): null;
export function renderActivity(x: any): IActivity | null;
export function renderActivity(x: any): IActivity | null {
	if (x == null) return null;

	if (typeof x === "object" && x.id == null) {
		x.id = `${config.url}/${uuid()}`;
	}

	return Object.assign({}, WellKnownContext, x);
}

export const attachLdSignature = async (
	activity: any,
	user: { id: User["id"]; host: null },
): Promise<IActivity | null> => {
	if (activity == null) return null;

	const keypair = await getUserKeypair(user.id);

	const ldSignature = new LdSignature();
	ldSignature.debug = false;
	activity = await ldSignature.signRsaSignature2017(
		activity,
		keypair.privateKey,
		`${config.url}/users/${user.id}#main-key`,
	);

	return activity;
};
