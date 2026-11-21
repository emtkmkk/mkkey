/**
 * @packageDocumentation
 *
 * 配送先サーバの状態（停止の種類・履歴のできごと）を画面に出すための表示名と書式。
 *
 * @remarks
 * - サーバ情報ページの「履歴」タブ、ジョブキュー画面の「配送先」タブ、サーバ一覧で共通に使う。
 * - 管理画面だけで使うので、翻訳ファイルではなく日本語で直接書いている（admin/performance.vue と同じ扱い）。
 * - 値の意味は backend の `models/entities/instance.ts`（停止状態）と `instance-health-log.ts`（できごと）を参照。
 *
 * @internal
 */

/**
 * 配信の停止状態。
 *
 * @internal
 */
export type SuspensionState =
	| "none"
	| "manuallySuspended"
	| "goneSuspended"
	| "autoSuspendedForNotResponding";

/**
 * 停止状態の表示名。
 *
 * @internal
 */
export const suspensionStateLabels: Record<SuspensionState, string> = {
	none: "配送中",
	manuallySuspended: "手動停止",
	goneSuspended: "閉鎖停止",
	autoSuspendedForNotResponding: "自動停止",
};

/**
 * 停止状態の説明（ツールチップ・補足用）。
 *
 * @internal
 */
export const suspensionStateDescriptions: Record<SuspensionState, string> = {
	none: "配信しています。",
	manuallySuspended: "管理者が停止しました。自動では解除されません。",
	goneSuspended:
		"サーバ自体が 410（閉鎖）を返したため停止しました。こちらからは確認しませんが、相手から配送が届けば解除されます。",
	autoSuspendedForNotResponding:
		"不通が 3 日続いたため自動で停止しました。定期的に生存を確認し、応答するか相手から配送が届けば解除されます。",
};

/**
 * 履歴のできごとの表示名。
 *
 * @internal
 */
export const healthEventLabels: Record<string, string> = {
	circuitOpened: "一時停止",
	circuitClosed: "一時停止の解除",
	autoSuspended: "自動停止",
	gone: "閉鎖停止",
	unsuspendedByProbe: "解除（生存確認）",
	unsuspendedByInbox: "解除（受信）",
	manualSuspended: "手動停止",
	manualUnsuspended: "手動解除",
	migrated: "移行",
};

/**
 * 履歴のきっかけの表示名。
 *
 * @internal
 */
export const healthSourceLabels: Record<string, string> = {
	deliver: "配送",
	inbox: "受信",
	probe: "生存確認",
	admin: "管理者",
	migration: "マイグレーション",
};

/**
 * 履歴の 1 行（API `admin/federation/health-logs` の応答）。
 *
 * @internal
 */
export type HealthLog = {
	id: string;
	createdAt: string;
	host: string;
	event: string;
	fromState: SuspensionState | null;
	toState: SuspensionState | null;
	source: string;
	reason: string | null;
	detail: Record<string, unknown>;
	actor: { id: string; username: string } | null;
};

/**
 * できごとが「悪くなった」側か（色分け用）。
 *
 * @param event - できごとの種類
 * @returns 停止・一時停止なら true
 * @internal
 */
export function isWorseningEvent(event: string): boolean {
	return ["circuitOpened", "autoSuspended", "gone", "manualSuspended"].includes(
		event,
	);
}

/**
 * 履歴 1 行の補足（何がきっかけで、どうなったか）を短い文にする。
 *
 * @param log - 履歴
 * @returns 例: 「配送: 異なる 5 件の配送が続けて失敗（ECONNREFUSED）」
 * @internal
 */
export function describeHealthLog(log: HealthLog): string {
	const parts: string[] = [];
	const source = healthSourceLabels[log.source] ?? log.source;
	parts.push(log.actor ? `${source} @${log.actor.username}` : source);

	if (log.reason) {
		parts.push(log.reason);
	} else if (log.event === "circuitClosed" && typeof log.detail.openForMs === "number") {
		parts.push(`${formatDuration(log.detail.openForMs)}後に復帰`);
	} else if (log.event === "unsuspendedByInbox" && log.detail.activityType) {
		parts.push(`${String(log.detail.activityType)} を受信`);
	}

	return parts.join(": ");
}

/**
 * ミリ秒を「5 分」「3 時間」「2 日」のような短い日本語にする。
 *
 * @param ms - ミリ秒
 * @returns 文字列
 * @internal
 */
export function formatDuration(ms: number): string {
	const min = Math.round(ms / 60000);
	if (min < 60) return `${min} 分`;
	const hours = Math.round(min / 60);
	if (hours < 48) return `${hours} 時間`;
	return `${Math.round(hours / 24)} 日`;
}
