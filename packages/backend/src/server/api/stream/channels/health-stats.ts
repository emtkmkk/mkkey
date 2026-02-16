import Xev from "xev";
import Channel from "../channel.js";

const ev = new Xev();

export default class extends Channel {
	public readonly chName = "healthStats";
	public static shouldShare = true;
	public static requireCredential = false;

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onStats = this.onStats.bind(this);
		this.onMessage = this.onMessage.bind(this);
	}

	public async init(params: any) {
		ev.addListener("healthStats", this.onStats);
	}

	private onStats(stats: any) {
		this.send("stats", stats);
	}

	public onMessage(type: string, body: any) {
		switch (type) {
			case "requestLog":
				ev.once(`healthStatsLog:${body.id}`, (statsLog) => {
					this.send("statsLog", statsLog);
				});
				ev.emit("requestHealthStatsLog", {
					id: body.id,
					length: body.length,
				});
				break;
		}
	}

	public dispose() {
		ev.removeListener("healthStats", this.onStats);
	}
}
