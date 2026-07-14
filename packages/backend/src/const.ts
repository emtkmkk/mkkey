/**
 * @packageDocumentation
 *
 * バックエンド全体で参照する定数（ノート長・ドライブ・時間閾値・ブラウザ表示可能 MIME など）。
 *
 * @remarks
 * 各種閾値や FILE_TYPE_BROWSERSAFE は設定やハード制限と連動する。
 *
 * @internal
 */
import config from "@/config/index.js";
import { DB_MAX_IMAGE_COMMENT_LENGTH } from "@/misc/hard-limits.js";

/** ノート本文の最大文字数 */
export const MAX_NOTE_TEXT_LENGTH = 7999;
export const MAX_CAPTION_TEXT_LENGTH = Math.min(
	7999,
	DB_MAX_IMAGE_COMMENT_LENGTH,
);

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
export const DEFAULT_DRIVE_SIZE = 5 * GB;
export const MAX_DRIVE_SIZE = 100 * GB;

export const SECOND = 1000;
/** 1秒のミリ秒（SEC は SECOND の別名） */
export const SEC = 1000;
export const MINUTE = 60 * SEC;
/** 1分のミリ秒（MIN は MINUTE の別名） */
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const USER_ONLINE_THRESHOLD = 300 * SEC;
export const USER_HALFONLINE_THRESHOLD = 7.5 * MINUTE;
export const USER_ACTIVE_THRESHOLD = 1 * HOUR;
export const USER_ACTIVE2_THRESHOLD = 3 * HOUR;
export const USER_HALFSLEEP_THRESHOLD = 1 * DAY;
export const USER_SLEEP_THRESHOLD = 2 * DAY;
export const USER_DEEPSLEEP_THRESHOLD = 7 * DAY;
export const USER_SUPERSLEEP_THRESHOLD = 30 * DAY;

/**
 * バッチ的なメール送信で1通送るごとに空ける待ち時間（ms）。
 *
 * @remarks
 * 一度のバッチ処理で多数のメールを送る場合の共通インターバル。
 * SMTP やメールプロバイダへの負荷・スパム判定を避けるため、連続送信しない。
 *
 * @see {@link services/send-email!runEmailBatch}
 * @public
 */
export const BATCH_EMAIL_SEND_INTERVAL = 3 * MINUTE;

// #region 休眠アカウント削除予告メール
/**
 * 休眠アカウント警告メールの対象となる投稿数の上限（以下で対象）。
 *
 * @remarks
 * 運用ルール「投稿1000以下かつ長期未ログインは予告無く削除される場合がある」に合わせる。
 *
 * @public
 */
export const INACTIVE_DELETION_WARN_MAX_NOTES = 1000;

/**
 * 警告メールを送る未活動期間（月）。
 *
 * @remarks
 * この期間を超えて未活動のローカルユーザーへ、再ログインまで1回限りメールする。
 * 判定基準は `lastActiveDate`（無い場合は `createdAt`）。
 *
 * @see {@link INACTIVE_DELETION_ELIGIBLE_AFTER_MONTHS}
 * @public
 */
export const INACTIVE_DELETION_WARN_AFTER_MONTHS = 3;

/**
 * 予告無し削除の対象になりうる未活動期間（月）。
 *
 * @remarks
 * メール本文の「〜までにログインすることで対象外」の期限算出に使う（基準日 + この月数）。
 * 自動削除ジョブ自体は未実装で、運用上の目安として案内する。
 *
 * @see {@link INACTIVE_DELETION_WARN_AFTER_MONTHS}
 * @public
 */
export const INACTIVE_DELETION_ELIGIBLE_AFTER_MONTHS = 4;

/**
 * 警告メールを送信してよい時間帯の開始時（JST・この時刻を含む）。
 *
 * @remarks
 * 深夜にメールが届かないようにするためのガード。cron 自体は JST 18時発火だが、
 * リトライ遅延・手動実行・サーバ TZ 誤設定への保険としてジョブ側でも判定する。
 *
 * @see {@link INACTIVE_DELETION_WARN_SEND_HOUR_END}
 * @public
 */
export const INACTIVE_DELETION_WARN_SEND_HOUR_START = 8;

/**
 * 警告メールを送信してよい時間帯の終了時（JST・この時刻を含まない）。
 *
 * @see {@link INACTIVE_DELETION_WARN_SEND_HOUR_START}
 * @public
 */
export const INACTIVE_DELETION_WARN_SEND_HOUR_END = 21;
// #endregion

// #region 未読通知サマリーメール
/** サマリーメールの対象となる未活動日数（この日数以上ログインがないユーザーに送る） */
export const UNREAD_SUMMARY_MIN_INACTIVE_DAYS = 2;

/** サマリーメールの再送クールダウン（日）。前回送信からこの日数は再送しない */
export const UNREAD_SUMMARY_COOLDOWN_DAYS = 7;

/** サマリーメールを送信してよい時間帯の開始時（JST・この時刻を含む） */
export const UNREAD_SUMMARY_SEND_HOUR_START = 8;

/** サマリーメールを送信してよい時間帯の終了時（JST・この時刻を含まない） */
export const UNREAD_SUMMARY_SEND_HOUR_END = 21;

/** 通知の種類ごとに本文へ載せる抜粋の最大件数 */
export const UNREAD_SUMMARY_EXCERPTS_PER_TYPE = 3;

/** 抜粋に載せるノート本文等の最大文字数 */
export const UNREAD_SUMMARY_EXCERPT_TEXT_LENGTH = 60;

/** アンテナ内訳（アンテナ名ごとの件数）の最大行数 */
export const UNREAD_SUMMARY_MAX_ANTENNA_ROWS = 5;
// #endregion

export const MAX_REACTION_PER_ACCOUNT = 3;

/** 管理者として扱うユーザーID（オンラインステータス表示・ミュート除外などで参照） */
export const ADMIN_USER_ID = "9d5ts6in38";

/**
 * ブラウザで直接表示を許可する MIME タイプの一覧。
 * ここに含まれないものは application/octet-stream として返す。
 * NOTE: SVG は XSS のため現状除外。将来的に修正して直接表示許可を検討する。
 *
 * @internal
 */
export const FILE_TYPE_BROWSERSAFE = [
	//#region 画像
	"image/png",
	"image/gif", // TODO: 非推奨。旧ノートでまだ使用。新規 GIF は将来 webp に変換する
	"image/jpeg",
	"image/webp", // TODO: デフォルト画像形式にする
	"image/apng",
	"image/bmp",
	"image/tiff",
	"image/x-icon",
	"image/avif", // NOTE: 現状サポートは限定的だが、将来用に初期対応として追加

	//#endregion 画像
	//#region Ogg 系
	"audio/opus",
	"video/ogg",
	"audio/ogg",
	"application/ogg",

	//#endregion Ogg 系
	//#region ISO/IEC ベースメディアファイル形式
	"video/quicktime",
	"video/mp4", // TODO: 後で av1 のチェックを追加する
	"video/vnd.avi", // av1 も同様
	"audio/mp4",
	"video/x-m4v",
	"audio/x-m4a",
	"video/3gpp",
	"video/3gpp2",
	"video/3gp2",
	"audio/3gpp",
	"audio/3gpp2",
	"audio/3gp2",

	"video/mpeg",
	"audio/mpeg",

	"video/webm",
	"audio/webm",

	"audio/aac",
	"audio/x-flac",
	"audio/flac",
	"audio/vnd.wave",
];
//#endregion ISO/IEC ベースメディアファイル形式
// 参考: https://github.com/sindresorhus/file-type (supported.js / core.js), https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers
