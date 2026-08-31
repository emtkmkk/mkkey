import assert from "node:assert/strict";
import test from "node:test";

import {
	isNotificationMuted,
	resolveEffectiveNotificationType,
} from "./notification-mute.ts";

test("resolveEffectiveNotificationType: unreadAntenna が note に pack された場合、unreadAntenna を返す", () => {
	assert.equal(
		resolveEffectiveNotificationType({
			type: "note",
			isRead: false,
			reaction: "my-antenna",
		}),
		"unreadAntenna",
	);
});

test("resolveEffectiveNotificationType: reaction なしの note は note のまま", () => {
	assert.equal(
		resolveEffectiveNotificationType({
			type: "note",
			isRead: false,
		}),
		"note",
	);
});

test("resolveEffectiveNotificationType: 通常種別はそのまま返す", () => {
	assert.equal(
		resolveEffectiveNotificationType({
			type: "reaction",
			isRead: false,
		}),
		"reaction",
	);
});

test("isNotificationMuted: isRead=true のときミュート扱い", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "reaction", isRead: true },
			[],
		),
		true,
	);
});

test("isNotificationMuted: mutingTypes に実効種別が含まれるときミュート", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "mention", isRead: false },
			["mention"],
		),
		true,
	);
});

test("isNotificationMuted: unreadAntenna が note で pack され isRead=true のときミュート", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "note", isRead: true, reaction: "antenna-1" },
			[],
		),
		true,
	);
});

test("isNotificationMuted: unreadAntenna が note で pack され mutingTypes に unreadAntenna があるときミュート", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "note", isRead: false, reaction: "antenna-1" },
			["unreadAntenna"],
		),
		true,
	);
});

test("isNotificationMuted: グループ種別の親がミュートなら子もミュート", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "followRequestRejected", isRead: false },
			["wasForciblyUnfollowed"],
		),
		true,
	);
});

test("isNotificationMuted: ミュート対象でなければ false", () => {
	assert.equal(
		isNotificationMuted(
			{ type: "reaction", isRead: false },
			["mention"],
		),
		false,
	);
});
