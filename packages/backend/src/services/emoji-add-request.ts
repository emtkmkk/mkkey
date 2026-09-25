/**
 * @packageDocumentation
 *
 * 絵文字の追加申請（emoji_add_request）の共通処理のうち、DB や通知に触れるもの。
 *
 * @remarks
 * 申請・再申請・審査（承認／直して承認／修正のお願い／却下）の各 API から使う。
 * - 申請者・管理者への通知（通知の種類 emojiRequest。{@link "@/services/emoji-request-notification"} を使う）
 * - API で返す形（{@link packEmojiAddRequest}）
 * 入力の検査や値の組み立ては {@link "@/misc/emoji-add-request-fields"} にあり、ここからまとめて再公開している
 * （各 API はこのファイルだけを import すればよい）。
 * OPTIMIZE: packEmojiAddRequest は 1 件ずつドライブのファイルを引く。一覧は最大 100 件なので今は困らないが、増えたらまとめて引く。
 *
 * @internal
 */
import { DriveFiles } from "@/models/index.js";
import {
	notifyEmojiRequestRequester,
	notifyEmojiRequestReviewers,
} from "@/services/emoji-request-notification.js";
import { pickEditableFields } from "@/misc/emoji-add-request-fields.js";
import type { EmojiAddRequest } from "@/models/entities/emoji-add-request.js";

export * from "@/misc/emoji-add-request-fields.js";

// #region 通知

/**
 * 申請の画像の URL を返す（通知のアイコンに使う）。
 *
 * @param fileId - 申請の画像
 * @returns 公開用の URL、または null
 */
async function getRequestImageUrl(fileId: string | null): Promise<string | null> {
	if (fileId == null) return null;
	const file = await DriveFiles.findOneBy({ id: fileId });
	return file ? (file.webpublicUrl ?? file.url) : null;
}

/**
 * 追加申請について、申請者に通知する（通知の種類は emojiRequest。押すと自分の申請の詳細が開く）。
 *
 * @param r - 申請（id・申請者・画像）
 * @param header - 見出し
 * @param body - 本文
 * @internal
 */
export function notifyAddRequestRequester(
	r: Pick<EmojiAddRequest, "id" | "requesterId" | "fileId">,
	header: string,
	body: string,
): void {
	void (async () => {
		notifyEmojiRequestRequester(r.requesterId, {
			kind: "add",
			requestId: r.id,
			header,
			body,
			icon: await getRequestImageUrl(r.fileId),
		});
	})();
}

/**
 * 追加申請について、管理者に通知する（押すと審査画面のその申請が開く）。
 *
 * @param r - 申請（id・画像・申請者）
 * @param header - 見出し
 * @param body - 本文
 * @internal
 */
export function notifyAddRequestReviewers(
	r: Pick<EmojiAddRequest, "id" | "fileId" | "requesterId">,
	header: string,
	body: string,
): void {
	void (async () => {
		notifyEmojiRequestReviewers({
			kind: "add",
			requestId: r.id,
			header,
			body,
			icon: await getRequestImageUrl(r.fileId),
		}, r.requesterId);
	})();
}

// #endregion

// #region 返す形

/**
 * API で返す形にする。
 *
 * @remarks
 * 画像の URL と幅・高さはドライブのファイルから取る（審査画面の警告に使う）。
 * 申請者の情報は、審査画面で名前を出すための最小限だけ返す。
 *
 * @param r - 申請（requester を読み込んであればユーザー名も返す）
 * @returns 返す形
 * @internal
 */
export async function packEmojiAddRequest(r: EmojiAddRequest) {
	const file = r.fileId ? await DriveFiles.findOneBy({ id: r.fileId }) : null;
	const props = (file?.properties ?? {}) as { width?: number; height?: number };
	return {
		id: r.id,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString(),
		status: r.status,
		source: r.source,
		requesterId: r.requesterId,
		requester: r.requester
			? { id: r.requester.id, username: r.requester.username, host: r.requester.host }
			: null,
		file: file
			? {
					id: file.id,
					url: file.webpublicUrl ?? file.url,
					type: file.type,
					width: props.width ?? null,
					height: props.height ?? null,
					size: file.size,
			  }
			: null,
		imageProcessed: r.imageProcessed,
		originalWidth: r.originalWidth,
		originalHeight: r.originalHeight,
		...pickEditableFields(r),
		message: r.message,
		proposal: r.proposal,
		reviewComment: r.reviewComment,
		processedAt: r.processedAt?.toISOString() ?? null,
		approvedEmojiId: r.approvedEmojiId,
		history: r.history ?? [],
	};
}

// #endregion
