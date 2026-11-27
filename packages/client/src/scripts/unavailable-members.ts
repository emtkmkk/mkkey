/**
 * @packageDocumentation
 *
 * リストやグループのメンバー一覧で、表示できないメンバー（削除済み・凍結中など）も行として残すための処理。
 *
 * @remarks
 * - メンバーの情報は `users/show`（userIds 指定）で取るが、`users/show` は削除済みの人を返さず、
 *   管理者でなければ凍結中の人も返さない。そのまま並べると、その人は画面に出ず、外すこともできない。
 * - 返ってこなかった ID は {@link UnavailableMember} として並べ、外すボタンだけを出せるようにする。
 *
 * @internal
 */

/**
 * 情報を取れなかったメンバー（削除済み・凍結中など）を表す行。
 *
 * @remarks
 * `unavailable` が true のものは、アバターや名前の部品に渡さないこと（必要な項目が無い）。
 *
 * @internal
 */
export type UnavailableMember = { id: string; unavailable: true };

/**
 * メンバーの ID の並びに合わせて、取れたユーザーと、取れなかったメンバーの行を並べる。
 *
 * @param ids - リストやグループに入っているユーザー ID（この順に並べる）
 * @param users - `users/show` で取れたユーザー
 * @returns ID の順に並べた一覧。取れなかった ID は {@link UnavailableMember} になる
 *
 * @example
 * ```ts
 * users = withUnavailableMembers(list.userIds, await os.api("users/show", { userIds: list.userIds }));
 * ```
 *
 * @internal
 */
export function withUnavailableMembers<T extends { id: string }>(
	ids: string[],
	users: T[],
): (T | UnavailableMember)[] {
	const byId = new Map(users.map((user) => [user.id, user]));
	return ids.map(
		(id) => byId.get(id) ?? ({ id, unavailable: true } as UnavailableMember),
	);
}
