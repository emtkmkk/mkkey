/**
 * @packageDocumentation
 *
 * 範囲付きミュート・双方向ブロックによるリアクション一覧と件数補正のE2Eテスト。
 *
 * @internal
 */

process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import WebSocket from "ws";
import {
	async,
	port,
	post,
	react,
	request,
	shutdownServer,
	signup,
	sleep,
	startServer,
} from "./utils.js";

describe("リアクション関係除外", () => {
	type TestUser = Awaited<ReturnType<typeof signup>>;
	type TestNote = Awaited<ReturnType<typeof post>>;

	let server: childProcess.ChildProcess;
	let viewer: TestUser;
	let author: TestUser;
	let reactionMuted: TestUser;
	let blockedByViewer: TestUser;
	let blockingViewer: TestUser;
	let note: TestNote;

	/**
	 * ノート購読中に指定利用者のリアクションイベントを受信するか確認する。
	 *
	 * @param user - ストリームを購読する利用者
	 * @param trigger - 購読開始後に実行する関係変更とリアクション
	 * @param actorId - 待機するリアクション操作利用者ID
	 * @returns 制限時間内に対象イベントを受信した場合はtrue
	 * @throws WebSocket接続またはトリガー処理が失敗した場合
	 *
	 * @remarks
	 * 購読登録と関係更新のRedis配信が反映されるまで短時間待ち、実際の接続中Set更新も検証する。
	 *
	 * @internal
	 */
	function receivesReactionEvent(
		user: TestUser,
		trigger: () => Promise<unknown>,
		actorId: string,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(
				`ws://localhost:${port}/streaming?i=${user.token}`,
			);
			let timeout: NodeJS.Timeout | undefined;
			let settled = false;

			const finish = (received: boolean): void => {
				if (settled) return;
				settled = true;
				if (timeout != null) clearTimeout(timeout);
				ws.close();
				resolve(received);
			};
			const fail = (error: Error): void => {
				if (settled) return;
				settled = true;
				if (timeout != null) clearTimeout(timeout);
				ws.close();
				reject(error);
			};

			ws.on("message", (data) => {
				const message = JSON.parse(data.toString()) as {
					type?: string;
					body?: {
						type?: string;
						body?: { userId?: string };
					};
				};
				if (
					message.type === "noteUpdated" &&
					message.body?.type === "reacted" &&
					message.body.body?.userId === actorId
				) {
					finish(true);
				}
			});
			ws.on("error", fail);
			ws.on("open", () => {
				ws.send(JSON.stringify({ type: "subNote", body: { id: note.id } }));
				setTimeout(() => {
					trigger()
						.then(() => {
							if (!settled) {
								timeout = setTimeout(() => finish(false), 1500);
							}
						})
						.catch(fail);
				}, 100);
			});
		});
	}

	before(async () => {
		server = await startServer();
		viewer = await signup({ username: "reaction_visibility_viewer" });
		author = await signup({ username: "reaction_visibility_author" });
		reactionMuted = await signup({ username: "reaction_visibility_muted" });
		blockedByViewer = await signup({
			username: "reaction_visibility_blocked",
		});
		blockingViewer = await signup({
			username: "reaction_visibility_blocking",
		});

		note = await post(author, { text: "reaction visibility" });
		await react(reactionMuted, note, "👍");
		await react(blockedByViewer, note, "👍");
		await react(blockingViewer, note, "👍");
		await request(
			"/mute/update",
			{ userId: reactionMuted.id, types: ["reaction"] },
			viewer,
		);
	});

	after(async () => {
		await shutdownServer(server);
	});

	it("正常系：設定OFFでもreactionミュート対象はリアクション者一覧から除外される", async(async () => {
		const response = await request(
			"/notes/reactions",
			{ noteId: note.id, limit: 100 },
			viewer,
		);

		assert.strictEqual(response.status, 200);
		assert.strictEqual(
			(response.body as Array<{ user: { id: string } }>).some(
				(reaction) => reaction.user.id === reactionMuted.id,
			),
			false,
		);
		assert.strictEqual(response.body.length, 2);
	}));

	it("正常系：設定OFFの場合、ノート本体の件数は差し引かれない", async(async () => {
		const response = await request("/notes/show", { noteId: note.id }, viewer);

		assert.strictEqual(response.status, 200);
		assert.strictEqual(response.body.reactions["👍"], 3);
	}));

	it("正常系：設定ONの場合、reactionミュート対象の件数を差し引く", async(async () => {
		await request(
			"/i/update",
			{ hideMutedAndBlockedUserReactions: true },
			viewer,
		);
		const response = await request("/notes/show", { noteId: note.id }, viewer);

		assert.strictEqual(response.body.reactions["👍"], 2);
	}));

	it("正常系：自分からのブロックと相手からのブロックをそれぞれ差し引く", async(async () => {
		await request(
			"/blocking/create",
			{ userId: blockedByViewer.id },
			viewer,
		);
		await request(
			"/blocking/create",
			{ userId: viewer.id },
			blockingViewer,
		);
		const response = await request("/notes/show", { noteId: note.id }, viewer);

		assert.strictEqual(response.body.reactions["👍"], undefined);
	}));

	it("境界値：同じ利用者がミュートとブロックの両方に該当しても二重減算しない", async(async () => {
		await request(
			"/blocking/create",
			{ userId: viewer.id },
			reactionMuted,
		);
		const response = await request("/notes/show", { noteId: note.id }, viewer);

		assert.strictEqual(response.body.reactions["👍"], undefined);
	}));

	it("正常系：設定をOFFへ戻した場合、ノート本体の件数は従来値へ戻る", async(async () => {
		await request(
			"/i/update",
			{ hideMutedAndBlockedUserReactions: false },
			viewer,
		);
		const response = await request("/notes/show", { noteId: note.id }, viewer);

		assert.strictEqual(response.body.reactions["👍"], 3);
	}));

	it("正常系：設定OFFの場合、ミュート対象者のリアクションイベントも通す", async(async () => {
		const received = await receivesReactionEvent(
			viewer,
			() => react(reactionMuted, note, "❤️"),
			reactionMuted.id,
		);

		assert.strictEqual(received, true);
	}));

	it("正常系：設定ONの場合、ミュート対象者のリアクションイベントを除外する", async(async () => {
		await request(
			"/i/update",
			{ hideMutedAndBlockedUserReactions: true },
			viewer,
		);
		const received = await receivesReactionEvent(
			viewer,
			() => react(reactionMuted, note, "😆"),
			reactionMuted.id,
		);

		assert.strictEqual(received, false);
	}));

	it("正常系：接続中のミュート解除とブロック解除を直後のイベントへ反映する", async(async () => {
		const received = await receivesReactionEvent(
			viewer,
			async () => {
				await request(
					"/blocking/delete",
					{ userId: viewer.id },
					reactionMuted,
				);
				await request(
					"/mute/update",
					{ userId: reactionMuted.id, types: [] },
					viewer,
				);
				await sleep(100);
				await react(reactionMuted, note, "❤️");
			},
			reactionMuted.id,
		);

		assert.strictEqual(received, true);
	}));

	it("正常系：接続中のreactionミュートを直後のイベントへ反映する", async(async () => {
		const received = await receivesReactionEvent(
			viewer,
			async () => {
				await request(
					"/mute/update",
					{ userId: reactionMuted.id, types: ["reaction"] },
					viewer,
				);
				await sleep(100);
				await react(reactionMuted, note, "😆");
			},
			reactionMuted.id,
		);

		assert.strictEqual(received, false);
	}));

	it("正常系：接続中のblockとunblockを直後のイベントへ反映する", async(async () => {
		const blockedEvent = await receivesReactionEvent(
			viewer,
			async () => {
				await request(
					"/blocking/create",
					{ userId: viewer.id },
					author,
				);
				await sleep(100);
				await react(author, note, "❤️");
			},
			author.id,
		);
		assert.strictEqual(blockedEvent, false);

		const unblockedEvent = await receivesReactionEvent(
			viewer,
			async () => {
				await request(
					"/blocking/delete",
					{ userId: viewer.id },
					author,
				);
				await sleep(100);
				await react(author, note, "😆");
			},
			author.id,
		);
		assert.strictEqual(unblockedEvent, true);
	}));
});
