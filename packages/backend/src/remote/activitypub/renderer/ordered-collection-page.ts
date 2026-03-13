/**
 * @packageDocumentation
 *
 * OrderedCollectionPage のレンダリング
 *
 * @remarks
 * - **役割**: フォロワー・フォロー・outbox 等のページネーション付きコレクションを AP 形式で返す。
 *
 * @see {@link server/activitypub/followers} フォロワー
 * @internal
 */

/**
 * OrderedCollectionPage をレンダリングする
 * @param id 自身の URL
 * @param totalItems 総アイテム数
 * @param orderedItems アイテム配列
 * @param partOf 親コレクションの URL
 * @param prev 前ページの URL（任意）
 * @param next 次ページの URL（任意）
 */
export default function (
	id: string,
	totalItems: any,
	orderedItems: any,
	partOf: string,
	prev?: string,
	next?: string,
) {
	const page = {
		id,
		partOf,
		type: "OrderedCollectionPage",
		totalItems,
		orderedItems,
	} as any;

	if (prev) page.prev = prev;
	if (next) page.next = next;

	return page;
}
