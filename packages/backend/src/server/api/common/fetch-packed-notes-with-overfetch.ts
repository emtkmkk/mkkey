/**
 * @packageDocumentation
 *
 * タイムライン系 API で pack 落ちを吸収しつつ `limit` 件を返すための共通取得ループ。
 *
 * @remarks
 * - pack 後に件数が減るため 1.5 倍 overfetch し、不足時は同一リクエスト内で追い取る。
 * - 追い取りは OFFSET ではなく id キーセットカーソル（{@link makePaginationQuery} の ORDER BY と整合）。
 * - NOTE: 2 ラウンド目以降の `take` は不足件数ベース（`floor(remaining * 1.5)`）とする。
 * - 標準モードでは不足件数ぶんだけまとめて pack し、pack 落ちで足りなければ同一バッチの残りを追加で pack する。
 *   `limit` 到達後の残りは pack しない。
 *   NOTE: 以前は 1 件ずつ `packMany([note])` を呼んでいたため、packMany 冒頭の一括取得
 *   （relation・profile・file・絵文字など）がノート数ぶん繰り返され、1 リクエストで 100 本超のクエリになっていた。
 *
 * @see {@link makePaginationQuery}
 * @internal
 */

import type { SelectQueryBuilder } from "typeorm";
import { Notes } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import type { Packed } from "@/misc/schema.js";
import { buildUserAndNoteMapsFromNotes } from "./build-note-pack-hint.js";
import {
	applyKeysetCursorToQuery,
	isPaginationQueryAsc,
	type TimelinePaginationParams,
} from "./timeline-pagination-cursor.js";

export type { TimelinePaginationParams } from "./timeline-pagination-cursor.js";
export { applyKeysetCursorToQuery, isPaginationQueryAsc } from "./timeline-pagination-cursor.js";

/** {@link fetchPackedNotesWithOverfetch} の onBatchPacked 戻り値 */
export type FetchPackedNotesBatchResult = {
	/** true のとき DB 追い取りを打ち切り {@link result} を返す */
	done: boolean;
	/** done 時、または DB 枯渇時に返す配列（未指定なら標準の truncate 結果） */
	result?: Packed<"Note">[];
	/** 次ラウンドの overfetch 計算用。未指定時は `limit - 累積件数` */
	remaining?: number;
};

/** {@link fetchPackedNotesWithOverfetch} のオプション */
export type FetchPackedNotesWithOverfetchOptions<TState = undefined> = {
	query: SelectQueryBuilder<Note>;
	limit: number;
	pagination: TimelinePaginationParams;
	me?: { id: User["id"] } | null;
	/** クエリエイリアス（既定: `note`） */
	alias?: string;
	/** カーソル用バインド名（クエリ複製時の衝突回避用） */
	cursorParameterName?: string;
	onError?: (error: unknown) => never;
	/** LTL 等の事後フィルタ。指定時は標準の found 蓄積ではなくフック側で件数管理 */
	onBatchPacked?: (args: {
		packedNotes: Packed<"Note">[];
		limit: number;
		me?: { id: User["id"] } | null;
		state: TState;
	}) => FetchPackedNotesBatchResult;
	createState?: () => TState;
};

/**
 * overfetch + キーセットカーソルで pack 済みノートを `limit` 件まで取得する。
 *
 * @param opts - クエリ・limit・ページング・任意フック
 * @returns pack 済みノート（最大 `limit` 件）
 *
 * @remarks
 * - DB からは直前バッチの **最後の raw 行 id** をカーソルに使う（pack 落ちと OFFSET 積み上げの位置ずれを防ぐ）。
 * - `onBatchPacked` 未指定時は packMany 結果をそのまま蓄積し、末尾で `slice(0, limit)` する。
 */
export async function fetchPackedNotesWithOverfetch<TState = undefined>(
	opts: FetchPackedNotesWithOverfetchOptions<TState>,
): Promise<Packed<"Note">[]> {
	const {
		query,
		limit,
		pagination,
		me,
		alias = "note",
		cursorParameterName = "timelineMoreCursor",
		onError,
		onBatchPacked,
		createState,
	} = opts;

	const found: Packed<"Note">[] = [];
	let fetchCursor: string | undefined;
	const paginationAsc = isPaginationQueryAsc(pagination);
	const state = createState?.() as TState;
	let hookRemaining: number | undefined;

	const run = async (): Promise<Packed<"Note">[]> => {
		while (true) {
			if (!onBatchPacked && found.length >= limit) {
				break;
			}

			const remaining =
				hookRemaining ??
				(onBatchPacked ? limit : limit - found.length);
			const take = Math.max(1, Math.floor(remaining * 1.5));

			const qb = query.clone();
			if (fetchCursor !== undefined) {
				applyKeysetCursorToQuery(
					qb,
					alias,
					fetchCursor,
					paginationAsc,
					cursorParameterName,
				);
			}

			const notes = await qb.take(take).getMany();
			if (notes.length === 0) {
				break;
			}

			const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(notes);
			const packHint = { userMap, noteMap };

			/** 標準モードは不足件数ぶんをまとめて pack し、limit 到達後の残りは pack しない。LTL フックはバッチ全件処理が必要。 */
			let packedNotes: Packed<"Note">[] = [];
			if (onBatchPacked) {
				packedNotes = await Notes.packMany(notes, me, {
					_hint_: packHint,
				});
			} else {
				// packMany は順序を保ち、pack に失敗したノートだけを除くので、
				// 不足分（limit - found.length）を切り出して渡せば 1 件ずつ呼ぶのと同じ結果になる。
				// pack 落ちで足りなかったときだけ、同じバッチの続きを追加で pack する。
				let offset = 0;
				while (found.length < limit && offset < notes.length) {
					const chunk = notes.slice(offset, offset + (limit - found.length));
					offset += chunk.length;
					found.push(
						...(await Notes.packMany(chunk, me, {
							_hint_: packHint,
						})),
					);
				}
			}

			fetchCursor = notes[notes.length - 1]!.id;

			if (onBatchPacked) {
				const batchResult = onBatchPacked({
					packedNotes,
					limit,
					me,
					state,
				});
				hookRemaining = batchResult.remaining;

				if (batchResult.done) {
					return (
						batchResult.result ??
						found.slice(0, limit)
					);
				}

				if (notes.length < take) {
					return batchResult.result ?? found.slice(0, limit);
				}

				continue;
			}

			if (found.length >= limit) {
				break;
			}

			if (notes.length < take) {
				break;
			}
		}

		return found.slice(0, limit);
	};

	try {
		return await run();
	} catch (error) {
		if (onError) {
			onError(error);
		}
		throw error;
	}
}
