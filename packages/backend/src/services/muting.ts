/**
 * @packageDocumentation
 *
 * 範囲付きユーザーミュートを作成・更新・部分解除するサービス。
 *
 * @remarks
 * すべてのAPIがこのサービスを経由することで、ビット演算、有効期限、最終範囲削除の
 * 挙動を統一する。
 *
 * @internal
 */

import { genId } from "@/misc/gen-id.js";
import {
	decodeMuteScope,
	encodeMuteTypes,
	MUTE_SCOPE_BITS,
	type MuteType,
} from "@/misc/mute-scope.js";
import type { Muting } from "@/models/entities/muting.js";
import type { User } from "@/models/entities/user.js";
import { Mutings } from "@/models/index.js";

/** 範囲更新後のミュート状態。 */
export type MutingUpdateResult = {
	muting: Muting | null;
	muteTypes: MuteType[];
};

/**
 * 利用者ペアの現在のミュートを取得する。
 *
 * @param muterId - ミュートする利用者ID
 * @param muteeId - ミュートされる利用者ID
 * @returns 現在のミュート。未設定ならnull
 * @internal
 */
async function findMuting(
	muterId: User["id"],
	muteeId: User["id"],
): Promise<Muting | null> {
	return await Mutings.findOneBy({ muterId, muteeId });
}

/**
 * 選択範囲と共通期限を完全に置き換える。
 *
 * @param muterId - ミュートする利用者ID
 * @param muteeId - ミュートされる利用者ID
 * @param types - 新しい範囲。空なら関係を削除
 * @param expiresAt - 全範囲で共有する解除日時
 * @returns 更新後の状態
 * @public
 */
export async function replaceMutingScopes(
	muterId: User["id"],
	muteeId: User["id"],
	types: readonly MuteType[],
	expiresAt: Date | null,
): Promise<MutingUpdateResult> {
	const scope = encodeMuteTypes(types);
	const existing = await findMuting(muterId, muteeId);

	if (scope === 0) {
		if (existing != null) {
			await Mutings.delete(existing.id);
		}
		return { muting: null, muteTypes: [] };
	}

	if (existing == null) {
		const muting = Mutings.create({
			id: genId(),
			createdAt: new Date(),
			expiresAt,
			muterId,
			muteeId,
			scope,
		});
		await Mutings.insert(muting);
		return { muting, muteTypes: decodeMuteScope(scope) };
	}

	existing.scope = scope;
	existing.expiresAt = expiresAt;
	await Mutings.update(existing.id, { scope, expiresAt });
	return { muting: existing, muteTypes: decodeMuteScope(scope) };
}

/**
 * 既存関係へ個別範囲を追加する。
 *
 * @param muterId - ミュートする利用者ID
 * @param muteeId - ミュートされる利用者ID
 * @param type - 追加する範囲
 * @param expiresAt - 追加範囲の期限。nullなら統合後も無期限
 * @returns 更新後の状態
 *
 * @remarks
 * 既存関係が無期限、または追加範囲が無期限なら、共有期限は無期限を維持する。
 *
 * @public
 */
export async function addMutingScope(
	muterId: User["id"],
	muteeId: User["id"],
	type: MuteType,
	expiresAt: Date | null,
): Promise<MutingUpdateResult> {
	const id = genId();
	const bit = MUTE_SCOPE_BITS[type];
	const rows = (await Mutings.query(
		`
			INSERT INTO "muting"
				("id", "createdAt", "expiresAt", "muterId", "muteeId", "scope")
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT ("muterId", "muteeId") DO UPDATE
			SET
				"scope" = CASE
					WHEN $7 THEN $8
					ELSE "muting"."scope" | EXCLUDED."scope"
				END,
				"expiresAt" = CASE
					WHEN "muting"."expiresAt" IS NULL OR EXCLUDED."expiresAt" IS NULL
						THEN NULL
					ELSE GREATEST("muting"."expiresAt", EXCLUDED."expiresAt")
				END
			RETURNING "id"
		`,
		[
			id,
			new Date(),
			expiresAt,
			muterId,
			muteeId,
			bit,
			type === "all",
			MUTE_SCOPE_BITS.all,
		],
	)) as Array<{ id: string }>;
	const muting = await Mutings.findOneByOrFail({ id: rows[0]?.id ?? id });
	return { muting, muteTypes: decodeMuteScope(muting.scope) };
}

/**
 * 既存関係から個別範囲だけを解除する。
 *
 * @param muterId - ミュートする利用者ID
 * @param muteeId - ミュートされる利用者ID
 * @param type - 解除する個別範囲
 * @returns 更新後の状態
 *
 * @remarks
 * `all` は個別範囲を内包するため、旧個別APIからの解除では変更しない。
 *
 * @public
 */
export async function removeMutingScope(
	muterId: User["id"],
	muteeId: User["id"],
	type: Exclude<MuteType, "all">,
): Promise<MutingUpdateResult> {
	const existing = await findMuting(muterId, muteeId);
	if (existing == null) {
		return { muting: null, muteTypes: [] };
	}

	if ((existing.scope & MUTE_SCOPE_BITS.all) !== 0) {
		return { muting: existing, muteTypes: ["all"] };
	}

	const scope = existing.scope & ~MUTE_SCOPE_BITS[type];
	if (scope === 0) {
		await Mutings.delete(existing.id);
		return { muting: null, muteTypes: [] };
	}

	existing.scope = scope;
	await Mutings.update(existing.id, { scope });
	return { muting: existing, muteTypes: decodeMuteScope(scope) };
}

/**
 * 利用者ペアの全ミュート範囲を解除する。
 *
 * @param muterId - ミュートする利用者ID
 * @param muteeId - ミュートされる利用者ID
 * @returns 関係を削除できた場合true
 * @public
 */
export async function deleteAllMutingScopes(
	muterId: User["id"],
	muteeId: User["id"],
): Promise<boolean> {
	const result = await Mutings.delete({ muterId, muteeId });
	return (result.affected ?? 0) > 0;
}
