/**
 * @packageDocumentation
 * 時刻表示の更新予約を一つのタイマーへ集約する。
 * @remarks 各表示の更新間隔は維持し、非表示中は予約を止めて復帰時に実時刻で更新する。
 * @see {@link registerTimeTick}
 * @internal
 */

/** 時刻表示一つの次回更新。 @remarks 画面側が解除したら保持しない。 @internal */
interface TimeTick {
	callback: () => number;
	nextAt: number;
}

/** 現在表示に使われている時刻更新。 @remarks キャッシュ退避中の画面は登録しない。 @internal */
const ticks = new Set<TimeTick>();
/** 全時刻表示で共有する予約。 @remarks 登録0件または非表示中はnull。 @internal */
let timeoutId: number | null = null;

/**
 * 時刻を更新し、表示側が指定した次の期限を設定する。
 * @remarks 更新例外を隠さず、例外時の無限再予約だけを防ぐ。
 * @param tick - 更新する表示
 * @param now - performance.nowによる期限の基準時刻
 * @returns なし
 * @throws RangeError - 更新間隔が正の有限値でない場合
 * @internal
 */
function updateTick(tick: TimeTick, now: number): void {
	tick.nextAt = now + 300_000;
	const delay = tick.callback();
	if (!Number.isFinite(delay) || delay <= 0) throw new RangeError("Time tick interval must be positive");
	tick.nextAt = now + delay;
}

/**
 * 次に必要な更新時刻へ一度だけ予約する。
 * @remarks 過去の未実行回数を再生せず、期限に達した表示だけ更新する。
 * @returns なし
 * @internal
 */
function schedule(): void {
	if (timeoutId !== null) window.clearTimeout(timeoutId);
	timeoutId = null;
	if (ticks.size === 0 || document.visibilityState !== "visible") return;
	let earliest = Infinity;
	for (const tick of ticks) earliest = Math.min(earliest, tick.nextAt);
	// OS時計の補正で期限が遠のかないよう、予約には単調増加する時計を使う。
	timeoutId = window.setTimeout(run, Math.max(0, earliest - performance.now()));
}

/**
 * 期限に達した表示を更新する。
 * @remarks 一つの表示で例外が起きても、残る表示の次回予約は行う。
 * @returns なし
 * @internal
 */
function run(): void {
	timeoutId = null;
	if (document.visibilityState !== "visible") return;
	const now = performance.now();
	try {
		for (const tick of [...ticks]) {
			if (ticks.has(tick) && tick.nextAt <= now) updateTick(tick, now);
		}
	} finally {
		schedule();
	}
}

/**
 * 非表示中の予約を止め、復帰時には一度だけ実時刻へ追従する。
 * @remarks カウントダウンも経過時間から再計算し、隠れていた秒数分の処理を流さない。
 * @returns なし
 * @internal
 */
function onVisibilityChange(): void {
	try {
		if (document.visibilityState === "visible") {
			const now = performance.now();
			for (const tick of [...ticks]) if (ticks.has(tick)) updateTick(tick, now);
		}
	} finally {
		schedule();
	}
}

/**
 * 時刻表示を登録して、解除関数を返す。
 * @remarks 初回は即時更新する。同じ解除関数は複数回呼んでもよい。
 * @param callback - 実時刻を反映し、次の更新までのミリ秒を返す処理
 * @returns 登録を解除する関数
 * @internal
 */
export function registerTimeTick(callback: () => number): () => void {
	const tick: TimeTick = { callback, nextAt: performance.now() };
	if (ticks.size === 0) document.addEventListener("visibilitychange", onVisibilityChange);
	ticks.add(tick);
	const stop = () => {
		if (!ticks.delete(tick)) return;
		if (ticks.size === 0) document.removeEventListener("visibilitychange", onVisibilityChange);
		schedule();
	};
	try {
		if (document.visibilityState === "visible") updateTick(tick, performance.now());
	} catch (error) {
		stop();
		throw error;
	}
	schedule();
	return stop;
}
