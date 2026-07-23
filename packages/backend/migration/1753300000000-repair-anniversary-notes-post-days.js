/**
 * 周年バッジ用 notesPostDays の修復マイグレーション。
 *
 * @remarks
 * - `authenticate.ts` の `AUTH_USER_SELECT` に `notesPostDays` 等を含め忘れていたバグにより、
 *   投稿時フック（`services/note/create.ts`）が `undefined + 1 = NaN` を計算し、
 *   `Users.update` で NaN を書き込もうとしていた期間がある（NOT NULL integer 列のため
 *   DB 側で拒否され、呼び出し元の catch でエラーが握り潰されていた可能性が高いが、値のズレを
 *   確実に解消するため念のため再計算して補正する）。
 * - 現存ノートの distinct 投稿日数を再計算し、既存の値と異なるローカルユーザーのみ更新する
 *   （1753200000000-add-anniversary-badge.js のバックフィルと同一条件）。
 * - `notifiedAnniversaryLevel` はここでは触らない（既に通知済みのレベルを維持する）。
 */
export class repairAnniversaryNotesPostDays1753300000000 {
	constructor() {
		this.name = "repairAnniversaryNotesPostDays1753300000000";
	}

	async up(queryRunner) {
		await queryRunner.query(`
			UPDATE "user" u
			SET "notesPostDays" = sub.days
			FROM (
				SELECT n."userId" AS uid, count(DISTINCT date_trunc('day', n."createdAt")) AS days
				FROM "note" n
				WHERE n.visibility <> 'specified'
					AND 'misshaialert' <> ALL(n.tags)
				GROUP BY n."userId"
			) sub
			WHERE u.id = sub.uid AND u.host IS NULL AND u."notesPostDays" <> sub.days
		`);
	}

	async down(queryRunner) {
		// 再計算による補正のため、意味のある down 操作はない
	}
}
