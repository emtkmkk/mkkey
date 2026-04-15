/**
 * @packageDocumentation
 *
 * ユーザー統計の「パワー」表示値およびランク文字列を、集計済みの数値から計算する純関数群。
 *
 * @remarks
 * - DB・キャッシュ・`Users` 更新は持たない（呼び出し側の責務）。
 * - 係数・境界配列は従来 `users/stats` 内蔵ロジックと同一の挙動を維持する。
 * - {@link computePowerRankFromWindow} の `powerRank` はリモート向けの `?` 接尾辞を付けない（API 層で付与）。
 *
 * @see `services/user-stats/fetch-aggregates` の集計結果を入力にする想定
 * @internal
 */

/** 表示用パワー計算に使うカウント一式（フォロー数確定後） */
export type UserPowerDisplayCounts = {
	notesPostDays: number;
	/** ローカル集計のノート数 */
	notesCount: number;
	/** パワー式のノート係数に使う値（リモートは `max(集計, user.notesCount)`） */
	notesCountForPower: number;
	repliesCount: number;
	renotesCount: number;
	quotesCount: number;
	repliedCount: number;
	renotedCount: number;
	pollVotesCount: number;
	pollVotedCount: number;
	pageLikesCount: number;
	pageLikedCount: number;
	sentReactionsCount: number;
	receivedReactionsCount: number;
	driveFilesCount: number;
	sendMessageCount: number;
	readMessageCount: number;
	followingCount: number;
	followersCount: number;
};

/** 直近ウィンドウ内の集計（ランク用 `rankPower`） */
export type UserPowerRankWindowCounts = {
	notesPostDays: number;
	notesCount: number;
	repliesCount: number;
	renotesCount: number;
	quotesCount: number;
	repliedCount: number;
	renotedCount: number;
	pollVotesCount: number;
	pollVotedCount: number;
	sentReactionsCount: number;
	receivedReactionsCount: number;
	driveFilesCount: number;
	sendMessageCount: number;
	readMessageCount: number;
};

export type ComputePowerRankInput = {
	rankWindow: UserPowerRankWindowCounts;
	/** `rankPower` 分母などに使う値（1..31 にクランプ済み） */
	elapsedDays: number;
	isBot: boolean;
};

export type PowerRankComputation = {
	/** 補正前の日次換算ランク指標 */
	rankPower: number;
	/** 日数・Bot 上限適用後（`maxRankPoint` 更新に使用する床付き値） */
	effectiveRankPowerFloored: number;
	powerRank: string;
	nextRank: string;
	rankPoint: number;
};

/**
 * 表示用パワー（従来 `users/stats` の `result.power` と同一式）を求める。
 *
 * @param counts - フォロワー数など確定済みのカウント
 * @returns 床関数後の整数パワー
 * @public
 */
export function computeDisplayPower(counts: UserPowerDisplayCounts): number {
	return Math.floor(
		(counts.notesPostDays * 482 +
			counts.notesCountForPower * 18 +
			counts.repliesCount * 7 +
			counts.renotesCount * -11 +
			counts.quotesCount * 7 +
			counts.repliedCount * 3 +
			counts.renotedCount * 3 +
			counts.pollVotesCount * 7 +
			counts.pollVotedCount * 3 +
			counts.pageLikesCount * 33 +
			counts.pageLikedCount * 27 +
			counts.sentReactionsCount * 7 +
			counts.receivedReactionsCount * 3 +
			counts.driveFilesCount * 6 +
			counts.sendMessageCount * 11 +
			counts.readMessageCount * 2) *
			(1 + counts.followingCount * 0.0005 + counts.followersCount * 0.0015),
	);
}

/**
 * OJ パワー（投稿・リアクションのパターン数からの単純加重）を求める。
 *
 * @param ojNotesCount - 「ですわ」等パターンに合致したノート数
 * @param ojSentReactionsCount - 同様パターンの送信リアクション数
 * @returns 加重和
 * @public
 */
export function computeOjPower(
	ojNotesCount: number,
	ojSentReactionsCount: number,
): number {
	return ojNotesCount * 3 + ojSentReactionsCount;
}

/**
 * ランク用 `rankPower`・表示ランク・次ランク進捗・内部ポイントをまとめて求める。
 *
 * @param input - ウィンドウ集計と経過日数（クランプ済み）・Bot フラグ
 * @returns ランク表示に必要な値
 * @public
 */
export function computePowerRankFromWindow(
	input: ComputePowerRankInput,
): PowerRankComputation {
	const { rankWindow: rankResult, elapsedDays, isBot } = input;

	const rpRate =
		1 -
		((elapsedDays < 14 ? (14 - elapsedDays) * (0.4 / 14) : 0) +
			Math.min(elapsedDays < 30 ? (30 - elapsedDays) * (0.1 / 16) : 0, 0.1) +
			(isBot ? 0.5 : 0));

	const dailyBonus = rankResult.notesPostDays * 482;

	const notePower =
		rankResult.notesCount * 18 +
		rankResult.renotesCount * -18 +
		rankResult.sendMessageCount * 11;

	const subNotePower =
		rankResult.repliesCount * 7 +
		rankResult.renotesCount * 7 +
		rankResult.quotesCount * 7 +
		rankResult.pollVotesCount * 7 +
		rankResult.sentReactionsCount * 7;

	const receivedSubNotePower =
		rankResult.repliedCount * 3 +
		rankResult.renotedCount * 3 +
		rankResult.pollVotedCount * 3 +
		rankResult.receivedReactionsCount * 3 +
		rankResult.readMessageCount * 2;

	const rankPower =
		Math.floor(
			((dailyBonus +
				(notePower +
					subNotePower +
					Math.min(notePower / 6 + subNotePower, receivedSubNotePower) +
					rankResult.driveFilesCount * 6) *
					rpRate) /
				elapsedDays) *
				100,
		) / 100;

	let effectiveRankPower = rankPower;

	// 経過日数によるランク制限 ※Botの場合はAAA+で停止
	if (elapsedDays < 14 || isBot) {
		effectiveRankPower = Math.min(rankPower, 4999); // AAA+
		if (elapsedDays < 1) effectiveRankPower = Math.min(rankPower, 1599); // A
		if (elapsedDays < 3) effectiveRankPower = Math.min(rankPower, 1999); // A+
		else if (elapsedDays < 6) effectiveRankPower = Math.min(rankPower, 2749); // AA
		else if (elapsedDays < 9) effectiveRankPower = Math.min(rankPower, 3499); // AA+
		else if (elapsedDays < 12) effectiveRankPower = Math.min(rankPower, 4249); // AAA
	}

	const rankBorder = [
		16, 50, 125, 200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2750,
		3500, 4250, 5000, 6000,
	];
	const rankName = [
		"G",
		"F-",
		"F",
		"F+",
		"E",
		"E+",
		"D",
		"D+",
		"C",
		"C+",
		"B",
		"B+",
		"A",
		"A+",
		"AA",
		"AA+",
		"AAA",
		"AAA+",
		"⭐",
		"⭐+",
	];
	const suffixIncBorder = rankBorder.slice(-1)[0] - rankBorder.slice(-2)[0];

	let powerRank: string;
	let nextRank: string;
	let rankPoint: number;

	// 最大ランク+2以上かどうか
	if (effectiveRankPower >= rankBorder.slice(-1)[0] + suffixIncBorder) {
		const plusNum = Math.floor(
			(effectiveRankPower - rankBorder.slice(-2)[0]) / suffixIncBorder,
		);
		powerRank =
			plusNum >= 1000
				? "⭐!!!"
				: plusNum >= 100
					? rankName.slice(-2)[0] + plusNum
					: plusNum >= 4
						? rankName.slice(-1)[0] + plusNum
						: rankName.slice(-1)[0] + "+".repeat(plusNum - 1);
		const nextRankNum =
			Math.floor(((rankPower % suffixIncBorder) / suffixIncBorder) * 1000) / 10;
		nextRank = `${nextRankNum.toFixed(1)}%`;
		rankPoint =
			rankBorder.length * 1000 + (plusNum - 1) * 1000 + nextRankNum * 10;
	} else {
		const clearBorder = rankBorder.filter((x) => x <= effectiveRankPower);
		powerRank = rankName[clearBorder.length];
		const clearBorderMax = clearBorder.slice(-1)[0] ?? 0;
		const nextRankNum =
			Math.floor(
				((rankPower - clearBorderMax) /
					((rankBorder[clearBorder.length] ??
						clearBorder.slice(-1)[0] + suffixIncBorder) -
						clearBorderMax)) *
					1000,
			) / 10;
		nextRank = `${nextRankNum.toFixed(1)}%`;
		rankPoint = clearBorder.length * 1000 + nextRankNum * 10;
	}

	return {
		rankPower,
		effectiveRankPowerFloored: Math.floor(effectiveRankPower),
		powerRank,
		nextRank,
		rankPoint,
	};
}
