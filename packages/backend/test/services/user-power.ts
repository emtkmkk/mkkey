/**
 * @packageDocumentation
 *
 * `user-power` 純関数の単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	computeDisplayPower,
	computeOjPower,
	computePowerRankFromWindow,
} from "../../src/services/user-power.js";

describe("computeDisplayPower", () => {
	it("正常系：係数のみの最小例の場合、床取り後のパワーになる", () => {
		const p = computeDisplayPower({
			notesPostDays: 1,
			notesCount: 0,
			notesCountForPower: 1,
			repliesCount: 0,
			renotesCount: 0,
			quotesCount: 0,
			repliedCount: 0,
			renotedCount: 0,
			pollVotesCount: 0,
			pollVotedCount: 0,
			pageLikesCount: 0,
			pageLikedCount: 0,
			sentReactionsCount: 0,
			receivedReactionsCount: 0,
			driveFilesCount: 0,
			sendMessageCount: 0,
			readMessageCount: 0,
			followingCount: 0,
			followersCount: 0,
		});
		assert.strictEqual(p, 500);
	});
});

describe("computeOjPower", () => {
	it("正常系：係数 3 と 1 の加重和になる", () => {
		assert.strictEqual(computeOjPower(2, 3), 15);
	});
});

describe("computePowerRankFromWindow", () => {
	it("境界値：elapsedDays が 14 以上で Bot でない場合、日数による上限クリップを適用しない", () => {
		const out = computePowerRankFromWindow({
			rankWindow: {
				notesPostDays: 1,
				notesCount: 0,
				repliesCount: 0,
				renotesCount: 0,
				quotesCount: 0,
				repliedCount: 0,
				renotedCount: 0,
				pollVotesCount: 0,
				pollVotedCount: 0,
				sentReactionsCount: 0,
				receivedReactionsCount: 0,
				driveFilesCount: 0,
				sendMessageCount: 0,
				readMessageCount: 0,
			},
			elapsedDays: 14,
			isBot: false,
		});
		assert.strictEqual(out.effectiveRankPowerFloored, Math.floor(out.rankPower));
	});

	it("境界値：isBot の場合は rpRate に 0.5 が乗りランク指標が下がる", () => {
		const human = computePowerRankFromWindow({
			rankWindow: {
				notesPostDays: 10,
				notesCount: 100,
				repliesCount: 0,
				renotesCount: 0,
				quotesCount: 0,
				repliedCount: 0,
				renotedCount: 0,
				pollVotesCount: 0,
				pollVotedCount: 0,
				sentReactionsCount: 0,
				receivedReactionsCount: 0,
				driveFilesCount: 0,
				sendMessageCount: 0,
				readMessageCount: 0,
			},
			elapsedDays: 20,
			isBot: false,
		});
		const bot = computePowerRankFromWindow({
			rankWindow: {
				notesPostDays: 10,
				notesCount: 100,
				repliesCount: 0,
				renotesCount: 0,
				quotesCount: 0,
				repliedCount: 0,
				renotedCount: 0,
				pollVotesCount: 0,
				pollVotedCount: 0,
				sentReactionsCount: 0,
				receivedReactionsCount: 0,
				driveFilesCount: 0,
				sendMessageCount: 0,
				readMessageCount: 0,
			},
			elapsedDays: 20,
			isBot: true,
		});
		assert.ok(bot.rankPower < human.rankPower);
		assert.ok(bot.effectiveRankPowerFloored <= 4999);
	});
});
