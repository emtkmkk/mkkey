process.env.NODE_ENV = "test";

import * as assert from "assert";
import config from "../src/config/index.js";
import {
	isDefaultInstanceReaction,
	resolveMessagingNotificationDisplayImageUrl,
	resolveNoteEmbedImageUrl,
	resolveNoteNotificationDisplayImageUrl,
	resolveReactionNotificationBadgeUrl,
	resolveReactionNotificationIconUrl,
} from "../src/misc/notification-display-media.js";
import { resolveNotificationDisplayText } from "../src/misc/notification-display-text.js";
import {
	attachDisplayImageUrlToNotification,
	attachDisplayTextToNotification,
	attachReactionPushDisplayExtras,
	buildMinimalNotificationPayloadForPush,
	truncateNotification,
} from "../src/services/push-notification.js";

/**
 * buildPayload と同順で通知を enrich する（単体テスト用）。
 *
 * @param notification - pack 済み通知
 * @param defaultReaction - 既定リアクション
 * @internal
 */
function enrichNotificationForPush(
	notification: Record<string, unknown>,
	defaultReaction = "⭐",
): Record<string, unknown> {
	let enriched = attachDisplayImageUrlToNotification(
		notification,
		defaultReaction,
	);
	enriched = attachDisplayTextToNotification(enriched, defaultReaction);
	enriched = attachReactionPushDisplayExtras(enriched, defaultReaction);
	return truncateNotification(
		enriched as Parameters<typeof truncateNotification>[0],
	) as Record<string, unknown>;
}

/** displayBody 内の (📎N) 出現回数を数える */
function countAttachmentMarkers(text: string | undefined): number {
	if (text == null) return 0;
	return (text.match(/\(📎\d+\)/g) ?? []).length;
}

describe("notification-display-media", () => {
	it("正常系: 先頭添付が画像のとき url を返す", () => {
		const url = resolveNoteEmbedImageUrl({
			files: [
				{
					type: "image/png",
					url: "https://example.com/a.png",
					isSensitive: false,
				},
			],
		});
		assert.strictEqual(url, "https://example.com/a.png");
	});

	it("異常系: センシティブ添付は表示用 URL を返さない", () => {
		const url = resolveNoteEmbedImageUrl({
			files: [
				{
					type: "image/png",
					url: "https://example.com/a.png",
					isSensitive: true,
				},
			],
		});
		assert.strictEqual(url, undefined);
	});

	it("正常系: 動画は thumbnailUrl を displayImage に使う", () => {
		const url = resolveNoteNotificationDisplayImageUrl({
			files: [
				{
					type: "video/mp4",
					thumbnailUrl: "https://example.com/thumb.jpg",
					isSensitive: false,
				},
			],
		});
		assert.strictEqual(url, "https://example.com/thumb.jpg");
	});

	it("正常系: DM 画像添付", () => {
		const url = resolveMessagingNotificationDisplayImageUrl({
			file: {
				type: "image/png",
				url: "https://example.com/dm.png",
				isSensitive: false,
			},
		});
		assert.strictEqual(url, "https://example.com/dm.png");
	});

	it("正常系: 非デフォルト Unicode リアクションの icon URL を解決する", () => {
		const url = resolveReactionNotificationIconUrl("😀", null, "⭐");
		assert.strictEqual(
			url,
			`${config.url}/twemoji/1f600.svg`,
		);
	});

	it("正常系: デフォルトリアクションの icon URL は返さない", () => {
		const url = resolveReactionNotificationIconUrl("⭐", null, "⭐");
		assert.strictEqual(url, undefined);
	});

	it("正常系: カスタム絵文字リアクションの icon URL を解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat:", {
			emojis: [
				{
					name: "blobcat",
					url: "https://example.com/blobcat.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/blobcat.png");
	});

	it("正常系: reactionEmojis のみに URL があるカスタム絵文字を解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat:", {
			emojis: [],
			reactionEmojis: [
				{
					name: "blobcat",
					url: "https://example.com/reaction-blobcat.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/reaction-blobcat.png");
	});

	it("正常系: reactionEmojis の name が blobcat@. 形式でも解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat:", {
			emojis: [],
			reactionEmojis: [
				{
					name: "blobcat@.",
					url: "https://example.com/reaction-blobcat-at-dot.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/reaction-blobcat-at-dot.png");
	});

	it("正常系: リモート絵文字 name blobcat@example.com を :blobcat@example.com: で解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat@example.com:", {
			reactionEmojis: [
				{
					name: "blobcat@example.com",
					url: "https://example.com/remote-blobcat.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/remote-blobcat.png");
	});

	it("正常系: リモート絵文字 name blobcat@example.com を :blobcat: でも解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat:", {
			reactionEmojis: [
				{
					name: "blobcat@example.com",
					url: "https://example.com/remote-blobcat-stripped.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/remote-blobcat-stripped.png");
	});

	it("正常系: 非デフォルト Unicode リアクションの badge URL を解決する", () => {
		const url = resolveReactionNotificationBadgeUrl("😀", null, "⭐");
		assert.strictEqual(
			url,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: isDefaultInstanceReaction が加算リアクションを既定扱いする", () => {
		assert.strictEqual(isDefaultInstanceReaction("⭐ (+1)", "⭐"), true);
		assert.strictEqual(isDefaultInstanceReaction("😀", "⭐"), false);
	});

	it("境界値: attachReactionPushDisplayExtras が reaction 用フィールドを付与する", () => {
		const out = attachReactionPushDisplayExtras(
			{
				type: "reaction",
				reaction: "😀",
			},
			"⭐",
		);
		assert.strictEqual((out as { defaultReaction?: string }).defaultReaction, "⭐");
		assert.strictEqual(
			(out as { reactionIconUrl?: string }).reactionIconUrl,
			`${config.url}/twemoji/1f600.svg`,
		);
		assert.strictEqual(
			(out as { reactionBadgeUrl?: string }).reactionBadgeUrl,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: attachReactionPushDisplayExtras が reactionEmojis から reactionIconUrl を付与する", () => {
		const out = attachReactionPushDisplayExtras(
			{
				type: "reaction",
				reaction: ":blobcat:",
				note: {
					emojis: [],
					reactionEmojis: [
						{
							name: "blobcat",
							url: "https://example.com/reaction-blobcat.png",
						},
					],
				},
			},
			"⭐",
		);
		assert.strictEqual(
			(out as { reactionIconUrl?: string }).reactionIconUrl,
			"https://example.com/reaction-blobcat.png",
		);
	});

	it("境界値: attachDisplayImageUrlToNotification が displayImageUrl を付与する", () => {
		const out = attachDisplayImageUrlToNotification(
			{
				type: "mention",
				note: {
					files: [
						{
							type: "image/png",
							url: "https://example.com/n.png",
							isSensitive: false,
						},
					],
				},
			},
			"⭐",
		);
		assert.strictEqual(
			(out as { displayImageUrl?: string }).displayImageUrl,
			"https://example.com/n.png",
		);
	});
});

describe("notification-display-text", () => {
	it("正常系: mention の displayTitle / displayBody を解決する", () => {
		const resolved = resolveNotificationDisplayText({
			type: "mention",
			user: { username: "alice", name: "Alice" },
			note: { text: "こんにちは" },
		});
		assert.strictEqual(resolved?.displayTitle, "Alice から 呼びかけ");
		assert.strictEqual(resolved?.displayBody, "こんにちは");
	});

	it("正常系: wasBlocked の displayTitle を解決する", () => {
		const resolved = resolveNotificationDisplayText({
			type: "wasBlocked",
			user: { username: "bob", name: "Bob", host: "example.com" },
		});
		assert.strictEqual(
			resolved?.displayTitle,
			"Bob (bob@example.com) から ブロックされました",
		);
	});

	it("正常系: followRequestRejected の displayTitle を解決する", () => {
		const resolved = resolveNotificationDisplayText({
			type: "followRequestRejected",
			user: { username: "bob", name: "Bob", host: "example.com" },
		});
		assert.strictEqual(
			resolved?.displayTitle,
			"Bob (bob@example.com) への フォローが拒否されました",
		);
	});

	it("境界値: attachDisplayTextToNotification が displayTitle を付与する", () => {
		const out = attachDisplayTextToNotification(
			{
				type: "userWasUnfollowed",
				user: { username: "carol", name: "Carol", host: "example.com" },
			},
			"⭐",
		);
		assert.strictEqual(
			(out as { displayTitle?: string }).displayTitle,
			"Carol (carol@example.com) から リムーブされました",
		);
	});

	it("正常系: 添付1件の mention で displayBody に (📎1) が1回だけ付く", () => {
		const out = enrichNotificationForPush({
			type: "mention",
			user: { username: "alice", name: "Alice" },
			note: {
				text: "こんにちは",
				files: [
					{
						type: "image/png",
						url: "https://example.com/a.png",
						isSensitive: false,
					},
				],
			},
		});

		const displayBody = (out as { displayBody?: string }).displayBody;
		assert.strictEqual(displayBody, "こんにちは (📎1)");
		assert.strictEqual(countAttachmentMarkers(displayBody), 1);
	});

	it("境界値: 本文なし・添付のみで displayBody が (📎2) のみになる", () => {
		const out = enrichNotificationForPush({
			type: "reply",
			user: { username: "bob", name: "Bob" },
			note: {
				text: "",
				files: [
					{
						type: "image/png",
						url: "https://example.com/a.png",
						isSensitive: false,
					},
					{
						type: "image/png",
						url: "https://example.com/b.png",
						isSensitive: false,
					},
				],
			},
		});

		const displayBody = (out as { displayBody?: string }).displayBody;
		assert.strictEqual(displayBody, "(📎2)");
		assert.strictEqual(countAttachmentMarkers(displayBody), 1);
	});

	it("回帰: enrich 後も displayImageUrl と truncate 後の note.files 除去が維持される", () => {
		const out = enrichNotificationForPush({
			type: "mention",
			user: { username: "alice", name: "Alice" },
			note: {
				text: "画像付き",
				files: [
					{
						type: "image/png",
						url: "https://example.com/n.png",
						isSensitive: false,
					},
				],
			},
		});

		assert.strictEqual(
			(out as { displayImageUrl?: string }).displayImageUrl,
			"https://example.com/n.png",
		);
		assert.strictEqual(
			(out as { note?: { files?: unknown } }).note?.files,
			undefined,
		);
		assert.strictEqual(
			(out as { note?: { text?: string } }).note?.text,
			(out as { displayBody?: string }).displayBody,
		);
	});
});

describe("push-notification", () => {
	let p: import("child_process").ChildProcess;
	let alice: { id: string; token: string };

	before(async () => {
		const { signup, startServer } = await import("./utils.js");
		p = await startServer();
		alice = await signup({ username: "push_alice" });
	});

	after(async () => {
		const { shutdownServer } = await import("./utils.js");
		await shutdownServer(p);
	});

	it("正常系: 購読が無い場合 test-push-notification は no_subscriptions を返す", async () => {
		const res = await fetch("http://localhost:61812/api/i/test-push-notification", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({}),
		});
		const body = await res.json();
		assert.strictEqual(body.ok, false);
		assert.strictEqual(body.subscriptionCount, 0);
	});

	it("境界値: minimal ペイロードに userId と user が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif1",
			type: "wasBlocked",
			userId: "user1",
			user: {
				id: "user1",
				username: "alice",
				name: "Alice",
				avatarUrl: "https://example.com/avatar.png",
			},
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(result.id, "notif1");
		assert.strictEqual(result.type, "wasBlocked");
		assert.strictEqual(result.userId, "user1");
		assert.deepStrictEqual(result.user, {
			id: "user1",
			username: "alice",
			name: "Alice",
			avatarUrl: "https://example.com/avatar.png",
		});
		assert.strictEqual((result as { note?: unknown }).note, undefined);
	});

	it("境界値: minimal ペイロードに displayImageUrl が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif2",
			type: "mention",
			displayImageUrl: "https://example.com/large.png",
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(
			(result as { displayImageUrl?: string }).displayImageUrl,
			"https://example.com/large.png",
		);
	});

	it("境界値: minimal ペイロードに reaction 表示用フィールドが残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif4",
			type: "reaction",
			reaction: "😀",
			defaultReaction: "⭐",
			reactionIconUrl: `${config.url}/twemoji/1f600.svg`,
			reactionBadgeUrl: `${config.url}/twemoji-badge/1f600.png`,
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual((result as { reaction?: string }).reaction, "😀");
		assert.strictEqual(
			(result as { defaultReaction?: string }).defaultReaction,
			"⭐",
		);
		assert.strictEqual(
			(result as { reactionIconUrl?: string }).reactionIconUrl,
			`${config.url}/twemoji/1f600.svg`,
		);
		assert.strictEqual(
			(result as { reactionBadgeUrl?: string }).reactionBadgeUrl,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: minimal ペイロードに reactionEmojis が残る", () => {
		const reactionEmojis = [
			{ name: "blobcat", url: "https://example.com/reaction-blobcat.png" },
		];
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif-reaction-emoji",
			type: "reaction",
			reaction: ":blobcat:",
			note: {
				id: "note-id",
				text: "x".repeat(5000),
				reactionEmojis,
			},
		});

		assert.deepStrictEqual(
			(
				result as {
					note?: { reactionEmojis?: Array<{ name: string; url: string }> };
				}
			).note?.reactionEmojis,
			reactionEmojis,
		);
	});

	it("境界値: minimal ペイロードに viewNoteId が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif-reaction",
			type: "reaction",
			viewNoteId: "reacted-note-id",
			note: {
				id: "reacted-note-id",
				text: "x".repeat(5000),
			},
		});

		assert.strictEqual(
			(result as { viewNoteId?: string }).viewNoteId,
			"reacted-note-id",
		);
	});

	it("境界値: minimal ペイロードに renoteTargetNoteId と note.id が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif-renote",
			type: "renote",
			renoteTargetNoteId: "target-note-id",
			note: {
				id: "wrapper-note-id",
				userId: "poster-id",
				text: "x".repeat(5000),
			},
		});

		assert.strictEqual(
			(result as { renoteTargetNoteId?: string }).renoteTargetNoteId,
			"target-note-id",
		);
		assert.deepStrictEqual(
			(result as { note?: { id: string; userId: string } }).note,
			{ id: "wrapper-note-id", userId: "poster-id" },
		);
	});

	it("境界値: minimal ペイロードに displayTitle / displayBody が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif3",
			type: "mention",
			displayTitle: "Alice から 呼びかけ",
			displayBody: "本文抜粋",
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(
			(result as { displayTitle?: string }).displayTitle,
			"Alice から 呼びかけ",
		);
		assert.strictEqual(
			(result as { displayBody?: string }).displayBody,
			"本文抜粋",
		);
	});

	it("正常系: dev モードでない場合 push-log は空配列", async () => {
		const res = await fetch("http://localhost:61812/api/i/push-log", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({ limit: 10 }),
		});
		assert.strictEqual(res.status, 200);
		const body = await res.json();
		assert.ok(Array.isArray(body));
		assert.strictEqual(body.length, 0);
	});
});
