/**
 * @packageDocumentation
 *
 * リアクション集計値を副作用なしで補正する共通関数。
 *
 * @internal
 */

/**
 * 公開集計値から非表示利用者分を差し引き、0以下の項目を取り除く。
 *
 * @param reactions - ノートに保存された公開集計値
 * @param hiddenDeltas - 非表示利用者の個別リアクション集計値
 * @returns 入力を変更せずに補正した集計値
 * @public
 */
export function subtractHiddenReactionDeltas(
	reactions: Readonly<Record<string, number>>,
	hiddenDeltas?: Readonly<Record<string, number>>,
): Record<string, number> {
	const visible = { ...reactions };
	if (hiddenDeltas != null) {
		for (const [reaction, hiddenCount] of Object.entries(hiddenDeltas)) {
			visible[reaction] = (visible[reaction] ?? 0) - hiddenCount;
		}
	}

	return Object.fromEntries(
		Object.entries(visible).filter(([, count]) => count > 0),
	);
}

/**
 * リアクション更新イベントを閲覧者の接続へ流さないか判定する。
 *
 * @param enabled - 閲覧者別除外設定が有効か
 * @param actorId - リアクション操作を行った利用者ID
 * @param hiddenUserSets - reactionミュート・双方向ブロックの利用者集合
 * @returns イベントを破棄する場合true
 * @public
 */
export function shouldFilterReactionStream(
	enabled: boolean,
	actorId: string | null | undefined,
	hiddenUserSets: readonly ReadonlySet<string>[],
): boolean {
	return (
		enabled &&
		actorId != null &&
		hiddenUserSets.some((hiddenUsers) => hiddenUsers.has(actorId))
	);
}
