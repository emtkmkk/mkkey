/**
 * @packageDocumentation
 *
 * サーバ統計ストリーム。サーバ全体の統計情報をリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `serverStats`。ログイン必須。
 * - CHANGED: 2026-11 から未ログインでは購読できない（以前は誰でも購読できた）。
 *   未ログインの購読要求は、{@link stream/index} の `connectChannel` で何も返さずに無視される。
 * - serverStats イベントを購読し、サーバ統計を配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Xev from "xev";
import Channel from "../channel.js";

const ev = new Xev();

export default class extends Channel {
	public readonly chName = "serverStats";
	public static shouldShare = true;
	/**
	 * ログイン必須。
	 *
	 * @remarks
	 * サーバーの負荷状況は外部に見せる必要がないため、未ログインでは購読させない。
	 */
	public static requireCredential = true;

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onStats = this.onStats.bind(this);
		this.onMessage = this.onMessage.bind(this);
	}

	public async init(params: any) {
		ev.addListener("serverStats", this.onStats);
	}

	private onStats(stats: any) {
		this.send("stats", stats);
	}

	public onMessage(type: string, body: any) {
		switch (type) {
			case "requestLog":
				ev.once(`serverStatsLog:${body.id}`, (statsLog) => {
					this.send("statsLog", statsLog);
				});
				ev.emit("requestServerStatsLog", {
					id: body.id,
					length: body.length,
				});
				break;
		}
	}

	public dispose() {
		ev.removeListener("serverStats", this.onStats);
	}
}
