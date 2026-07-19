/**
 * @packageDocumentation
 *
 * 特定企画（ゴルベーザ百天王バトル）向けの、リアクションボタン強制表示ギミック。
 *
 * @remarks
 * 対象ハッシュタグを含むノートには、実際のリアクション数が0でも
 * 🅰️/🅱️ の2択リアクションボタンを常に表示する。汎用処理（reaction-utils.ts や
 * MkReactionsViewer 系コンポーネント）へこの企画固有の知識を埋め込まないよう、
 * ここに集約する。
 *
 * @public
 */

import * as misskey from "calckey-js";

const HASHTAG = "#ゴルベーザ百天王バトル";

/**
 * ギミック対象の固定リアクションスロット（表示順もこの並びに従う）。
 *
 * @public
 */
export const GOLBEZA_TOURNAMENT_REACTION_SLOTS: readonly string[] = [
	"🅰️",
	"🅱️",
];

/**
 * ノートがギミック対象（対象ハッシュタグ付き）か判定する。
 *
 * @param note 対象ノート
 * @returns 対象なら true
 *
 * @public
 */
export function isGolbezaTournamentNote(
	note: misskey.entities.Note,
): boolean {
	return Boolean(note.tags) && Boolean(note.text?.includes(HASHTAG));
}

/**
 * ギミック対象ノートについて、リアクション件数マップに固定スロットが
 * 存在しない場合は 0 件として補う（破壊的に変更する）。
 *
 * @param note 対象ノート
 * @param reactions 変更対象のリアクション件数マップ
 *
 * @public
 */
export function ensureGolbezaTournamentReactionSlots(
	note: misskey.entities.Note,
	reactions: Record<string, number>,
): void {
	if (!isGolbezaTournamentNote(note)) return;

	for (const slot of GOLBEZA_TOURNAMENT_REACTION_SLOTS) {
		if (reactions[slot] == null) {
			reactions[slot] = 0;
		}
	}
}
