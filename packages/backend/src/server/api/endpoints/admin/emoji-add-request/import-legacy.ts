/**
 * @packageDocumentation
 *
 * Google フォームで受け付けていた過去の追加申請を、審査待ちの追加申請として取り込む（管理者向け・一時的）。
 *
 * @remarks
 * TEMP: 移行が終わったら、このファイルと endpoints.ts の登録、`scripts/emoji-legacy-import/` を削除する（計画書の手順 12）。
 *
 * 取り込む内容は手元のスクリプト（`scripts/emoji-legacy-import/build.mjs`）が、回答シートと申請チャンネルのノートから作る。
 * 管理者が API コンソールに貼り付けて呼ぶ想定（トークンをスクリプトに持たせないため）。
 * - 画像は申請チャンネルのノートに添付された、ドライブのファイルを指定する。申請画面と同じく、持ち主なし（サーバー側）へ複製して使う
 * - 申請者はローカルユーザーの username で指定する。見つからなければ申請者なし（null）で取り込む（D1）
 * - 申請の日時はフォームの送信時刻にする。経緯にも「Google フォームから移行」として残す
 * - 取り込んだことは通知しない（D4）
 * - 同じ名前・同じ申請者の取り込み済み（source = legacy）の申請があれば飛ばす（同じ内容を 2 回送っても重複しないように）
 * - 1 件ずつ処理し、失敗したものは理由を返して次へ進む（全体は止めない）
 * NB: 旧フォームには「自分がモチーフか」の質問が無かったので、文字だけの絵文字でなければ「いいえ」として取り込む
 * （未回答のままだと承認時に止まるため。取り込み後に審査画面で直せる）。
 *
 * @internal
 */
import { IsNull } from "typeorm";
import define from "../../../define.js";
import { DriveFiles, EmojiAddRequests, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import {
	applyAskContactRule,
	emojiAddRequestFieldsParamDef,
	findEmojiAddRequestProblem,
	normalizeEmojiAddRequestFields,
} from "@/services/emoji-add-request.js";
import type { EmojiAddRequestEditableFields } from "@/models/entities/emoji-add-request.js";

export const meta = {
	tags: ["admin", "emoji-add-request"],
	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:emoji",
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			created: { type: "array", items: { type: "object" } },
			skipped: { type: "array", items: { type: "object" } },
		},
	},
} as const;

/** 画像（fileId）はノートの添付を別に受け取るので、項目の定義からは外す */
const { fileId: _fileId, ...fieldsParamDef } = emojiAddRequestFieldsParamDef;

export const paramDef = {
	type: "object",
	properties: {
		entries: {
			type: "array",
			minItems: 1,
			maxItems: 100,
			items: {
				type: "object",
				properties: {
					...fieldsParamDef,
					/** フォームの送信時刻（ISO 8601） */
					submittedAt: { type: "string" },
					/** 申請者のローカルユーザー名（分からなければ null） */
					requesterUsername: { type: "string", nullable: true },
					/** 申請チャンネルのノートに添付された画像（ドライブのファイル） */
					noteFileId: { type: "string", format: "misskey:id" },
					/** フォームの「他に特に書くことがあれば入力」 */
					message: { type: "string", nullable: true, maxLength: 4096 },
				},
				required: ["name", "submittedAt", "noteFileId"],
			},
		},
	},
	required: ["entries"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const created: { name: string; id: string }[] = [];
	const skipped: { name: string; reason: string }[] = [];

	for (const e of ps.entries) {
		// #region 申請者と重複の確認
		const requester = e.requesterUsername
			? await Users.findOneBy({ usernameLower: e.requesterUsername.toLowerCase(), host: IsNull() })
			: null;
		const input = normalizeEmojiAddRequestFields(e);
		const name = input.name ?? "";
		const dup = await EmojiAddRequests.findOneBy({
			name,
			source: "legacy",
			requesterId: requester ? requester.id : IsNull(),
		});
		if (dup) {
			skipped.push({ name, reason: "取り込み済み" });
			continue;
		}
		// #endregion

		// #region 入力の組み立てと検査
		const isTextOnly = input.isTextOnly ?? false;
		// fileId は仮にノートの画像を入れておき、保存するときに複製した画像へ差し替える
		const fields: EmojiAddRequestEditableFields = applyAskContactRule({
			name,
			alternateName: input.alternateName ?? null,
			ruby: input.ruby ?? null,
			description: input.description ?? null,
			category: input.category ?? null,
			aliases: input.aliases ?? [],
			sensitive: input.sensitive ?? false,
			isTextOnly,
			motifSelf: isTextOnly ? null : false,
			motifUserMode: null,
			copyPermission: input.copyPermission ?? "none",
			askContact: input.askContact ?? null,
			licenseName: input.licenseName ?? null,
			creator: input.creator ?? null,
			usageInfo: input.usageInfo ?? null,
			copyrightNotice: input.copyrightNotice ?? null,
			creditText: input.creditText ?? null,
			relatedLinks: input.relatedLinks ?? [],
			fileId: e.noteFileId,
		});
		const problem = findEmojiAddRequestProblem(fields);
		// 条件付きで使用情報が無いものは、フォームでは通っていたので取り込む（審査で直す）。名前が使えないものだけ飛ばす
		if (problem === "invalidName") {
			skipped.push({ name, reason: "絵文字名が使えない" });
			continue;
		}
		const submittedAt = new Date(e.submittedAt);
		if (Number.isNaN(submittedAt.getTime())) {
			skipped.push({ name, reason: "送信時刻が読めない" });
			continue;
		}
		// #endregion

		// #region 画像の複製
		const noteFile = await DriveFiles.findOneBy({ id: e.noteFileId });
		if (noteFile == null || !noteFile.type.startsWith("image/")) {
			skipped.push({ name, reason: "画像が見つからない" });
			continue;
		}
		let copiedId: string;
		try {
			copiedId = (await uploadFromUrl({ url: noteFile.url, user: null, force: true })).id;
		} catch {
			skipped.push({ name, reason: "画像の複製に失敗" });
			continue;
		}
		// #endregion

		const id = genId(submittedAt);
		await EmojiAddRequests.insert({
			id,
			createdAt: submittedAt,
			updatedAt: new Date(),
			status: "pending",
			source: "legacy",
			requesterId: requester?.id ?? null,
			imageProcessed: false,
			originalWidth: null,
			originalHeight: null,
			...fields,
			fileId: copiedId,
			message: e.message?.trim() || null,
			proposal: null,
			reviewComment: null,
			reviewerId: null,
			processedAt: null,
			approvedEmojiId: null,
			history: [
				{
					at: submittedAt.toISOString(),
					by: requester?.id ?? null,
					action: "created",
					comment: "Google フォームから移行",
				},
			],
		});
		created.push({ name, id });
	}

	return { created, skipped };
});
