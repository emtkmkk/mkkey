/**
 * @packageDocumentation
 *
 * 未読通知サマリーメールを日次で送る system ジョブ。
 *
 * @remarks
 * - 対象: ローカル・未削除・未停止・検証済みメールあり・サマリーメール受信 ON
 *   （`receiveUnreadSummaryEmail`）・2日以上未活動・前回送信から1週間以上経過・
 *   前回送信以降の新しい未読通知がある（初回は未読全部が対象）。
 * - 送信成功後に `user.unreadSummaryEmailSentAt` へ**集計基準時刻**をセットし、
 *   次回は「その時刻以降の未読」だけが対象になる。
 * - 通知はすべての種類が対象（アンテナ新着 `unreadAntenna` 含む）。種類ごとに
 *   件数と内容の抜粋を載せる。ミュートユーザー・ミュートインスタンス・
 *   サスペンド notifier 由来の通知は通知一覧 API と同様に除外する。
 * - 通知設定で受け取らないことにしている種類（`mutingNotificationTypes`）は載せない
 *   （作成時に既読化されるため通常は未読にならないが、設定変更前の古い未読も確実に除外する）。
 * - HTML 版の抜粋には notifier のアイコン画像とカスタム絵文字リアクションの画像を使う
 *   （メールクライアントが画像をブロックした場合は alt / text 版の文字表記にフォールバック）。
 * - 深夜にメールが届かないよう、JST の許可時間帯（8時〜21時）以外は送信せずスキップする。
 * - 1通ごとに待ち時間（既定3分）を空けて逐次送信し（{@link runEmailBatch}）、
 *   送信中に時間帯を外れたら残りは翌日に持ち越す。
 * - メールフッタの配信停止リンクは kind=summary（サマリーのみ停止）。
 *
 * @see {@link UNREAD_SUMMARY_MIN_INACTIVE_DAYS}
 * @see {@link UNREAD_SUMMARY_COOLDOWN_DAYS}
 * @internal
 */
import type Bull from "bull";
import { Brackets, type SelectQueryBuilder } from "typeorm";
import config from "@/config/index.js";
import {
	DAY,
	HOUR,
	UNREAD_SUMMARY_COOLDOWN_DAYS,
	UNREAD_SUMMARY_EXCERPTS_PER_TYPE,
	UNREAD_SUMMARY_EXCERPT_TEXT_LENGTH,
	UNREAD_SUMMARY_MAX_ANTENNA_ROWS,
	UNREAD_SUMMARY_MIN_INACTIVE_DAYS,
	UNREAD_SUMMARY_SEND_HOUR_END,
	UNREAD_SUMMARY_SEND_HOUR_START,
} from "@/const.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { populateEmoji } from "@/misc/populate-emojis.js";
import { decodeReaction } from "@/misc/reaction-lib.js";
import { secureRndstr } from "@/misc/secure-rndstr.js";
import type { Notification } from "@/models/entities/notification.js";
import type { Note } from "@/models/entities/note.js";
import {
	Mutings,
	Notifications,
	UserProfiles,
	Users,
} from "@/models/index.js";
import {
	buildGuidanceEmail,
	escapeHtml,
	runEmailBatch,
	sendEmail,
	type GuidanceParagraph,
} from "@/services/send-email.js";
import { notificationTypes } from "@/types.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("unread-summary-email");

/**
 * 現在時刻がサマリーメールを送信してよい JST 時間帯かを返す。
 *
 * @remarks
 * JST は UTC+9 固定・DST なしのため、UTC 時からの単純加算で判定できる。
 *
 * @internal
 */
function isWithinJstSendWindow(): boolean {
	const jstHour = (new Date().getUTCHours() + 9) % 24;
	return (
		jstHour >= UNREAD_SUMMARY_SEND_HOUR_START &&
		jstHour < UNREAD_SUMMARY_SEND_HOUR_END
	);
}

// #region 通知種類の表示定義
/** 通知種類の日本語ラベル（表示は notificationTypes の並び順） */
const TYPE_LABELS: Record<string, string> = {
	follow: "フォロー",
	mention: "呼びかけ",
	reply: "返信",
	renote: "RT",
	quote: "引用",
	reaction: "リアクション",
	unreadAntenna: "アンテナ新着",
	pollVote: "アンケートへの投票",
	pollEnded: "アンケートの終了",
	receiveFollowRequest: "フォロー申請",
	followRequestAccepted: "フォロー受理",
	groupInvited: "グループへの招待",
	app: "連携アプリからの通知",
	userWasUnfollowed: "フォロー解除",
	wasForciblyUnfollowed: "フォローの強制解除",
	wasBlocked: "ブロック",
	wasUnblocked: "ブロック解除",
	followedAccountWasDeleted: "フォロー中アカウントの削除",
};

/** 件数のみ表示（抜粋を載せない）種類 */
const COUNT_ONLY_TYPES = new Set([
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"wasBlocked",
	"wasUnblocked",
]);
// #endregion

// #region 集計
/** HTML / text 両対応の1行 */
type Line = { html: string; text: string };

/** 集計結果 */
interface UnreadSummary {
	/** 未読新規通知の総数 */
	total: number;
	/** 種類別セクション（notificationTypes の並び順） */
	sections: GuidanceParagraph[];
}

/**
 * 通知一覧 API と同等の可視性フィルタ（ミュートユーザー / ミュートインスタンス /
 * サスペンド notifier の除外）を適用する。
 *
 * @remarks
 * クエリ側で `notification.notifier` を `"notifier"` として leftJoin していること。
 * `notifierId IS NULL`（app 通知等）はすべて通す。
 *
 * @internal
 */
function applyVisibilityFilters<T extends SelectQueryBuilder<Notification>>(
	query: T,
	userId: string,
): T {
	const mutingQuery = Mutings.createQueryBuilder("muting")
		.select("muting.muteeId")
		.where("muting.muterId = :muterId", { muterId: userId });

	const mutingInstanceQuery = UserProfiles.createQueryBuilder("user_profile")
		.select("user_profile.mutedInstances")
		.where("user_profile.userId = :muterId", { muterId: userId });

	const suspendedQuery = Users.createQueryBuilder("users")
		.select("users.id")
		.where("users.isSuspended = TRUE");

	// ミュートユーザー
	query.andWhere(
		new Brackets((qb) => {
			qb.where(
				`notification.notifierId NOT IN (${mutingQuery.getQuery()})`,
			).orWhere("notification.notifierId IS NULL");
		}),
	);
	query.setParameters(mutingQuery.getParameters());

	// ミュートインスタンス
	query.andWhere(
		new Brackets((qb) => {
			qb.andWhere("notifier.host IS NULL").orWhere(
				`NOT (( ${mutingInstanceQuery.getQuery()} )::jsonb ? notifier.host)`,
			);
		}),
	);
	query.setParameters(mutingInstanceQuery.getParameters());

	// サスペンドユーザー
	query.andWhere(
		new Brackets((qb) => {
			qb.where(
				`notification.notifierId NOT IN (${suspendedQuery.getQuery()})`,
			).orWhere("notification.notifierId IS NULL");
		}),
	);

	return query;
}

/**
 * 未読新規通知のベースクエリ（受信者・未読・前回送信以降 + 可視性フィルタ）を作る。
 *
 * @param userId - 受信者
 * @param since - この時刻より後に作成された通知のみ（null は下限なし=初回）
 * @param mutedTypes - 通知設定で受け取らないことにしている種類（除外する）
 * @internal
 */
function buildUnreadQuery(
	userId: string,
	since: Date | null,
	mutedTypes: string[],
) {
	const query = Notifications.createQueryBuilder("notification")
		.leftJoin("notification.notifier", "notifier")
		.where("notification.notifieeId = :userId", { userId })
		.andWhere("notification.isRead = false");

	if (since != null) {
		query.andWhere("notification.createdAt > :since", { since });
	}

	if (mutedTypes.length > 0) {
		query.andWhere("notification.type NOT IN (:...mutedTypes)", {
			mutedTypes,
		});
	}

	return applyVisibilityFilters(query, userId);
}

/**
 * 文字列を最大長で切り詰める（超過分は「…」）。
 *
 * @internal
 */
function truncate(str: string, max: number): string {
	return str.length > max ? `${str.slice(0, max)}…` : str;
}

/**
 * 通知に紐づくノートの抜粋を返す（CW があれば CW を優先）。
 *
 * @internal
 */
function noteExcerpt(note: Note | null): string {
	const raw = note?.cw ?? note?.text ?? "";
	return truncate(raw.replace(/\s+/g, " ").trim(), UNREAD_SUMMARY_EXCERPT_TEXT_LENGTH);
}

/**
 * notifier の表示名部分（HTML はアイコン画像 + 名前 + acct をグレーで補足）を返す。
 *
 * @remarks
 * アイコンは `Users.getAvatarUrlSync`（アバター未設定時は identicon）。
 * 抜粋クエリで `notifier.avatar` を join 済みであること。
 *
 * @internal
 */
function renderNotifier(notification: Notification): Line | null {
	const notifier = notification.notifier;
	if (notifier == null) return null;

	const display = notifier.name || notifier.username;
	const acct = `@${notifier.username}${
		notifier.host ? `@${notifier.host}` : ""
	}`;
	const avatarUrl = Users.getAvatarUrlSync(notifier);

	return {
		html: `<img src="${escapeHtml(
			avatarUrl,
		)}" width="20" height="20" alt="" style="border-radius: 6px; vertical-align: -5px; margin-right: 6px;"/>${escapeHtml(
			display,
		)} <span style="color: #908caa;">(${escapeHtml(acct)})</span>`,
		text: `${display} (${acct})`,
	};
}

/**
 * リアクション表記を返す。カスタム絵文字は HTML では画像、text では `:name:` 表記。
 *
 * @remarks
 * Unicode 絵文字はそのまま文字で表示する。絵文字が解決できない場合（削除済み等）は
 * 元の文字列表記にフォールバックする。リモート絵文字の URL は populateEmoji が
 * プロキシ URL に変換する。
 *
 * @internal
 */
async function renderReaction(reaction: string | null): Promise<Line> {
	if (reaction == null || reaction === "") return { html: "", text: "" };

	// Unicode 絵文字はそのまま
	if (!reaction.startsWith(":")) {
		return { html: escapeHtml(reaction), text: reaction };
	}

	const decoded = decodeReaction(reaction);
	const label = decoded.name ? `:${decoded.name}:` : reaction;

	// "name@." (ローカル) / "name@host" 形式で解決する
	const emoji = await populateEmoji(
		decoded.reaction.split(":").join(""),
		null,
	).catch(() => null);

	if (emoji == null) {
		return { html: escapeHtml(label), text: label };
	}

	return {
		html: `<img src="${escapeHtml(emoji.url)}" width="18" height="18" alt="${escapeHtml(
			label,
		)}" style="vertical-align: -4px;"/>`,
		text: label,
	};
}

/**
 * 通知1件を抜粋1行にする。素材が無い通知は null（行を出さない）。
 *
 * @internal
 */
async function renderExcerptLine(
	notification: Notification,
): Promise<Line | null> {
	const who = renderNotifier(notification);

	/** 「本文…」の suffix（空なら空文字列） */
	const quoted = (excerpt: string): Line =>
		excerpt === ""
			? { html: "", text: "" }
			: {
					html: ` 「${escapeHtml(excerpt)}」`,
					text: ` 「${excerpt}」`,
			  };

	const withWho = (suffix: Line): Line | null =>
		who == null
			? null
			: { html: `${who.html}${suffix.html}`, text: `${who.text}${suffix.text}` };

	switch (notification.type) {
		case "follow":
		case "receiveFollowRequest":
		case "followRequestAccepted":
		case "groupInvited":
			return who;
		case "mention":
		case "reply":
		case "quote":
			return withWho(quoted(noteExcerpt(notification.note)));
		case "reaction": {
			const reaction = await renderReaction(notification.reaction);
			const excerpt = quoted(noteExcerpt(notification.note));
			return withWho({
				html: `: ${reaction.html}${excerpt.html}`,
				text: `: ${reaction.text}${excerpt.text}`,
			});
		}
		case "renote":
			// renote 通知の note はリノート側。元ノートは note.renote
			return withWho(
				quoted(noteExcerpt(notification.note?.renote ?? notification.note)),
			);
		case "pollVote":
			return withWho(quoted(noteExcerpt(notification.note)));
		case "pollEnded": {
			const excerpt = noteExcerpt(notification.note);
			if (excerpt === "") return null;
			return { html: `「${escapeHtml(excerpt)}」`, text: `「${excerpt}」` };
		}
		case "app": {
			const header = notification.customHeader;
			const body = truncate(
				(notification.customBody ?? "").replace(/\s+/g, " ").trim(),
				UNREAD_SUMMARY_EXCERPT_TEXT_LENGTH,
			);
			const text = header ? `${header}: ${body}` : body;
			if (text === "") return null;
			return { html: escapeHtml(text), text };
		}
		case "followedAccountWasDeleted": {
			const name = notification.customBody;
			if (name == null || name === "") return null;
			return { html: escapeHtml(name), text: name };
		}
		default:
			return null;
	}
}

/**
 * 種類別セクション（見出し + 抜粋行 + 「ほか n 件」）を組み立てる。
 *
 * @internal
 */
function buildSection(
	label: string,
	count: number,
	lines: Line[],
): GuidanceParagraph {
	const rest = count - lines.length;

	const htmlParts = [
		`<strong style="color: #ebbcba;">${escapeHtml(label)}（${count}件）</strong>`,
		...lines.map((line) => `<span>${line.html}</span>`),
	];
	const textParts = [
		`■ ${label}（${count}件）`,
		...lines.map((line) => `・${line.text}`),
	];

	if (rest > 0 && lines.length > 0) {
		htmlParts.push(`<span style="color: #908caa;">ほか ${rest} 件</span>`);
		textParts.push(`・ほか ${rest} 件`);
	}

	return { html: htmlParts.join("<br>"), text: textParts.join("\n") };
}

/**
 * 対象ユーザーの未読新規通知を種類別に集計し、メール用セクションを組み立てる。
 *
 * @param userId - 受信者
 * @param since - 前回サマリーの集計基準時刻（null は初回=未読全部）
 * @param mutedTypes - 通知設定で受け取らないことにしている種類（除外する）
 * @internal
 */
async function aggregateUnread(
	userId: string,
	since: Date | null,
	mutedTypes: string[],
): Promise<UnreadSummary> {
	// 種類別カウント
	const countRows = await buildUnreadQuery(userId, since, mutedTypes)
		.select("notification.type", "type")
		.addSelect("COUNT(*)", "count")
		.groupBy("notification.type")
		.getRawMany<{ type: string; count: string }>();

	const countMap = new Map(
		countRows.map((row) => [row.type, Number(row.count)]),
	);
	const total = [...countMap.values()].reduce((acc, n) => acc + n, 0);
	if (total === 0) return { total: 0, sections: [] };

	const sections: GuidanceParagraph[] = [];

	for (const type of notificationTypes) {
		const count = countMap.get(type);
		if (count == null || count === 0) continue;

		const label = TYPE_LABELS[type] ?? type;

		if (type === "unreadAntenna") {
			// アンテナはアンテナ名（reaction カラム）ごとの件数内訳
			const antennaRows = await buildUnreadQuery(userId, since, mutedTypes)
				.andWhere("notification.type = 'unreadAntenna'")
				.select("notification.reaction", "antennaName")
				.addSelect("COUNT(*)", "count")
				.groupBy("notification.reaction")
				.orderBy("count", "DESC")
				.getRawMany<{ antennaName: string | null; count: string }>();

			const lines: Line[] = antennaRows
				.slice(0, UNREAD_SUMMARY_MAX_ANTENNA_ROWS)
				.map((row) => {
					const name = row.antennaName ?? "(不明)";
					return {
						html: `アンテナ「${escapeHtml(name)}」: ${Number(row.count)}件`,
						text: `アンテナ「${name}」: ${Number(row.count)}件`,
					};
				});

			const restAntennas = antennaRows.length - lines.length;
			if (restAntennas > 0) {
				lines.push({
					html: `<span style="color: #908caa;">ほか ${restAntennas} アンテナ</span>`,
					text: `ほか ${restAntennas} アンテナ`,
				});
			}

			// アンテナは内訳自体が行なので「ほか n 件」は付けない
			sections.push({
				html: [
					`<strong style="color: #ebbcba;">${escapeHtml(label)}（${count}件）</strong>`,
					...lines.map((line) => `<span>${line.html}</span>`),
				].join("<br>"),
				text: [
					`■ ${label}（${count}件）`,
					...lines.map((line) => `・${line.text}`),
				].join("\n"),
			});
			continue;
		}

		if (COUNT_ONLY_TYPES.has(type)) {
			sections.push(buildSection(label, count, []));
			continue;
		}

		// 抜粋（最新N件）。notifier は buildUnreadQuery で join 済みなので選択だけ足す
		const excerptRows = await buildUnreadQuery(userId, since, mutedTypes)
			.andWhere("notification.type = :type", { type })
			.addSelect("notifier")
			.leftJoinAndSelect("notifier.avatar", "notifierAvatar")
			.leftJoinAndSelect("notification.note", "note")
			.leftJoinAndSelect("note.renote", "renote")
			.orderBy("notification.createdAt", "DESC")
			.take(UNREAD_SUMMARY_EXCERPTS_PER_TYPE)
			.getMany();

		const lines = (
			await Promise.all(
				excerptRows.map((notification) => renderExcerptLine(notification)),
			)
		).filter((line): line is Line => line != null);

		sections.push(buildSection(label, count, lines));
	}

	return { total, sections };
}
// #endregion

/**
 * 対象ユーザー（id のみ）を抽出する。詳細は送信直前に再取得・再チェックする。
 *
 * @param now - 実行時刻
 * @remarks
 * NOTE: EXISTS 内で `user."col"` のようにドット直後を手クォートすると TypeORM の
 * プロパティ置換が効かず、PG 予約語の素の `user` が残って構文エラーになる。
 * エイリアス参照は `user.col` 形式にすること。
 * @internal
 */
async function findSummaryTargets(now: Date): Promise<{ id: string }[]> {
	const inactiveThreshold = new Date(
		now.getTime() - UNREAD_SUMMARY_MIN_INACTIVE_DAYS * DAY,
	);
	const cooldownThreshold = new Date(
		now.getTime() - UNREAD_SUMMARY_COOLDOWN_DAYS * DAY,
	);

	return await Users.createQueryBuilder("user")
		.innerJoin("user_profile", "profile", 'profile."userId" = user.id')
		.where("user.host IS NULL")
		.andWhere("user.isDeleted = false")
		.andWhere("user.isSuspended = false")
		.andWhere("profile.email IS NOT NULL")
		.andWhere('profile."emailVerified" = true')
		.andWhere('profile."receiveUnreadSummaryEmail" = true')
		.andWhere(
			new Brackets((qb) => {
				qb.where(
					"user.lastActiveDate IS NOT NULL AND user.lastActiveDate <= :inactiveThreshold",
					{ inactiveThreshold },
				).orWhere(
					"user.lastActiveDate IS NULL AND user.createdAt <= :inactiveThreshold",
					{ inactiveThreshold },
				);
			}),
		)
		.andWhere(
			new Brackets((qb) => {
				qb.where("user.unreadSummaryEmailSentAt IS NULL").orWhere(
					"user.unreadSummaryEmailSentAt <= :cooldownThreshold",
					{ cooldownThreshold },
				);
			}),
		)
		// 前回送信以降の新しい未読通知があるユーザーのみ（ミュート除外は集計時に行う）
		// NOTE: `user."col"` のようにドット直後を手クォートすると TypeORM の
		// replacePropertyNames が効かず、PG 予約語の素の `user` が残って
		// `syntax error at or near "."` になる。プロパティパス形式（user.col）にすること。
		.andWhere(
			`EXISTS (SELECT 1 FROM notification n
				WHERE n."notifieeId" = user.id AND n."isRead" = false
				AND n."createdAt" > COALESCE(user.unreadSummaryEmailSentAt, '-infinity'::timestamptz))`,
		)
		.select("user.id", "id")
		.getRawMany<{ id: string }>();
}

/**
 * 日付を `yyyy/mm/dd`（JST）で整形する。
 *
 * @remarks
 * サーバの TZ に依存しないよう UTC+9 固定で計算する（JST は DST なし）。
 *
 * @internal
 */
function formatSlashDateJst(date: Date): string {
	const jst = new Date(date.getTime() + 9 * HOUR);
	const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
	const day = String(jst.getUTCDate()).padStart(2, "0");
	return `${jst.getUTCFullYear()}/${month}/${day}`;
}

/**
 * サマリーメール本文を組み立てる。
 *
 * @remarks
 * サマリーメールは通知の要約が主役のため、案内メール共通の冒頭挨拶は付けない。
 *
 * @param username - 宛先ユーザー名
 * @param inactiveSince - 未ログイン期間の開始（lastActiveDate または createdAt）
 * @param aggregatedAt - 集計基準時刻
 * @param summary - 集計結果
 * @internal
 */
async function buildSummaryMail(
	username: string,
	inactiveSince: Date,
	aggregatedAt: Date,
	summary: UnreadSummary,
): Promise<{ subject: string; html: string; text: string }> {
	const inactiveDays = Math.max(
		1,
		Math.floor((aggregatedAt.getTime() - inactiveSince.getTime()) / DAY),
	);
	const intro = `${formatSlashDateJst(
		inactiveSince,
	)}から${inactiveDays}日間の未ログイン期間に届いたあなた宛ての通知の概要をお知らせいたします。`;

	const notificationsUrl = `${config.url}/my/notifications`;

	return await buildGuidanceEmail({
		subjectBody: `未ログイン期間の通知サマリー(${summary.total}件)`,
		recipientUsername: username,
		greeting: "none",
		paragraphs: [
			intro,
			...summary.sections,
			{
				html: `<a href="${escapeHtml(
					notificationsUrl,
				)}" style="color: #9ccfd8 !important;">ログインして通知を確認する</a>`,
				text: `ログインして通知を確認する: ${notificationsUrl}`,
			},
		],
	});
}

/**
 * 未読通知サマリーメールを送る。
 *
 * @param job - Bull ジョブ
 * @param done - 完了コールバック
 * @returns Promise
 * @remarks
 * NOTE: 送信失敗・スキップ時は `unreadSummaryEmailSentAt` を更新せず、翌日のジョブで再試行する。
 * @internal
 */
export async function sendUnreadSummaryEmail(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Checking users for unread notification summary email...");
	job.log("info - Checking users for unread summary email...");

	const meta = await fetchMeta(true);
	if (!meta.enableEmail) {
		logger.info("Email is disabled; skip unread-summary-email");
		job.log("info - Email is disabled; skip");
		done();
		return;
	}

	// #region 夜間送信ガード
	// cron は JST 12時発火だが、リトライ遅延・手動実行・サーバ TZ 誤設定への保険。
	if (!isWithinJstSendWindow()) {
		logger.info("Skip: outside allowed send window (JST)");
		job.log("info - Skip: outside allowed send window (JST)");
		done();
		return;
	}
	// #endregion

	const targets = await findSummaryTargets(new Date());
	logger.info(`Found ${targets.length} summary candidates`);
	job.log(`info - Found ${targets.length} summary candidates`);

	let sent = 0;
	let skipped = 0;

	const result = await runEmailBatch(
		targets,
		async (target) => {
			const aggregatedAt = new Date();
			const inactiveThreshold = new Date(
				aggregatedAt.getTime() - UNREAD_SUMMARY_MIN_INACTIVE_DAYS * DAY,
			);

			// #region 再チェック（バッチ後半は抽出から数時間経つため）
			const user = await Users.findOneBy({ id: target.id });
			if (
				user == null ||
				user.host != null ||
				user.isDeleted ||
				user.isSuspended
			) {
				skipped++;
				return;
			}

			// 送信中にログイン（活動）していたら不要
			const activityBase = user.lastActiveDate ?? user.createdAt;
			if (activityBase.getTime() > inactiveThreshold.getTime()) {
				skipped++;
				return;
			}

			const profile = await UserProfiles.findOneBy({ userId: user.id });
			if (
				profile?.email == null ||
				!profile.emailVerified ||
				!profile.receiveUnreadSummaryEmail
			) {
				skipped++;
				return;
			}
			// #endregion

			const since = user.unreadSummaryEmailSentAt;
			const summary = await aggregateUnread(
				user.id,
				since,
				profile.mutingNotificationTypes ?? [],
			);
			if (summary.total === 0) {
				// 未読が全部ミュート・種別ミュート由来だった等。sentAt は更新せず翌日再判定
				skipped++;
				job.log(`info - Skip @${user.username}: no visible unread`);
				return;
			}

			// 配信停止トークンが未発行なら発行して保存する（ユーザー単位で固定）
			let unsubscribeToken = profile.emailUnsubscribeToken;
			if (unsubscribeToken == null) {
				unsubscribeToken = secureRndstr(64);
				await UserProfiles.update(
					{ userId: user.id },
					{ emailUnsubscribeToken: unsubscribeToken },
				);
			}

			const { subject, html, text } = await buildSummaryMail(
				user.username,
				activityBase,
				aggregatedAt,
				summary,
			);

			await sendEmail(profile.email, subject, html, text, {
				unsubscribeToken,
				unsubscribeKind: "summary",
			});
			await Users.update(user.id, {
				unreadSummaryEmailSentAt: aggregatedAt,
			});
			sent++;
			logger.succ(
				`Summary sent to @${user.username} (${user.id}): ${summary.total} unread`,
			);
			job.log(`succ - Sent @${user.username}: ${summary.total} unread`);
		},
		{
			shouldContinue: isWithinJstSendWindow,
			onError: (target, err) => {
				logger.error(`Failed to send summary to user ${target.id}`);
				logger.error(err as Error);
				job.log(`error - Failed ${target.id}: ${String(err)}`);
			},
		},
	);

	if (result.remaining > 0) {
		logger.info(
			`Send window closed; ${result.remaining} users are left for the next run`,
		);
		job.log(`info - Send window closed; remaining=${result.remaining}`);
	}

	logger.info(
		`unread-summary-email done: sent=${sent} skipped=${skipped} failed=${result.failed} remaining=${result.remaining}`,
	);
	job.log(
		`info - done: sent=${sent} skipped=${skipped} failed=${result.failed} remaining=${result.remaining}`,
	);
	done();
}
