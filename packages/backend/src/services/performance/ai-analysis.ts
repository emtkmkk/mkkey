/**
 * @packageDocumentation
 *
 * パフォーマンスインシデントを OpenAI 互換 API で分析し、原因と対策のテキストを返すサービス。
 * 管理者が手動で「AIで分析する」を実行したときに呼び出される。
 *
 * @internal
 */

import fetch from "node-fetch";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getAgentByUrl } from "@/misc/fetch.js";
import config from "@/config/index.js";

const SYSTEM_PROMPT = `あなたはMisskey（分散型SNS/ActivityPub）サーバーの運用に精通したインフラエンジニアです。
パフォーマンスインシデントのデータを受け取り、原因の分析と具体的な対策を日本語で回答してください。

このサーバーは mkkey（Misskeyのフォーク）を使用しています。
ソースコードは https://github.com/emtkmkk/mkkey で公開されています。

主な技術スタック：
- ランタイム: Node.js（TypeScript）
- Webフレームワーク: Koa.js
- データベース: PostgreSQL（TypeORMを使用）
- キャッシュ/キュー: Redis + Bull
- フロントエンド: Vue.js 3
- 連合プロトコル: ActivityPub

アーキテクチャの特徴：
- APIエンドポイントは packages/backend/src/server/api/endpoints/ 配下に定義
- タイムライン系のクエリ（notes/timeline, notes/local-timeline 等）は複雑なJOINとサブクエリを含む
- ActivityPubの配送は Bull キューで非同期処理（deliver / inbox の2種類）
- キュー処理にはアダプティブスロットル機構がある（packages/backend/src/queue/adaptive-queue-throttle.ts）
- 配送失敗はリモートエラー/ローカルエラーに自動分類される（packages/backend/src/queue/delayed-retry-reason.ts）
- DBコネクションプールは TypeORM のデフォルト設定（config.db.extra で上書き可能）
- パフォーマンス監視は packages/backend/src/daemons/health-stats.ts で5秒ごとに実行

回答のルール：
- 専門用語を使う場合は必ず簡単な説明を添えること
- 推測ではなくデータに基づいた分析を行うこと
- 対策は具体的な操作手順を含めること（コマンド例やSQL、設定変更箇所など）
- 上記のアーキテクチャを踏まえ、該当するソースコードのファイルパスがあれば言及すること
- 「考えられる原因」「推奨される対策」「緊急度」の3セクションで回答すること`;

function buildUserPrompt(
	severity: string,
	metric: string,
	value: number,
	stats: Record<string, unknown>,
): string {
	const statsJson = JSON.stringify(stats, null, 2);
	return `以下のパフォーマンスインシデントを分析してください。

## インシデント概要
- 重大度: ${severity}
- 閾値を超えたメトリック: ${metric}
- 値: ${value}

## サーバー状態
${statsJson}

## メトリックの説明
- cpuUsage: CPU使用率（%）
- memoryUsage: OS全体のメモリ使用率（%）
- heapStats: Node.jsプロセスのヒープメモリ状態（MB単位、heapUsagePercent=使用率）
- dbLatencyMs: PostgreSQLへのSELECT 1の応答時間（ms）
- dbPoolStats: DB接続プールの状態（total=全接続数, active=実行中, idle=待機中, idleInTransaction=トランザクション中の待機）
- redisLatencyMs: RedisへのPINGの応答時間（ms）
- eventLoopLagMs: Node.jsイベントループの平均遅延（ms）
- queueWaiting: ジョブキューの待ち数（ActivityPub配送・受信の合計）
- queuePressure: キュー滞留度（waiting / throughput、高いほど詰まっている）
- queueThroughputPerSec: キュー処理速度（件/秒）
- activeApiRequests: 同時処理中のAPIリクエスト数
- apiLatencyAvgMs: API応答時間の平均（ms、5分間ウィンドウ）
- apiLatencyP50Ms: API応答時間の中央値（ms）
- apiLatencyP95Ms: API応答時間の95パーセンタイル（ms）
- apiLatencySampleCount: API応答時間のサンプル数
- slowestEndpoints: 応答が遅いAPIエンドポイント上位5件（endpoint=名前, avgMs=平均, p95Ms=P95, count=呼出回数）
  - エンドポイントのソースコードは https://github.com/emtkmkk/mkkey/tree/develop/packages/backend/src/server/api/endpoints/ 配下にある
  - 例: notes/timeline → packages/backend/src/server/api/endpoints/notes/timeline.ts
- recentSlowCalls: 直近の遅い個別APIコール（endpoint=名前, responseMs=応答時間, at=発生時刻）
- federationStats: 連合の状態（notRespondingCount=応答なしサーバー数, deliverDelayed/inboxDelayed=遅延ジョブの原因内訳）
  - remote: 相手サーバーの問題（接続拒否、タイムアウト、5xxエラー等）
  - local: 自サーバーの問題（TypeError等のバグ、mutexの競合等）
  - unknown: 分類できなかったエラー
- longRunningQueries: 5秒以上実行中のDBクエリ一覧
- longRunningQueryCount: 上記の件数

## 回答形式

### 考えられる原因
（データから読み取れる主な原因を優先度順に箇条書き。各項目に根拠となるデータ値を引用すること）

### 推奨される対策
（具体的な操作手順を優先度順に箇条書き。可能であればコマンド例やSQL、設定ファイルの変更箇所を含めること。関連するソースコードがある場合は https://github.com/emtkmkk/mkkey/blob/develop/ のパスで言及すること）

### 緊急度
（「即座に対応が必要」「早めに対応が望ましい」「次回メンテナンス時に対応」のいずれかを選択し、理由を1行で述べること）`;
}

const OPENAI_TIMEOUT_MS = 30000;

/**
 * パフォーマンスインシデントの内容を OpenAI 互換 API に送り、分析結果（Markdown テキスト）を返す。
 * APIキーが未設定またはリクエスト失敗時は null を返す。
 *
 * @param severity - インシデントの重大度（warn / critical）
 * @param metric - 閾値を超えたメトリック名
 * @param value - 計測値
 * @param stats - 記録時の stats スナップショット（JSON化してプロンプトに含める）
 * @returns 分析結果の Markdown 文字列。失敗時は null
 */
export async function analyzePerformanceIncident(
	severity: string,
	metric: string,
	value: number,
	stats: Record<string, unknown>,
): Promise<string | null> {
	const meta = await fetchMeta();

	if (!meta.openaiApiKey || meta.openaiApiKey === "") {
		return null;
	}

	const baseUrl = (meta.openaiBaseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
	const model = meta.openaiModel ?? "gpt-4o-mini";
	const endpoint = `${baseUrl}/chat/completions`;
	const url = new URL(endpoint);
	const agent = getAgentByUrl(url);

	const prompt = buildUserPrompt(severity, metric, value, stats);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

	try {
		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${meta.openaiApiKey}`,
				"User-Agent": config.userAgent,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: prompt },
				],
				temperature: 0.3,
				max_tokens: 1500,
			}),
			agent,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!res.ok) {
			return null;
		}

		const json = (await res.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const content = json.choices?.[0]?.message?.content;
		return typeof content === "string" ? content : null;
	} catch {
		clearTimeout(timeoutId);
		return null;
	}
}
