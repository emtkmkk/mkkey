/**
 * @packageDocumentation
 *
 * 絵文字の追加申請（emoji_add_request）の共通処理のうち、DB や通知に触れるもの。
 *
 * @remarks
 * 申請・再申請・審査（承認／直して承認／修正のお願い／却下）の各 API から使う。
 * - 申請者・管理者への通知
 * - API で返す形（{@link packEmojiAddRequest}）
 * 入力の検査や値の組み立ては {@link "@/misc/emoji-add-request-fields"} にあり、ここからまとめて再公開している
 * （各 API はこのファイルだけを import すればよい）。
 * OPTIMIZE: packEmojiAddRequest は 1 件ずつドライブのファイルを引く。一覧は最大 100 件なので今は困らないが、増えたらまとめて引く。
 *
 * @internal
 */
import { IsNull } from "typeorm";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { createNotification } from "@/services/create-notification.js";
import { DriveFiles, Users } from "@/models/index.js";
import { pickEditableFields } from "@/misc/emoji-add-request-fields.js";
import type { EmojiAddRequest } from "@/models/entities/emoji-add-request.js";
import type { User } from "@/models/entities/user.js";

export * from "@/misc/emoji-add-request-fields.js";

// #region 通知

/** 通知の見出しの前に付けるアイコン URL（サーバーのアイコン） */
async function getInstanceIconUrl(): Promise<string | undefined> {
	const meta = await fetchMeta();
	if (meta?.iconUrl == null) return undefined;
	if (meta.iconUrl.startsWith("http")) return meta.iconUrl;
	return `${config.url}${meta.iconUrl.startsWith("/") ? "" : "/"}${meta.iconUrl}`;
}

/**
 * 管理者（isAdmin のローカルユーザー）全員に通知する。
 *
 * @remarks
 * インポート申請と同じく、モデレーターには送らない。送信は待たずに裏で行う。
 *
 * @param header - 見出し
 * @param body - 本文
 * @internal
 */
export function notifyEmojiRequestAdmins(header: string, body: string): void {
	setImmediate(async () => {
		const admins = await Users.find({ where: { isAdmin: true, host: IsNull() }, select: ["id"] });
		const icon = await getInstanceIconUrl();
		for (const admin of admins) {
			createNotification(admin.id, "app", { customHeader: header, customBody: body, customIcon: icon });
		}
	});
}

/**
 * 申請者に通知する。申請者が分からない（過去の取り込み）ときは何もしない。
 *
 * @param requesterId - 申請者
 * @param header - 見出し
 * @param body - 本文
 * @internal
 */
export function notifyEmojiRequester(
	requesterId: User["id"] | null,
	header: string,
	body: string,
): void {
	if (requesterId == null) return;
	setImmediate(async () => {
		const icon = await getInstanceIconUrl();
		createNotification(requesterId, "app", { customHeader: header, customBody: body, customIcon: icon });
	});
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
