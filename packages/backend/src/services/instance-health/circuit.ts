/**
 * @packageDocumentation
 *
 * 配送先サーバごとのサーキットブレーカー（落ちているサーバ宛ての配送を、一定時間「試さずに待たせる」仕組み）。
 *
 * @remarks
 * - **役割**: 死んだサーバ宛ての配送が、処理枠を最大 60 秒ふさいだり、適応スロットル経由でキュー全体を遅くしたりするのを防ぐ。
 * - 状態の移り変わり:
 *   - 健康: 普通に送る。`hostDown` の失敗が、**異なるジョブで** {@link CircuitOptions.threshold} 件連続したら「不調」へ。
 *     同じジョブの再送は 1 件として数える（内容が原因で失敗し続けるジョブ 1 件だけでは開かない）。
 *     間に成功・4xx・429（＝相手のアプリが応答した）が 1 件でもあれば数え直す。
 *   - 不調: 送らずにすぐ返す。待ち時間が過ぎたら、配送ジョブではなく呼び出し側が用意した軽い確認（nodeinfo の取得）を 1 本だけ行う。
 *     確認が成功したら健康へ。失敗したら待ち時間を倍にして（上限あり）不調のまま。
 * - 429 は失敗として数えないが、`Retry-After` の間はそのサーバに送らない。
 * - 状態はこのプロセスのメモリだけに持つ。queue ワーカーが 1 プロセスなので共有しない（計画の決定事項 Q3）。
 *   TODO: queue ワーカーを 3 以上に増やすときは、状態を Redis に移すことを検討する。
 * - config・DB・時刻に直接依存しない（テストのため、時刻は `now` で渡す）。
 *
 * @see plans/instance-delivery-health-plan.md 設計方針 3
 * @internal
 */
import type { DeliverOutcome } from "./classify.js";

//#region 型

/**
 * ブレーカーの設定。
 *
 * @internal
 */
export type CircuitOptions = {
	/** 不調にするまでの、異なるジョブでの連続失敗数（決定事項 Q1） */
	threshold: number;
	/** 最初の待ち時間（ミリ秒） */
	baseCooldownMs: number;
	/** 待ち時間の上限（ミリ秒） */
	maxCooldownMs: number;
	/** 429 で待たせる時間の上限（ミリ秒） */
	maxRateLimitMs: number;
	/** 状態を持つホスト数の上限。超えたら、不調でないものから古い順に消す */
	maxHosts: number;
	/** 現在時刻（ミリ秒）を返す関数 */
	now: () => number;
};

/**
 * 既定の設定。
 *
 * @internal
 */
export const defaultCircuitOptions: CircuitOptions = {
	threshold: 5,
	baseCooldownMs: 60 * 1000,
	maxCooldownMs: 60 * 60 * 1000,
	maxRateLimitMs: 60 * 60 * 1000,
	maxHosts: 10000,
	now: () => Date.now(),
};

/**
 * 送る前の判断。
 *
 * @remarks
 * - `send`: 普通に送る。
 * - `skip`: 送らずに返す。`startProbe` が true なら、呼び出し側は復帰の確認を 1 本始め、
 *   結果を {@link HostCircuitBreaker.recordProbeResult} で伝える。
 *
 * @internal
 */
export type CircuitDecision =
	| { action: "send" }
	| { action: "skip"; reason: "open" | "rateLimited"; until: number; startProbe: boolean };

/**
 * 状態が変わったときに返すできごと。ログや履歴に使う。
 *
 * @internal
 */
export type CircuitEvent =
	| {
			type: "opened";
			host: string;
			/** 連続して失敗した異なるジョブの数 */
			failures: number;
			/** 最後の失敗の説明（例: `ECONNREFUSED`） */
			lastError: string;
			/** 待ち時間（ミリ秒） */
			cooldownMs: number;
	  }
	| {
			type: "closed";
			host: string;
			/** 不調だった時間（ミリ秒） */
			openForMs: number;
			/** 閉じたきっかけ */
			by: "probe" | "delivery";
	  };

/**
 * 1 ホスト分の状態。
 *
 * @internal
 */
type HostState = {
	/** 連続して `hostDown` で失敗した、異なるジョブの ID */
	failingJobs: Set<string>;
	/** 最後の失敗の説明 */
	lastError: string;
	/** 不調になった時刻。健康なら null */
	openedAt: number | null;
	/** 次に確認してよい時刻（不調のとき） */
	nextProbeAt: number;
	/** 今の待ち時間（不調のとき） */
	cooldownMs: number;
	/** 確認が進行中か */
	probing: boolean;
	/** 429 で待たせる期限。無ければ 0 */
	rateLimitedUntil: number;
};

/**
 * 不調中のサーバの一覧の 1 行（画面・統計用）。
 *
 * @internal
 */
export type OpenCircuitSnapshot = {
	host: string;
	openedAt: number;
	nextProbeAt: number;
	cooldownMs: number;
	lastError: string;
};

//#endregion 型

/**
 * 配送先サーバごとのサーキットブレーカー。
 *
 * @remarks
 * 1 プロセスに 1 つ作って使う（{@link ./index.ts} の `deliverCircuit`）。
 *
 * @internal
 */
export class HostCircuitBreaker {
	//#region フィールド

	/** 設定 */
	private readonly opts: CircuitOptions;

	/** ホストごとの状態。健康で失敗も無いホストは持たない */
	private readonly hosts = new Map<string, HostState>();

	//#endregion フィールド

	/**
	 * @param opts - 設定（省略した項目は {@link defaultCircuitOptions}）
	 */
	constructor(opts: Partial<CircuitOptions> = {}) {
		this.opts = { ...defaultCircuitOptions, ...opts };
	}

	//#region 公開メソッド

	/**
	 * 送る前に、送ってよいかを判断する。
	 *
	 * @param host - 配送先ホスト
	 * @returns 判断
	 */
	public check(host: string): CircuitDecision {
		const state = this.hosts.get(host);
		if (state == null) return { action: "send" };

		const now = this.opts.now();

		if (state.openedAt != null) {
			// 待ち時間が過ぎていて、確認がまだなら、この呼び出しで確認を始めてもらう
			const startProbe = !state.probing && now >= state.nextProbeAt;
			if (startProbe) state.probing = true;
			return {
				action: "skip",
				reason: "open",
				until: state.nextProbeAt,
				startProbe,
			};
		}

		if (state.rateLimitedUntil > now) {
			return {
				action: "skip",
				reason: "rateLimited",
				until: state.rateLimitedUntil,
				startProbe: false,
			};
		}

		return { action: "send" };
	}

	/**
	 * 送らずに済ませる（skip）かどうかだけを、状態を変えずに調べる。
	 *
	 * @remarks
	 * 適応スロットルの前段で使う。{@link check} と違い、確認を始める印を付けない。
	 *
	 * @param host - 配送先ホスト
	 * @returns 送らずに返すなら true
	 */
	public wouldSkip(host: string): boolean {
		const state = this.hosts.get(host);
		if (state == null) return false;
		if (state.openedAt != null) return true;
		return state.rateLimitedUntil > this.opts.now();
	}

	/**
	 * 実際に送った結果を記録する。
	 *
	 * @param host - 配送先ホスト
	 * @param jobId - ジョブ ID（再送でも同じ）
	 * @param outcome - 分類した結果
	 * @returns 状態が変わった場合はそのできごと。変わらなければ null
	 */
	public recordResult(
		host: string,
		jobId: string,
		outcome: DeliverOutcome,
	): CircuitEvent | null {
		switch (outcome.kind) {
			case "success":
			case "recipientError":
			case "gone":
				// 相手のアプリが応答した（410 の閉鎖は別の仕組みで扱う）
				return this.reset(host, "delivery");

			case "rateLimited": {
				const event = this.reset(host, "delivery");
				const wait = Math.min(
					outcome.retryAfterMs ?? this.opts.baseCooldownMs,
					this.opts.maxRateLimitMs,
				);
				this.getOrCreate(host).rateLimitedUntil = this.opts.now() + wait;
				return event;
			}

			case "ambiguous":
				// 内容が原因かもしれないので数えない
				return null;

			case "hostDown":
				return this.recordHostDown(host, jobId, outcome.label);
		}
	}

	/**
	 * 復帰の確認の結果を記録する。
	 *
	 * @param host - 配送先ホスト
	 * @param alive - 相手が応答したか
	 * @param error - 失敗した場合の説明
	 * @returns 状態が変わった場合はそのできごと
	 */
	public recordProbeResult(
		host: string,
		alive: boolean,
		error?: string,
	): CircuitEvent | null {
		const state = this.hosts.get(host);
		if (state == null || state.openedAt == null) return null;

		state.probing = false;

		if (alive) return this.reset(host, "probe");

		state.cooldownMs = Math.min(state.cooldownMs * 2, this.opts.maxCooldownMs);
		state.nextProbeAt = this.opts.now() + state.cooldownMs;
		if (error) state.lastError = error;
		return null;
	}

	/**
	 * ホストの状態を、できごとを出さずに消す。
	 *
	 * @remarks
	 * 長期の停止が解除されたときに使う。停止中は配送が来ないので、ブレーカーは開いたまま残っている。
	 * 解除のできごとは長期の状態の側（state.ts）で履歴に残すので、ここでは `closed` を出さない。
	 *
	 * @param host - 配送先ホスト
	 */
	public forget(host: string): void {
		this.hosts.delete(host);
	}

	/**
	 * 不調中のサーバの一覧を返す（画面・統計用）。
	 *
	 * @returns 不調中のサーバ
	 */
	public snapshot(): OpenCircuitSnapshot[] {
		const list: OpenCircuitSnapshot[] = [];
		for (const [host, s] of this.hosts) {
			if (s.openedAt == null) continue;
			list.push({
				host,
				openedAt: s.openedAt,
				nextProbeAt: s.nextProbeAt,
				cooldownMs: s.cooldownMs,
				lastError: s.lastError,
			});
		}
		return list;
	}

	//#endregion 公開メソッド

	//#region 非公開ヘルパー

	/**
	 * `hostDown` の失敗を数え、閾値に達したら不調にする。
	 *
	 * @param host - 配送先ホスト
	 * @param jobId - ジョブ ID
	 * @param label - 失敗の説明
	 * @returns 不調になった場合はそのできごと
	 */
	private recordHostDown(
		host: string,
		jobId: string,
		label: string,
	): CircuitEvent | null {
		const state = this.getOrCreate(host);
		state.lastError = label;

		// すでに不調（不調になる前に出ていたジョブの結果）なら何もしない
		if (state.openedAt != null) return null;

		state.failingJobs.add(jobId);
		if (state.failingJobs.size < this.opts.threshold) return null;

		const now = this.opts.now();
		state.openedAt = now;
		state.cooldownMs = this.opts.baseCooldownMs;
		state.nextProbeAt = now + state.cooldownMs;
		state.probing = false;
		const failures = state.failingJobs.size;
		state.failingJobs.clear();

		return {
			type: "opened",
			host,
			failures,
			lastError: label,
			cooldownMs: state.cooldownMs,
		};
	}

	/**
	 * 健康に戻す。不調だった場合は「閉じた」できごとを返す。
	 *
	 * @param host - 配送先ホスト
	 * @param by - きっかけ
	 * @returns 不調から戻った場合はそのできごと
	 */
	private reset(host: string, by: "probe" | "delivery"): CircuitEvent | null {
		const state = this.hosts.get(host);
		if (state == null) return null;

		this.hosts.delete(host);

		if (state.openedAt == null) return null;
		return {
			type: "closed",
			host,
			openForMs: this.opts.now() - state.openedAt,
			by,
		};
	}

	/**
	 * ホストの状態を取得し、無ければ作る。上限を超えたら、不調でないものから古い順に消す。
	 *
	 * @param host - 配送先ホスト
	 * @returns 状態
	 */
	private getOrCreate(host: string): HostState {
		let state = this.hosts.get(host);
		if (state != null) return state;

		state = {
			failingJobs: new Set(),
			lastError: "",
			openedAt: null,
			nextProbeAt: 0,
			cooldownMs: 0,
			probing: false,
			rateLimitedUntil: 0,
		};
		this.hosts.set(host, state);

		if (this.hosts.size > this.opts.maxHosts) {
			for (const [key, s] of this.hosts) {
				if (key === host || s.openedAt != null) continue;
				this.hosts.delete(key);
				break;
			}
		}

		return state;
	}

	//#endregion 非公開ヘルパー
}
