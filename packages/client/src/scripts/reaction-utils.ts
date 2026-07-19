/**
 * @packageDocumentation
 *
 * ノートのリアクション表示向けに、リモート一括ミュート・ソフト絵文字ミュート（ワード）を考慮した
 * 可視リアクション数の計算を提供する。
 *
 * @remarks
 * NOTE: ソフト絵文字ミュートのマッチ規則は設定画面（ワードミュート）の説明と一致させる。
 *
 * @public
 */

import * as misskey from "calckey-js";
import * as config from "@/config";
import { defaultStore } from "@/store";
import { ensureGolbezaTournamentReactionSlots } from "@/scripts/golbeza-tournament-reaction-gimmick";

type ReactionCountMap = Record<string, number>;

/**
 * ソフト絵文字ミュート 1 行を、マッチ用の内部表現に変換したもの。
 *
 * @public
 */
export type ReactionMuteMatcher = {
	/** `:` と `@` を除いた比較用文字列 */
	name: string;
	/** `:name:` 形式の完全一致寄りマッチか */
	exact: boolean;
	/** ホスト向けの行か（`@` で始まる等） */
	hostmute: boolean;
};

/**
 * `reactionMutedWords` の各行からマッチャーを生成する。
 *
 * @param words アカウントのソフト絵文字ミュート行（設定のテキストエリアと同じ並び）
 * @returns マッチャー配列
 *
 * @public
 */
export function createReactionMuteMatchers(
	words: readonly string[],
): ReactionMuteMatcher[] {
	return words.map((word) => ({
		name: word.replaceAll(":", "").replace("@", ""),
		exact: /^:@?\w+:$/.test(word),
		hostmute: /^:?@[\w.-]/.test(word),
	}));
}

/**
 * リモート一括ミュートを除き、ソフト絵文字ミュートのワードだけで当該リアクションがミュート扱いになるか。
 *
 * @param reaction Misskey 形式のリアクションキー（例: `:foo@bar:` または Unicode）
 * @param muteMatchers {@link createReactionMuteMatchers} の戻り値
 * @returns ワード由来でミュートなら true
 *
 * @public
 */
export function isMutedByReactionWords(
	reaction: string,
	muteMatchers: readonly ReactionMuteMatcher[],
): boolean {
	const emojiName = reaction
		.replace(":", "")
		.replace(/@[\w:\.\-]+:$/, "");
	const emojiHost = reaction
		.replace(/^:[\w:\.\-]+@/, "")
		.replace(":", "");

	return muteMatchers.some((matcher) => {
		if (matcher.exact) {
			if (matcher.hostmute) {
				return matcher.name === emojiHost;
			}
			return matcher.name === emojiName;
		}

		if (matcher.hostmute) {
			return emojiHost.includes(matcher.name);
		}

		return emojiName.includes(matcher.name);
	});
}

/**
 * 現在のストア設定において、ワード由来だけでリアクションがソフトミュート対象か。
 *
 * @param reaction Misskey 形式のリアクションキー
 * @returns ソフト絵文字ミュート（ワード）に該当すれば true
 *
 * @remarks
 * NOTE: {@link defaultStore.state.remoteReactionMute} は含めない（リモート一括とは別判定）。
 *
 * @public
 */
export function isReactionSoftWordMuted(reaction: string): boolean {
	const muteMatchers = createReactionMuteMatchers(
		defaultStore.state.reactionMutedWords,
	);
	return isMutedByReactionWords(reaction, muteMatchers);
}

/**
 * リモート一括ミュートおよびソフト絵文字ミュートを考慮し、当該リアクションがミュート扱いか。
 *
 * @param reaction Misskey 形式のリアクションキー
 * @param muteMatchers 事前に {@link createReactionMuteMatchers} で生成したマッチャー
 * @returns ミュート扱いなら true
 *
 * @internal
 */
function isMutedReaction(
	reaction: string,
	muteMatchers: readonly ReactionMuteMatcher[],
): boolean {
	const emojiName = reaction
		.replace(":", "")
		.replace(/@[\w:\.\-]+:$/, "");
	const emojiHost = reaction
		.replace(/^:[\w:\.\-]+@/, "")
		.replace(":", "");

	if (
		defaultStore.state.remoteReactionMute &&
		emojiHost &&
		emojiHost !== "." &&
		emojiHost !== config.host
	) {
		return true;
	}

	return isMutedByReactionWords(reaction, muteMatchers);
}

/**
 * 同名絵文字（ホスト違い）マージ時の代表キー選択で、`candidate` が `current` より
 * 代表として優先されるか判定する。
 *
 * @remarks
 * ローカル（`@.:`）を最優先し、次に件数降順、最後にキー名昇順でタイブレークする。
 * `reactions` オブジェクトのキー挿入順（ストリーミング受信順や API 応答順で変わりうる）
 * に依存しない決定的なルールにすることで、同じ集計結果に対して常に同じ代表絵文字が
 * 選ばれるようにする。
 *
 * @internal
 */
function isPreferredRepresentative(
	candidate: { reaction: string; count: number },
	current: { reaction: string; count: number },
): boolean {
	const candidateIsLocal = candidate.reaction.endsWith("@.:");
	const currentIsLocal = current.reaction.endsWith("@.:");
	if (candidateIsLocal !== currentIsLocal) return candidateIsLocal;
	if (candidate.count !== current.count)
		return candidate.count > current.count;
	return candidate.reaction < current.reaction;
}

/**
 * ノートの `reactions` から、ミュート設定を反映した上で UI に見せる件数マップを返す。
 *
 * @param note 対象ノート
 * @returns リアクションキーごとの表示用件数（ミュートは 0）
 *
 * @public
 */
export function getVisibleReactions(
	note: misskey.entities.Note,
): ReactionCountMap {
	const muteMatchers = createReactionMuteMatchers(
		defaultStore.state.reactionMutedWords,
	);
	let reactions: ReactionCountMap = { ...(note.reactions ?? {}) };

	ensureGolbezaTournamentReactionSlots(note, reactions);

	const localReactions = Object.keys(reactions).filter((x) =>
		x.includes("@"),
	);
	const mergedReactions: ReactionCountMap = {};

	localReactions.forEach((localReaction) => {
		const targetReactions = Object.keys(reactions).filter((name) =>
			name.startsWith(localReaction.replace(/@[\w:\.\-]+:$/, "@")),
		);
		if (targetReactions.length === 0) return;

		let totalCount = 0;
		let representative: { reaction: string; count: number } | undefined;

		targetReactions.forEach((name) => {
			const reactionCount = reactions[name] ?? 0;
			const candidate = { reaction: name, count: reactionCount };
			if (
				representative == null ||
				isPreferredRepresentative(candidate, representative)
			) {
				representative = candidate;
			}
			totalCount += reactionCount;
			delete reactions[name];
		});

		if (isMutedReaction(representative!.reaction, muteMatchers)) {
			totalCount = 0;
		}

		mergedReactions[representative!.reaction] = totalCount;
	});

	const visibleReactions: ReactionCountMap = {
		...mergedReactions,
		...reactions,
	};

	Object.keys(visibleReactions).forEach((name) => {
		if (isMutedReaction(name, muteMatchers)) {
			visibleReactions[name] = 0;
		}
	});

	return visibleReactions;
}

/**
 * {@link getVisibleReactions} に基づくリアクション件数の合計。
 *
 * @param note 対象ノート
 * @returns 表示用リアクション数の合計
 *
 * @public
 */
export function getVisibleReactionsTotal(note: misskey.entities.Note): number {
	const reactions = getVisibleReactions(note);
	return Object.values(reactions).reduce((sum, count) => sum + count, 0);
}

/**
 * ローカル省略 `@.: ` を正規化する（表示・比較用）。
 *
 * @param reaction リアクションキー
 * @returns 正規化後
 *
 * @public
 */
export function normalizeReactionName(reaction: string): string {
	return reaction.replace(/@\.:$/, ":");
}
