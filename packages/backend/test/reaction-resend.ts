/**
 * @packageDocumentation
 *
 * リノート時リアクション再送の補助関数テスト。
 *
 * @internal
 */
process.env.NODE_ENV = "test";

import * as assert from "assert";
import {
	buildFollowerInboxMapByActorIds,
	intersectInboxes,
} from "../src/remote/activitypub/deliver-manager.js";
import { isReactionFederationDeliverable } from "../src/services/note/reaction/deliver.js";

describe("Reaction resend helpers", () => {
	describe("intersectInboxes", () => {
		it("共通 inbox のみ残る", () => {
			const source = new Map<string, boolean>([
				["https://a.example/inbox", true],
				["https://b.example/inbox", false],
			]);
			const target = new Map<string, boolean>([
				["https://b.example/inbox", true],
				["https://c.example/inbox", false],
			]);

			const result = intersectInboxes(source, target);

			assert.deepStrictEqual(Array.from(result.entries()), [
				["https://b.example/inbox", false],
			]);
		});

		it("どちらかが空なら空になる", () => {
			const result = intersectInboxes(
				new Map<string, boolean>(),
				new Map<string, boolean>([["https://a.example/inbox", true]]),
			);

			assert.strictEqual(result.size, 0);
		});
	});

	describe("buildFollowerInboxMapByActorIds", () => {
		it("actor ごとに inbox が集約される", () => {
			const result = buildFollowerInboxMapByActorIds([
				{
					followeeId: "actor-a",
					followerId: "follower-1",
					followerSharedInbox: "https://shared.example/inbox",
					followerInbox: "https://follower1.example/inbox",
				},
				{
					followeeId: "actor-b",
					followerId: "follower-2",
					followerSharedInbox: null,
					followerInbox: "https://follower2.example/inbox",
				},
			]);

			assert.deepStrictEqual(Array.from(result.get("actor-a")?.entries() ?? []), [
				["https://shared.example/inbox", true],
			]);
			assert.deepStrictEqual(Array.from(result.get("actor-b")?.entries() ?? []), [
				["https://follower2.example/inbox", false],
			]);
		});
	});

	describe("isReactionFederationDeliverable", () => {
		it("条件を満たす場合は true になる", () => {
			const result = isReactionFederationDeliverable(
				{
					host: null,
					isExplorable: true,
					isRemoteExplorable: true,
				} as any,
				{
					channelId: null,
					localOnly: false,
					visibility: "public",
					isPublicLikeList: true,
				} as any,
			);

			assert.strictEqual(result, true);
		});

		it("見つけやすくする設定が false の場合は false になる", () => {
			const result = isReactionFederationDeliverable(
				{
					host: null,
					isExplorable: false,
					isRemoteExplorable: true,
				} as any,
				{
					channelId: null,
					localOnly: false,
					visibility: "public",
					isPublicLikeList: true,
				} as any,
			);

			assert.strictEqual(result, false);
		});

		it("hidden ノートは false になる", () => {
			const result = isReactionFederationDeliverable(
				{
					host: null,
					isExplorable: true,
					isRemoteExplorable: true,
				} as any,
				{
					channelId: null,
					localOnly: false,
					visibility: "hidden",
					isPublicLikeList: true,
				} as any,
			);

			assert.strictEqual(result, false);
		});
	});
});
