/**
 * @packageDocumentation
 *
 * DB サーバ統計ストリーム。DB サーバの CPU・メモリ・swap・ネットワーク・ディスクをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `dbServerStats`。ログイン必須。
 * - `dbServerStats` イベントを購読し、統計を配送する。値の形は `serverStats` と同じで、swap と load average が増えている。
 * - `requestLog` を送ると、直近の履歴を `statsLog` で返す（`serverStats` と同じ）。
 * - 送り元は {@link ../../../../daemons/db-server-stats.ts}。設定が無ければ何も届かない。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Xev from "xev";
import Channel from "../channel.js";

const ev = new Xev();

export default class extends Channel {
	public readonly chName = "dbServerStats";
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
		ev.addListener("dbServerStats", this.onStats);
	}

	private onStats(stats: any) {
		this.send("stats", stats);
	}

	public onMessage(type: string, body: any) {
		switch (type) {
			case "requestLog":
				ev.once(`dbServerStatsLog:${body.id}`, (statsLog) => {
					this.send("statsLog", statsLog);
				});
				ev.emit("requestDbServerStatsLog", {
					id: body.id,
					length: body.length,
				});
				break;
		}
	}

	public dispose() {
		ev.removeListener("dbServerStats", this.onStats);
	}
}
