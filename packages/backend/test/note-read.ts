import * as assert from "assert";

import {
	getNoteUnreadClearEvents,
	getReadAntennaIds,
} from "../src/services/note/read.js";

describe("services/note/read", () => {
	describe("getNoteUnreadClearEvents", () => {
		it("全ての未読が残っているとイベントを発行しない", () => {
			assert.deepStrictEqual(
				getNoteUnreadClearEvents({
					mentions: 1,
					specified: 1,
					channel: 1,
				}),
				[],
			);
		});

		it("それぞれの未読が0件のときに従来どおりのイベントを返す", () => {
			assert.deepStrictEqual(
				getNoteUnreadClearEvents({
					mentions: 0,
					specified: 2,
					channel: 0,
				}),
				["readAllUnreadMentions", "readAllChannels"],
			);

			assert.deepStrictEqual(
				getNoteUnreadClearEvents({
					mentions: 2,
					specified: 0,
					channel: 3,
				}),
				["readAllUnreadSpecifiedNotes"],
			);

			assert.deepStrictEqual(
				getNoteUnreadClearEvents({
					mentions: 0,
					specified: 0,
					channel: 0,
				}),
				[
					"readAllUnreadMentions",
					"readAllUnreadSpecifiedNotes",
					"readAllChannels",
				],
			);
		});
	});

	describe("getReadAntennaIds", () => {
		it("未読0件のアンテナのみ readAntenna 対象として返す", () => {
			const countsByAntennaId = new Map<string, number>([
				["antennaA", 2],
				["antennaB", 0],
			]);

			assert.deepStrictEqual(
				getReadAntennaIds(countsByAntennaId, [
					"antennaA",
					"antennaB",
					"antennaC",
				]),
				["antennaB", "antennaC"],
			);
		});
	});
});
