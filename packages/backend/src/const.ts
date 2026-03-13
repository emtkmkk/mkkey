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
