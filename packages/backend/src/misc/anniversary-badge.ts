/**
 * @packageDocumentation
 *
 * 周年バッジ（もこきー熟練）の判定・表示内容を計算する純関数。
 *
 * @remarks
 * - `notesPostDays`（ログインして1投稿以上した日数、`User.notesPostDays` 由来の単調増加値）を基準に年数レベルを算出する。
 * - `users/stats` の都度集計とは独立。プロフィール表示（{@link models/repositories/user}）と
 *   投稿時の通知判定（{@link services/note/create}）の両方から参照される共通ロジック。
 *
 * @internal
 */

const ANNIVERSARY_DAYS_PER_YEAR = 365;

/** レベル（年数）に応じた数字絵文字。10以上は 🔟 のまま。 */
const ANNIVERSARY_NUMBER_EMOJIS = [
	"1️⃣",
	"2️⃣",
	"3️⃣",
	"4️⃣",
	"5️⃣",
	"6️⃣",
	"7️⃣",
	"8️⃣",
	"9️⃣",
	"🔟",
] as const;

export type AnniversaryBadge = {
	id: string;
	key: "anniversary";
	name: string;
	emoji: string;
	description: string;
	showBadgeNote: false;
};

/**
 * 投稿日数から周年バッジの年数レベルを求める。
 *
 * @param notesPostDays - `User.notesPostDays`（単調増加、365日で1年）
 * @returns 年数レベル（0 = 未達）
 * @public
 */
export function computeAnniversaryLevel(notesPostDays: number): number {
	return Math.floor(notesPostDays / ANNIVERSARY_DAYS_PER_YEAR);
}

/**
 * 年数レベルに対応する数字絵文字を返す（10以上は 🔟 で据え置き）。
 *
 * @param level - 年数レベル（1以上）
 * @public
 */
export function anniversaryLevelEmoji(level: number): string {
	const index = Math.min(Math.max(level, 1), ANNIVERSARY_NUMBER_EMOJIS.length) - 1;
	return ANNIVERSARY_NUMBER_EMOJIS[index];
}

/**
 * 周年バッジ本体（プロフィール表示・通知の両方に使う内容）を構築する。
 *
 * @param notesPostDays - `User.notesPostDays`
 * @returns 1年未満なら null
 * @public
 */
export function buildAnniversaryBadge(
	notesPostDays: number,
): AnniversaryBadge | null {
	const level = computeAnniversaryLevel(notesPostDays);
	if (level < 1) return null;

	const years = (notesPostDays / ANNIVERSARY_DAYS_PER_YEAR).toFixed(2);

	return {
		id: `3000000100${level}`,
		key: "anniversary",
		name: `もこきー熟練（${level}年）`,
		emoji: anniversaryLevelEmoji(level),
		description: `${level}年間もこきーで投稿を行った事を示すバッジ（現在${years}年）`,
		showBadgeNote: false,
	};
}
