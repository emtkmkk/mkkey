/**
 * @packageDocumentation
 *
 * ActivityPub の Create アクティビティの振り分け。オブジェクト種別に応じてノート作成等を実行する。
 *
 * @remarks
 * - **役割**: perform から呼ばれ、Create の object 種別に応じて createNote 等のハンドラに振り分ける。
 *
 * @see {@link remote/activitypub/kernel/create/note} Create(Note)
 * @internal
 */
import Resolver from "../../resolver.js";
import type {
	CacheableRemoteUser,
	ILocalUser,
} from "@/models/entities/user.js";
import createNote from "./note.js";
import type { ICreate } from "../../type.js";
import { getApId, isPost, getApType } from "../../type.js";
import { apLogger } from "../../logger.js";
import { toArray, concat, unique } from "@/prelude/array.js";

const logger = apLogger;

export default async (
	actor: CacheableRemoteUser,
	activity: ICreate,
	additionalTo?: ILocalUser["id"],
): Promise<void> => {
	const uri = getApId(activity);

	logger.info(`Create: ${uri}`);

	// activity と object の間でオーディエンスをコピーする
	if (typeof activity.object === "object") {
		const to = unique(
			concat([toArray(activity.to), toArray(activity.object.to)]),
		);
		const cc = unique(
			concat([toArray(activity.cc), toArray(activity.object.cc)]),
		);

		activity.to = to;
		activity.cc = cc;
		activity.object.to = to;
		activity.object.cc = cc;
	}

	// attributedTo が無い場合は Activity の actor を用いる
	if (typeof activity.object === "object" && !activity.object.attributedTo) {
		activity.object.attributedTo = activity.actor;
	}

	const resolver = new Resolver();

	const object = await resolver.resolve(activity.object).catch((e) => {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	});

	if (isPost(object)) {
		createNote(resolver, actor, object, false, activity, additionalTo);
	} else {
		logger.warn(`Unknown type: ${getApType(object)}`);
	}
};
