/**
 * @packageDocumentation
 *
 * OpenAPI 3.0 仕様（API ドキュメント用）をエンドポイント定義から生成する。
 *
 * @remarks
 * - **役割**: `endpoints.ts` のエンドポイント一覧を走査し、OpenAPI 3.0 の JSON 仕様を組み立てる。
 * - 生成仕様は API ドキュメント表示（例: Swagger UI）やクライアント生成に利用される。
 *
 * @see {@link endpoints} エンドポイント一覧
 * @see {@link schemas} スキーマ変換
 * @internal
 */
import endpoints from "../endpoints.js";
import config from "@/config/index.js";
import { errors as basicErrors } from "./errors.js";
import { schemas, convertSchemaToOpenApiSchema } from "./schemas.js";

/** タグ名 → 日本語説明（Scalar 等の API ドキュメント表示用） */
const TAG_DESCRIPTIONS: Record<string, string> = {
	account: "アカウント設定・ブロック・ミュート・フォロー blocking 等",
	admin: "管理者向け操作",
	antennas: "アンテナ",
	app: "アプリケーション登録・管理",
	auth: "認証・セッション・MiAuth",
	categories: "カテゴリ（ページ用）",
	channels: "チャンネル",
	charts: "チャート・統計",
	clips: "クリップ",
	drive: "ドライブ（ファイル・フォルダ）",
	emoji: "絵文字（モチーフ等）",
	"emoji-import-request": "絵文字インポート申請",
	endpoints: "エンドポイント一覧",
	favorites: "お気に入り（ノート）",
	federation: "Federation（リモートインスタンス）",
	following: "フォロー・フォローリクエスト",
	gallery: "ギャラリー投稿",
	groups: "ユーザーグループ",
	hashtags: "ハッシュタグ",
	lists: "ユーザーリスト",
	messaging: "メッセージ（DM）",
	meta: "インスタンス情報・お知らせ・絵文字一覧等",
	"non-productive": "非本番用（開発・テスト）",
	notes: "ノート（投稿）の取得・作成・削除・タイムライン等",
	notifications: "通知",
	pages: "ページ",
	reactions: "リアクション",
	"reset password": "パスワードリセット",
	webhooks: "ウェブフック",
	users: "ユーザー情報・検索・フォロー等",
};

/** エンドポイント名 → 日本語の要約・説明（Scalar 表示用）。未定義時は deriveSummaryJa と meta.description にフォールバック。 */
const ENDPOINT_DESCRIPTIONS_JA: Record<
	string,
	{ summary: string; description: string }
> = {
	"meta": {
		summary: "インスタンスのメタ情報を取得",
		description:
			"インスタンス名・説明・バージョン・利用可能な絵文字一覧など、公開メタ情報を取得します。認証不要で呼び出せます。",
	},
	"notes/create": {
		summary: "ノートを投稿",
		description:
			"新規でノート（投稿）を作成します。テキスト・添付ファイル・投票・リプライ先などを指定できます。",
	},
	"notes/show": {
		summary: "ノートを1件取得",
		description: "指定したノートの詳細を取得します。存在しない場合はエラーになります。",
	},
	"notes/delete": {
		summary: "ノートを削除",
		description:
			"自分が投稿したノートを削除します。削除後は取り消せません。",
	},
	"notes/timeline": {
		summary: "ホームタイムラインを取得",
		description:
			"認証ユーザーのホームタイムライン（フォロー先のノート）を取得します。",
	},
	"notes/global-timeline": {
		summary: "グローバルタイムラインを取得",
		description:
			"インスタンス全体の公開ノートのタイムラインを取得します。認証不要で利用できます。",
	},
	"notes/local-timeline": {
		summary: "ローカルタイムラインを取得",
		description:
			"ローカルユーザー（このインスタンスのユーザー）の公開ノートのタイムラインを取得します。",
	},
	"users/show": {
		summary: "ユーザー情報を取得",
		description: "指定したユーザーの公開プロフィール情報を取得します。",
	},
	"users/search": {
		summary: "ユーザーを検索",
		description: "クエリに基づいてユーザーを検索します。",
	},
	"drive/files/create": {
		summary: "ドライブにファイルをアップロード",
		description: "新規ファイルをドライブにアップロードします。",
	},
	"drive/files/show": {
		summary: "ドライブファイルの情報を取得",
		description:
			"指定したドライブファイルの詳細（URL・サイズ・作成日時など）を取得します。",
	},
	"drive/files/delete": {
		summary: "ドライブファイルを削除",
		description:
			"自分のドライブからファイルを削除します。削除後は取り消せません。他ノートで添付中でも削除可能です。",
	},
	"i": {
		summary: "自分のアカウント情報を取得",
		description:
			"認証中のユーザー自身の詳細情報（プロフィール・未読数・設定など）を取得します。クライアント起動時の初期化でよく使われます。",
	},

	// #region メタ・お知らせ・認証不要
	announcements: {
		summary: "お知らせ一覧を取得",
		description: "インスタンスのお知らせ一覧を取得します。認証不要で利用できます。",
	},
	"antennas/create": {
		summary: "アンテナを作成",
		description: "新規アンテナ（キーワード等でフィルタするタイムライン）を作成します。",
	},
	"antennas/delete": {
		summary: "アンテナを削除",
		description: "指定アンテナを削除します。",
	},
	"antennas/list": {
		summary: "アンテナ一覧を取得",
		description: "自分が作成したアンテナ一覧を取得します。",
	},
	"antennas/mark-read": {
		summary: "アンテナを既読にする",
		description: "指定アンテナの未読を既読にします。",
	},
	"antennas/notes": {
		summary: "アンテナのノート一覧を取得",
		description: "指定アンテナにマッチするノートのタイムラインを取得します。",
	},
	"antennas/show": {
		summary: "アンテナ情報を取得",
		description: "指定アンテナの詳細を取得します。",
	},
	"antennas/update": {
		summary: "アンテナを更新",
		description: "アンテナの条件・名前等を更新します。",
	},
	"ap/get": {
		summary: "ActivityPub オブジェクトを取得（GET）",
		description: "指定 URL の ActivityPub オブジェクトを GET で取得します。",
	},
	"ap/show": {
		summary: "ActivityPub オブジェクトを取得",
		description: "指定 ID の ActivityPub オブジェクト（ユーザー・ノート等）の情報を取得します。",
	},
	"app/create": {
		summary: "アプリケーションを登録",
		description: "OAuth 等で利用するアプリケーションを新規登録します。",
	},
	"app/show": {
		summary: "アプリケーション情報を取得",
		description: "指定したアプリ ID のアプリケーション情報を取得します。",
	},
	"auth/accept": {
		summary: "認証を承認",
		description: "MiAuth 等の認証リクエストを承認し、トークンを発行します。",
	},
	"auth/session/generate": {
		summary: "セッションを生成",
		description: "認証用のセッション（ユーザーキー取得用）を生成します。",
	},
	"auth/session/show": {
		summary: "セッション情報を取得",
		description: "指定したセッションの情報を取得します。",
	},
	"auth/session/userkey": {
		summary: "ユーザーキーを取得",
		description: "セッションからユーザーキー（アクセストークン）を取得します。",
	},
	"auth/validate": {
		summary: "認証を検証",
		description:
			"トークンの有効性を検証します。有効な場合は valid: true を返します。キャッシュ済みトークンの確認に利用できます。",
	},
	"blocking/create": {
		summary: "ブロックを追加",
		description: "指定ユーザーをブロックします。",
	},
	"blocking/delete": {
		summary: "ブロックを解除",
		description: "指定ユーザーのブロックを解除します。",
	},
	"blocking/list": {
		summary: "ブロック一覧を取得",
		description: "自分がブロックしているユーザー一覧を取得します。",
	},
	"channels/create": {
		summary: "チャンネルを作成",
		description: "新規チャンネルを作成します。",
	},
	"channels/featured": {
		summary: "おすすめチャンネルを取得",
		description: "おすすめチャンネル一覧を取得します。",
	},
	"channels/follow": {
		summary: "チャンネルをフォロー",
		description: "指定チャンネルをフォローします。",
	},
	"channels/followed": {
		summary: "フォローチャンネル一覧を取得",
		description: "自分がフォローしているチャンネル一覧を取得します。",
	},
	"channels/owned": {
		summary: "自分が作成したチャンネル一覧を取得",
		description: "認証ユーザーがオーナーのチャンネル一覧を取得します。",
	},
	"channels/search": {
		summary: "チャンネルを検索",
		description: "クエリでチャンネルを検索します。",
	},
	"channels/show": {
		summary: "チャンネル情報を取得",
		description: "指定チャンネルの詳細を取得します。",
	},
	"channels/timeline": {
		summary: "チャンネルタイムラインを取得",
		description: "指定チャンネルのノートタイムラインを取得します。",
	},
	"channels/unfollow": {
		summary: "チャンネルのフォローを解除",
		description: "指定チャンネルのフォローを解除します。",
	},
	"channels/update": {
		summary: "チャンネルを更新",
		description: "チャンネルの名前・説明等を更新します。",
	},
	"charts/active-users": {
		summary: "アクティブユーザー数のチャートを取得",
		description: "アクティブユーザー数の時系列データを取得します。",
	},
	"charts/ap-request": {
		summary: "AP リクエスト数のチャートを取得",
		description: "ActivityPub リクエスト数の時系列データを取得します。",
	},
	"charts/drive": {
		summary: "ドライブ使用量のチャートを取得",
		description: "ドライブ使用量の時系列データを取得します。",
	},
	"charts/federation": {
		summary: "Federation のチャートを取得",
		description: "Federation 関連の時系列データを取得します。",
	},
	"charts/hashtag": {
		summary: "ハッシュタグのチャートを取得",
		description: "ハッシュタグ利用の時系列データを取得します。",
	},
	"charts/instance": {
		summary: "インスタンスのチャートを取得",
		description: "インスタンス全体の時系列データを取得します。",
	},
	"charts/notes": {
		summary: "ノート数のチャートを取得",
		description: "ノート数の時系列データを取得します。",
	},
	"charts/user/drive": {
		summary: "ユーザーのドライブチャートを取得",
		description: "指定ユーザーのドライブ使用量の時系列を取得します。",
	},
	"charts/user/following": {
		summary: "ユーザーのフォローチャートを取得",
		description: "指定ユーザーのフォロー数の時系列を取得します。",
	},
	"charts/user/notes": {
		summary: "ユーザーのノートチャートを取得",
		description: "指定ユーザーのノート数の時系列を取得します。",
	},
	"charts/user/reactions": {
		summary: "ユーザーのリアクションチャートを取得",
		description: "指定ユーザーへのリアクション数の時系列を取得します。",
	},
	"charts/users": {
		summary: "ユーザー数のチャートを取得",
		description: "ユーザー数の時系列データを取得します。",
	},
	"clips/add-note": {
		summary: "クリップにノートを追加",
		description: "指定クリップにノートを追加します。",
	},
	"clips/remove-note": {
		summary: "クリップからノートを削除",
		description: "指定クリップからノートを削除します。",
	},
	"clips/create": {
		summary: "クリップを作成",
		description: "新規クリップを作成します。",
	},
	"clips/delete": {
		summary: "クリップを削除",
		description: "指定クリップを削除します。",
	},
	"clips/list": {
		summary: "クリップ一覧を取得",
		description: "自分のクリップ一覧を取得します。",
	},
	"clips/notes": {
		summary: "クリップ内のノート一覧を取得",
		description: "指定クリップに含まれるノート一覧を取得します。",
	},
	"clips/show": {
		summary: "クリップ情報を取得",
		description: "指定クリップの詳細を取得します。",
	},
	"clips/update": {
		summary: "クリップを更新",
		description: "クリップの名前等を更新します。",
	},
	drive: {
		summary: "ドライブ情報を取得",
		description: "認証ユーザーのドライブの概要情報を取得します。",
	},
	"drive/auto-folders": {
		summary: "自動フォルダ一覧を取得",
		description: "ドライブの自動振り分け用フォルダ一覧を取得します。",
	},
	"drive/files": {
		summary: "ドライブファイル一覧を取得",
		description: "ドライブ内のファイル一覧を取得します。",
	},
	"drive/files/attached-notes": {
		summary: "ファイルに添付されたノート一覧を取得",
		description: "指定ドライブファイルを添付しているノート一覧を取得します。",
	},
	"drive/files/caption-image": {
		summary: "画像にキャプションを付与",
		description: "ドライブの画像ファイルにキャプション（alt テキスト）を設定します。",
	},
	"drive/files/check-existence": {
		summary: "ファイルの存在確認",
		description: "指定 MD5 のファイルがドライブに存在するか確認します。",
	},
	"drive/files/find-by-hash": {
		summary: "ハッシュでファイルを検索",
		description: "MD5 ハッシュでドライブ内のファイルを検索します。",
	},
	"drive/files/find": {
		summary: "ドライブファイルを検索",
		description: "ドライブ内のファイルを検索します。",
	},
	"drive/files/upload-from-url": {
		summary: "URL からファイルをアップロード",
		description: "指定 URL のファイルをドライブに取り込みます。",
	},
	"drive/files/update": {
		summary: "ドライブファイルを更新",
		description: "ドライブファイルの名前・フォルダ等を更新します。",
	},
	"drive/folders": {
		summary: "ドライブフォルダ一覧を取得",
		description: "ドライブ内のフォルダ一覧を取得します。",
	},
	"drive/folders/create": {
		summary: "フォルダを作成",
		description: "ドライブに新規フォルダを作成します。",
	},
	"drive/folders/delete": {
		summary: "フォルダを削除",
		description: "指定フォルダを削除します。",
	},
	"drive/folders/find": {
		summary: "フォルダを検索",
		description: "ドライブ内のフォルダを検索します。",
	},
	"drive/folders/show": {
		summary: "フォルダ情報を取得",
		description: "指定フォルダの詳細を取得します。",
	},
	"drive/folders/update": {
		summary: "フォルダを更新",
		description: "フォルダ名等を更新します。",
	},
	"drive/stream": {
		summary: "ドライブのストリームを取得",
		description: "ドライブのファイル・フォルダのストリーミング一覧を取得します。",
	},
	"email-address/available": {
		summary: "メールアドレスの利用可否を確認",
		description: "指定メールアドレスが登録に利用可能か確認します。",
	},
	emoji: {
		summary: "絵文字情報を取得",
		description: "インスタンスで利用可能な絵文字の情報を取得します。",
	},
	"emoji/set-motif-mode": {
		summary: "モチーフモードを設定",
		description: "絵文字のモチーフモード（表示形式）を設定します。",
	},
	"emoji-import-request/create": {
		summary: "絵文字インポート申請を作成",
		description: "リモートの絵文字をインポートする申請を作成します。",
	},
	"emoji-import-request/my-list": {
		summary: "自分の絵文字インポート申請一覧を取得",
		description: "自分が行った絵文字インポート申請の一覧を取得します。",
	},
	"emoji-import-request/remaining-count": {
		summary: "絵文字インポート残り回数を取得",
		description: "残りのインポート可能回数を取得します。",
	},
	"emoji-import-request/same-name-emojis": {
		summary: "同名絵文字一覧を取得",
		description: "同名の既存絵文字一覧を取得します。",
	},
	"emoji-import-request/list": {
		summary: "絵文字インポート申請一覧を取得",
		description: "絵文字インポート申請の一覧を取得します（管理者向け等）。",
	},
	"emoji-import-request/approve": {
		summary: "絵文字インポート申請を承認",
		description: "絵文字インポート申請を承認します。",
	},
	"emoji-import-request/reject": {
		summary: "絵文字インポート申請を拒否",
		description: "絵文字インポート申請を拒否します。",
	},
	emojis: {
		summary: "絵文字一覧を取得",
		description: "インスタンスの絵文字一覧を取得します。",
	},
	"emojis/latest": {
		summary: "最新の絵文字一覧を取得",
		description: "直近追加された絵文字の一覧を取得します。",
	},
	"emoji-stats": {
		summary: "絵文字統計を取得",
		description: "絵文字の利用統計を取得します。",
	},
	endpoint: {
		summary: "単一エンドポイント情報を取得",
		description: "指定エンドポイントのメタ情報を取得します。",
	},
	endpoints: {
		summary: "エンドポイント一覧を取得",
		description: "利用可能な API エンドポイントの一覧を取得します。",
	},
	"export-custom-emojis": {
		summary: "カスタム絵文字をエクスポート",
		description: "インスタンスのカスタム絵文字をエクスポートします。",
	},
	"federation/followers": {
		summary: "フォロワー数を取得（Federation）",
		description: "リモート含むフォロワー数の統計を取得します。",
	},
	"federation/following": {
		summary: "フォロー数を取得（Federation）",
		description: "リモート含むフォロー数の統計を取得します。",
	},
	"federation/instances": {
		summary: "Federation インスタンス一覧を取得",
		description: "連合しているインスタンスの一覧を取得します。",
	},
	"federation/show-instance": {
		summary: "インスタンス情報を取得（Federation）",
		description: "指定ホストのリモートインスタンス情報を取得します。",
	},
	"federation/update-remote-user": {
		summary: "リモートユーザー情報を更新",
		description: "リモートユーザーのキャッシュを更新します。",
	},
	"federation/users": {
		summary: "リモートユーザー一覧を取得",
		description: "指定インスタンスのユーザー一覧を取得します。",
	},
	"federation/stats": {
		summary: "Federation 統計を取得",
		description: "Federation の統計情報を取得します。",
	},
	"following/create": {
		summary: "フォローを追加",
		description: "指定ユーザーをフォローします。",
	},
	"following/delete": {
		summary: "フォローを解除",
		description: "指定ユーザーのフォローを解除します。",
	},
	"following/invalidate": {
		summary: "フォローを無効化",
		description: "フォロー関係を無効化し、再取得を促します。",
	},
	"following/requests/accept": {
		summary: "フォローリクエストを承認",
		description: "届いているフォローリクエストを承認します。",
	},
	"following/requests/cancel": {
		summary: "フォローリクエストをキャンセル",
		description: "自分が送ったフォローリクエストをキャンセルします。",
	},
	"following/requests/list": {
		summary: "フォローリクエスト一覧を取得",
		description: "届いているフォローリクエストの一覧を取得します。",
	},
	"following/requests/reject": {
		summary: "フォローリクエストを拒否",
		description: "届いているフォローリクエストを拒否します。",
	},
	"gallery/featured": {
		summary: "おすすめギャラリー投稿を取得",
		description: "おすすめのギャラリー投稿一覧を取得します。",
	},
	"gallery/popular": {
		summary: "人気のギャラリー投稿を取得",
		description: "人気のギャラリー投稿一覧を取得します。",
	},
	"gallery/posts": {
		summary: "ギャラリー投稿一覧を取得",
		description: "ギャラリーの投稿一覧を取得します。",
	},
	"gallery/posts/create": {
		summary: "ギャラリー投稿を作成",
		description: "新規ギャラリー投稿を作成します。",
	},
	"gallery/posts/delete": {
		summary: "ギャラリー投稿を削除",
		description: "指定ギャラリー投稿を削除します。",
	},
	"gallery/posts/like": {
		summary: "ギャラリー投稿をいいね",
		description: "指定ギャラリー投稿にいいねします。",
	},
	"gallery/posts/show": {
		summary: "ギャラリー投稿を取得",
		description: "指定ギャラリー投稿の詳細を取得します。",
	},
	"gallery/posts/unlike": {
		summary: "ギャラリー投稿のいいねを解除",
		description: "ギャラリー投稿へのいいねを解除します。",
	},
	"gallery/posts/update": {
		summary: "ギャラリー投稿を更新",
		description: "ギャラリー投稿の内容を更新します。",
	},
	"get-online-users-count": {
		summary: "オンラインユーザー数を取得",
		description: "現在オンラインのユーザー数を取得します。",
	},
	"get-online-users-count/detail": {
		summary: "オンラインユーザー数（詳細）を取得",
		description: "オンラインユーザー数の内訳を取得します。",
	},
	"hashtags/list": {
		summary: "ハッシュタグ一覧を取得",
		description: "トレンド等のハッシュタグ一覧を取得します。",
	},
	"hashtags/search": {
		summary: "ハッシュタグを検索",
		description: "クエリでハッシュタグを検索します。",
	},
	"hashtags/show": {
		summary: "ハッシュタグ情報を取得",
		description: "指定ハッシュタグの情報を取得します。",
	},
	"hashtags/trend": {
		summary: "トレンドハッシュタグを取得",
		description: "トレンドのハッシュタグ一覧を取得します。",
	},
	"hashtags/users": {
		summary: "ハッシュタグ利用ユーザー一覧を取得",
		description: "指定ハッシュタグを使っているユーザー一覧を取得します。",
	},
	"i/known-as": {
		summary: "Known As（別名）を取得",
		description: "アカウント移行に伴う Known As 情報を取得します。",
	},
	"i/move": {
		summary: "アカウント移行を実行",
		description: "別アカウントへの移行（Move）を実行します。",
	},
	"i/2fa/done": {
		summary: "2FA セットアップ完了",
		description: "2 段階認証のセットアップを完了します。",
	},
	"i/2fa/key-done": {
		summary: "2FA キー登録完了",
		description: "2 段階認証用キーの登録を完了します。",
	},
	"i/2fa/password-less": {
		summary: "パスワードレス認証",
		description: "パスワードレス（パスキー等）の認証を行います。",
	},
	"i/2fa/register-key": {
		summary: "2FA キーを登録",
		description: "2 段階認証用のキーを登録します。",
	},
	"i/2fa/register": {
		summary: "2FA を登録",
		description: "2 段階認証を有効化します。",
	},
	"i/2fa/remove-key": {
		summary: "2FA キーを削除",
		description: "登録済みの 2 段階認証キーを削除します。",
	},
	"i/2fa/unregister": {
		summary: "2FA を無効化",
		description: "2 段階認証を無効化します。",
	},
	"i/apps": {
		summary: "自分のアプリ一覧を取得",
		description: "自分が登録したアプリケーション一覧を取得します。",
	},
	"i/authorized-apps": {
		summary: "認可済みアプリ一覧を取得",
		description: "アクセスを許可しているアプリ一覧を取得します。",
	},
	"i/change-password": {
		summary: "パスワードを変更",
		description: "アカウントのパスワードを変更します。",
	},
	"i/delete-account": {
		summary: "アカウントを削除",
		description: "自分のアカウントを削除します。取り消し不可です。",
	},
	"i/export-blocking": {
		summary: "ブロック一覧をエクスポート",
		description: "ブロックしているユーザー一覧をエクスポートします。",
	},
	"i/export-following": {
		summary: "フォロー一覧をエクスポート",
		description: "フォローしているユーザー一覧をエクスポートします。",
	},
	"i/export-mute": {
		summary: "ミュート一覧をエクスポート",
		description: "ミュートしているユーザー一覧をエクスポートします。",
	},
	"i/export-notes": {
		summary: "ノートをエクスポート",
		description: "自分のノートをエクスポートします。",
	},
	"i/import-posts": {
		summary: "投稿をインポート",
		description: "他サービス等からの投稿をインポートします。",
	},
	"i/export-user-lists": {
		summary: "ユーザーリストをエクスポート",
		description: "ユーザーリストの内容をエクスポートします。",
	},
	"i/favorites": {
		summary: "お気に入りノート一覧を取得",
		description: "自分がお気に入りしたノート一覧を取得します。",
	},
	"i/gallery/likes": {
		summary: "いいねしたギャラリー一覧を取得",
		description: "自分がいいねしたギャラリー投稿一覧を取得します。",
	},
	"i/gallery/posts": {
		summary: "自分のギャラリー投稿一覧を取得",
		description: "自分が投稿したギャラリー投稿一覧を取得します。",
	},
	"i/get-word-muted-notes-count": {
		summary: "ワードミュート対象ノート数を取得",
		description: "ワードミュートにより非表示になっているノート数を取得します。",
	},
	"i/import-blocking": {
		summary: "ブロック一覧をインポート",
		description: "エクスポートしたブロック一覧をインポートします。",
	},
	"i/import-following": {
		summary: "フォロー一覧をインポート",
		description: "エクスポートしたフォロー一覧をインポートします。",
	},
	"i/import-muting": {
		summary: "ミュート一覧をインポート",
		description: "エクスポートしたミュート一覧をインポートします。",
	},
	"i/import-user-lists": {
		summary: "ユーザーリストをインポート",
		description: "エクスポートしたユーザーリストをインポートします。",
	},
	"i/notifications": {
		summary: "通知一覧を取得",
		description: "自分への通知一覧を取得します。",
	},
	"i/page-likes": {
		summary: "いいねしたページ一覧を取得",
		description: "自分がいいねしたページ一覧を取得します。",
	},
	"i/pages": {
		summary: "自分のページ一覧を取得",
		description: "自分が作成したページ一覧を取得します。",
	},
	"i/categories": {
		summary: "自分のカテゴリ一覧を取得",
		description: "自分が作成したカテゴリ一覧を取得します。",
	},
	"i/pin": {
		summary: "ノートをピン留め",
		description: "プロフィールに表示するノートをピン留めします。",
	},
	"i/read-all-messaging-messages": {
		summary: "メッセージをすべて既読にする",
		description: "メッセージルーム内のメッセージをすべて既読にします。",
	},
	"i/read-all-unread-notes": {
		summary: "未読ノートをすべて既読にする",
		description: "未読の通知元ノートをすべて既読にします。",
	},
	"i/read-announcement": {
		summary: "お知らせを既読にする",
		description: "指定お知らせを既読にします。",
	},
	"i/regenerate-token": {
		summary: "トークンを再生成",
		description: "アプリのアクセストークンを再生成します。",
	},
	"i/registry/get-all": {
		summary: "レジストリを一括取得",
		description: "レジストリのキー・値を一括取得します。",
	},
	"i/registry/get-detail": {
		summary: "レジストリの詳細を取得",
		description: "指定キーのレジストリの詳細を取得します。",
	},
	"i/registry/get-unsecure": {
		summary: "レジストリを取得（非セキュア）",
		description: "非セキュアなレジストリ値を取得します。",
	},
	"i/registry/get": {
		summary: "レジストリの値を取得",
		description: "指定キーのレジストリの値を取得します。",
	},
	"i/registry/keys-with-type": {
		summary: "レジストリのキー一覧（型付き）を取得",
		description: "レジストリのキーと型の一覧を取得します。",
	},
	"i/registry/keys": {
		summary: "レジストリのキー一覧を取得",
		description: "レジストリのキー一覧を取得します。",
	},
	"i/registry/remove": {
		summary: "レジストリのキーを削除",
		description: "指定キーのレジストリの値を削除します。",
	},
	"i/registry/scopes": {
		summary: "レジストリのスコープ一覧を取得",
		description: "利用可能なレジストリスコープ一覧を取得します。",
	},
	"i/registry/set": {
		summary: "レジストリに値を設定",
		description: "指定キーでレジストリに値を設定します。",
	},
	"i/revoke-token": {
		summary: "トークンを無効化",
		description: "指定アプリのトークンを無効化します。",
	},
	"i/swarm/recent-checkins": {
		summary: "Swarm 直近チェックインを取得",
		description: "Swarm の直近チェックイン一覧を取得します。",
	},
	"i/swarm/update-settings": {
		summary: "Swarm 設定を更新",
		description: "Swarm の設定を更新します。",
	},
	"i/signin-history": {
		summary: "サインイン履歴を取得",
		description: "自分のサインイン履歴を取得します。",
	},
	"i/unpin": {
		summary: "ピン留めを解除",
		description: "プロフィールのピン留めノートを解除します。",
	},
	"i/update-email": {
		summary: "メールアドレスを更新",
		description: "アカウントのメールアドレスを更新します。",
	},
	"i/update": {
		summary: "自分のプロフィールを更新",
		description: "自分のプロフィール・アカウント設定を更新します。",
	},
	"i/user-group-invites": {
		summary: "ユーザーグループ招待一覧を取得",
		description: "自分へのユーザーグループ招待一覧を取得します。",
	},
	"i/webhooks/create": {
		summary: "ウェブフックを作成",
		description: "新規ウェブフックを作成します。",
	},
	"i/webhooks/list": {
		summary: "ウェブフック一覧を取得",
		description: "自分が登録したウェブフック一覧を取得します。",
	},
	"i/webhooks/show": {
		summary: "ウェブフック情報を取得",
		description: "指定ウェブフックの詳細を取得します。",
	},
	"i/webhooks/update": {
		summary: "ウェブフックを更新",
		description: "ウェブフックの設定を更新します。",
	},
	"i/webhooks/delete": {
		summary: "ウェブフックを削除",
		description: "指定ウェブフックを削除します。",
	},
	"messaging/history": {
		summary: "メッセージ履歴を取得",
		description: "指定ユーザーとのメッセージ履歴を取得します。",
	},
	"messaging/messages": {
		summary: "メッセージ一覧を取得",
		description: "メッセージルームのメッセージ一覧を取得します。",
	},
	"messaging/messages/create": {
		summary: "メッセージを送信",
		description: "指定ユーザーにメッセージを送信します。",
	},
	"messaging/messages/delete": {
		summary: "メッセージを削除",
		description: "指定メッセージを削除します。",
	},
	"messaging/messages/read": {
		summary: "メッセージを既読にする",
		description: "指定メッセージを既読にします。",
	},
	"miauth/gen-token": {
		summary: "MiAuth トークンを生成",
		description: "MiAuth 認証用のトークンを生成します。",
	},
	"mute/create": {
		summary: "ミュートを追加",
		description: "指定ユーザーをミュートします。",
	},
	"mute/delete": {
		summary: "ミュートを解除",
		description: "指定ユーザーのミュートを解除します。",
	},
	"mute/list": {
		summary: "ミュート一覧を取得",
		description: "自分がミュートしているユーザー一覧を取得します。",
	},
	"follow-blocking/create": {
		summary: "フォローブロックを追加",
		description: "指定ユーザーをフォローしないようにブロックします。",
	},
	"follow-blocking/delete": {
		summary: "フォローブロックを解除",
		description: "指定ユーザーのフォローブロックを解除します。",
	},
	"follow-blocking/list": {
		summary: "フォローブロック一覧を取得",
		description: "フォローブロックしているユーザー一覧を取得します。",
	},
	"renote-mute/create": {
		summary: "リノートミュートを追加",
		description: "指定ユーザーのリノートを非表示にします。",
	},
	"renote-mute/delete": {
		summary: "リノートミュートを解除",
		description: "指定ユーザーのリノートミュートを解除します。",
	},
	"renote-mute/list": {
		summary: "リノートミュート一覧を取得",
		description: "リノートミュートしているユーザー一覧を取得します。",
	},
	"my/apps": {
		summary: "自分のアプリ一覧を取得",
		description: "自分が作成したアプリ一覧を取得します。",
	},
	notes: {
		summary: "ノート一覧を取得",
		description: "複数 ID のノートを一括取得します。",
	},
	"notes/children": {
		summary: "ノートの子ノートを取得",
		description: "指定ノートへの返信一覧を取得します。",
	},
	"notes/clips": {
		summary: "ノートが含まれるクリップ一覧を取得",
		description: "指定ノートを含むクリップ一覧を取得します。",
	},
	"notes/conversation": {
		summary: "会話スレッドを取得",
		description: "指定ノートを含む会話スレッドを取得します。",
	},
	"notes/favorites/create": {
		summary: "お気に入りに追加",
		description: "指定ノートをお気に入りに追加します。",
	},
	"notes/favorites/delete": {
		summary: "お気に入りから削除",
		description: "指定ノートをお気に入りから削除します。",
	},
	"notes/featured": {
		summary: "おすすめノートを取得",
		description: "おすすめのノート一覧を取得します。",
	},
	"notes/hybrid-timeline": {
		summary: "ハイブリッドタイムラインを取得",
		description: "ローカルとリモートを混在したタイムラインを取得します。",
	},
	"notes/recommended-timeline": {
		summary: "おすすめタイムラインを取得",
		description: "おすすめのノートタイムラインを取得します。",
	},
	"notes/spotlight-timeline": {
		summary: "スポットライトタイムラインを取得",
		description: "スポットライト（注目）のタイムラインを取得します。",
	},
	"notes/mentions": {
		summary: "メンションされたノート一覧を取得",
		description: "自分がメンションされたノート一覧を取得します。",
	},
	"notes/polls/recommendation": {
		summary: "投票のおすすめを取得",
		description: "投票の選択肢のおすすめを取得します。",
	},
	"notes/polls/vote": {
		summary: "投票する",
		description: "指定ノートの投票に投票します。",
	},
	"notes/reactions": {
		summary: "ノートのリアクション一覧を取得",
		description: "指定ノートへのリアクション一覧を取得します。",
	},
	"notes/reactions/create": {
		summary: "リアクションを追加",
		description: "指定ノートにリアクションを付けます。",
	},
	"notes/reactions/delete": {
		summary: "リアクションを削除",
		description: "指定ノートへの自分のリアクションを削除します。",
	},
	"notes/renotes": {
		summary: "リノート一覧を取得",
		description: "指定ノートをリノートしている一覧を取得します。",
	},
	"notes/replies": {
		summary: "返信一覧を取得",
		description: "指定ノートへの返信一覧を取得します。",
	},
	"notes/search-by-tag": {
		summary: "タグでノートを検索",
		description: "指定ハッシュタグのノートを検索します。",
	},
	"notes/search": {
		summary: "ノートを検索",
		description: "キーワード等でノートを検索します。",
	},
	"notes/state": {
		summary: "ノートの状態を取得",
		description: "指定ノートに対する自分の状態（リアクション・お気に入り等）を取得します。",
	},
	"notes/thread-muting/create": {
		summary: "スレッドミュートを追加",
		description: "指定ノートのスレッドをミュートします。",
	},
	"notes/thread-muting/delete": {
		summary: "スレッドミュートを解除",
		description: "指定ノートのスレッドミュートを解除します。",
	},
	"notes/translate": {
		summary: "ノートを翻訳",
		description: "指定ノートの本文を翻訳します。",
	},
	"notes/unrenote": {
		summary: "リノートを解除",
		description: "指定ノートのリノートを解除します。",
	},
	"notes/user-list-timeline": {
		summary: "ユーザーリストタイムラインを取得",
		description: "指定ユーザーリストのタイムラインを取得します。",
	},
	"notes/watching/create": {
		summary: "ウォッチを追加",
		description: "指定ノートをウォッチ（購読）します。",
	},
	"notes/watching/delete": {
		summary: "ウォッチを解除",
		description: "指定ノートのウォッチを解除します。",
	},
	"notifications/create": {
		summary: "通知を作成",
		description: "自分宛ての通知を手動で作成します（主にテスト用）。",
	},
	"notifications/mark-all-as-read": {
		summary: "通知をすべて既読にする",
		description: "未読の通知をすべて既読にします。",
	},
	"notifications/read": {
		summary: "通知を既読にする",
		description: "指定通知を既読にします。",
	},
	"page-push": {
		summary: "ページにプッシュ",
		description: "ページへのプッシュ通知を行います。",
	},
	"pages/create": {
		summary: "ページを作成",
		description: "新規ページを作成します。",
	},
	"pages/delete": {
		summary: "ページを削除",
		description: "指定ページを削除します。",
	},
	"pages/featured": {
		summary: "おすすめページを取得",
		description: "おすすめのページ一覧を取得します。",
	},
	"pages/like": {
		summary: "ページをいいね",
		description: "指定ページにいいねします。",
	},
	"pages/show": {
		summary: "ページを取得",
		description: "指定ページの内容を取得します。",
	},
	"pages/unlike": {
		summary: "ページのいいねを解除",
		description: "指定ページへのいいねを解除します。",
	},
	"pages/update": {
		summary: "ページを更新",
		description: "ページの内容を更新します。",
	},
	"categories/create": {
		summary: "カテゴリを作成",
		description: "新規カテゴリ（ページ用）を作成します。",
	},
	"categories/delete": {
		summary: "カテゴリを削除",
		description: "指定カテゴリを削除します。",
	},
	"categories/featured": {
		summary: "おすすめカテゴリを取得",
		description: "おすすめのカテゴリ一覧を取得します。",
	},
	"categories/show": {
		summary: "カテゴリ情報を取得",
		description: "指定カテゴリの詳細を取得します。",
	},
	"categories/update": {
		summary: "カテゴリを更新",
		description: "カテゴリの情報を更新します。",
	},
	ping: {
		summary: "疎通確認",
		description: "API の疎通確認（ping）を行います。",
	},
	"pinned-users": {
		summary: "ピン留めユーザー一覧を取得",
		description: "インスタンスでピン留めされているユーザー一覧を取得します。",
	},
	"recommended-instances": {
		summary: "おすすめインスタンス一覧を取得",
		description: "おすすめのリモートインスタンス一覧を取得します。",
	},
	"custom-motd": {
		summary: "カスタム MOTD を取得",
		description: "カスタムの MOTD（ログイン時メッセージ）を取得します。",
	},
	"custom-splash-icons": {
		summary: "カスタムスプラッシュアイコンを取得",
		description: "スプラッシュ画面用のアイコン一覧を取得します。",
	},
	"latest-version": {
		summary: "最新バージョン情報を取得",
		description: "ソフトウェアの最新バージョン情報を取得します。",
	},
	patrons: {
		summary: "パトロン一覧を取得",
		description: "パトロン（支援者）一覧を取得します。",
	},
	release: {
		summary: "リリース情報を取得",
		description: "リリースノート等の情報を取得します。",
	},
	"promo/read": {
		summary: "プロモを既読にする",
		description: "指定プロモを既読にします。",
	},
	"request-reset-password": {
		summary: "パスワードリセットを依頼",
		description: "パスワードリセットのメール送信を依頼します。",
	},
	"reset-db": {
		summary: "DB をリセット",
		description: "開発用にデータベースをリセットします。非本番用。",
	},
	"reset-password": {
		summary: "パスワードをリセット",
		description: "トークンを使ってパスワードをリセットします。",
	},
	"server-info": {
		summary: "サーバー情報を取得",
		description: "サーバーのバージョン・稼働情報を取得します。",
	},
	stats: {
		summary: "統計情報を取得",
		description: "インスタンスの統計情報を取得します。",
	},
	"sw/register": {
		summary: "Service Worker を登録",
		description: "プッシュ通知用の Service Worker を登録します。",
	},
	"sw/unregister": {
		summary: "Service Worker の登録を解除",
		description: "Service Worker の登録を解除します。",
	},
	"sw/show-registration": {
		summary: "Service Worker 登録情報を取得",
		description: "登録済み Service Worker の情報を取得します。",
	},
	"sw/update-registration": {
		summary: "Service Worker 登録を更新",
		description: "Service Worker の登録情報を更新します。",
	},
	test: {
		summary: "テスト用エンドポイント",
		description: "開発・テスト用のエンドポイントです。非本番用。",
	},
	"username/available": {
		summary: "ユーザー名の利用可否を確認",
		description: "指定ユーザー名が登録に利用可能か確認します。",
	},
	users: {
		summary: "ユーザー一覧を取得",
		description: "複数 ID のユーザーを一括取得します。",
	},
	"users/clips": {
		summary: "ユーザーのクリップ一覧を取得",
		description: "指定ユーザーが作成したクリップ一覧を取得します。",
	},
	"users/followers": {
		summary: "フォロワー一覧を取得",
		description: "指定ユーザーのフォロワー一覧を取得します。",
	},
	"users/following": {
		summary: "フォロー一覧を取得",
		description: "指定ユーザーがフォローしている一覧を取得します。",
	},
	"users/gallery/posts": {
		summary: "ユーザーのギャラリー投稿一覧を取得",
		description: "指定ユーザーのギャラリー投稿一覧を取得します。",
	},
	"users/get-frequently-replied-users": {
		summary: "よく返信するユーザー一覧を取得",
		description: "指定ユーザーがよく返信しているユーザー一覧を取得します。",
	},
	"users/groups/create": {
		summary: "ユーザーグループを作成",
		description: "新規ユーザーグループを作成します。",
	},
	"users/groups/delete": {
		summary: "ユーザーグループを削除",
		description: "指定ユーザーグループを削除します。",
	},
	"users/groups/invitations/accept": {
		summary: "グループ招待を承認",
		description: "ユーザーグループへの招待を承認します。",
	},
	"users/groups/invitations/reject": {
		summary: "グループ招待を拒否",
		description: "ユーザーグループへの招待を拒否します。",
	},
	"users/groups/invite": {
		summary: "グループに招待",
		description: "指定ユーザーをユーザーグループに招待します。",
	},
	"users/groups/joined": {
		summary: "参加グループ一覧を取得",
		description: "自分が参加しているユーザーグループ一覧を取得します。",
	},
	"users/groups/leave": {
		summary: "グループから退出",
		description: "指定ユーザーグループから退出します。",
	},
	"users/groups/owned": {
		summary: "自分がオーナーのグループ一覧を取得",
		description: "自分がオーナーのユーザーグループ一覧を取得します。",
	},
	"users/groups/pull": {
		summary: "グループからユーザーを削除",
		description: "指定ユーザーをグループから削除します。",
	},
	"users/groups/show": {
		summary: "ユーザーグループ情報を取得",
		description: "指定ユーザーグループの詳細を取得します。",
	},
	"users/groups/transfer": {
		summary: "グループのオーナーを譲渡",
		description: "ユーザーグループのオーナー権限を他ユーザーに譲渡します。",
	},
	"users/groups/update": {
		summary: "ユーザーグループを更新",
		description: "ユーザーグループの名前等を更新します。",
	},
	"users/lists/create": {
		summary: "ユーザーリストを作成",
		description: "新規ユーザーリストを作成します。",
	},
	"users/lists/delete": {
		summary: "ユーザーリストを削除",
		description: "指定ユーザーリストを削除します。",
	},
	"users/lists/delete-all": {
		summary: "ユーザーリストを全削除",
		description: "指定ユーザーリストのメンバーを全削除します。",
	},
	"users/lists/list": {
		summary: "ユーザーリスト一覧を取得",
		description: "自分のユーザーリスト一覧を取得します。",
	},
	"users/lists/pull": {
		summary: "ユーザーリストからユーザーを削除",
		description: "指定ユーザーをユーザーリストから削除します。",
	},
	"users/lists/push": {
		summary: "ユーザーリストにユーザーを追加",
		description: "指定ユーザーをユーザーリストに追加します。",
	},
	"users/lists/show": {
		summary: "ユーザーリスト情報を取得",
		description: "指定ユーザーリストの詳細を取得します。",
	},
	"users/lists/update": {
		summary: "ユーザーリストを更新",
		description: "ユーザーリストの名前等を更新します。",
	},
	"users/featured-notes": {
		summary: "ユーザーのピン留めノートを取得",
		description: "指定ユーザーがピン留めしたノート一覧を取得します。",
	},
	"users/notes": {
		summary: "ユーザーのノート一覧を取得",
		description: "指定ユーザーのノート一覧を取得します。",
	},
	"users/pages": {
		summary: "ユーザーのページ一覧を取得",
		description: "指定ユーザーが作成したページ一覧を取得します。",
	},
	"users/categories": {
		summary: "ユーザーのカテゴリ一覧を取得",
		description: "指定ユーザーが作成したカテゴリ一覧を取得します。",
	},
	"users/reactions": {
		summary: "ユーザーが付けたリアクション一覧を取得",
		description: "指定ユーザーが付けたリアクション一覧を取得します。",
	},
	"users/recommendation": {
		summary: "おすすめユーザーを取得",
		description: "おすすめのユーザー一覧を取得します。",
	},
	"users/relation": {
		summary: "ユーザーとの関係を取得",
		description: "指定ユーザーとのフォロー・ブロック等の関係を取得します。",
	},
	"users/report-abuse": {
		summary: "ユーザーを報告",
		description: "指定ユーザーを通報します。",
	},
	"users/search-by-username-and-host": {
		summary: "ユーザー名・ホストで検索",
		description: "ユーザー名とホストでユーザーを検索します。",
	},
	"users/stats": {
		summary: "ユーザー統計を取得",
		description: "指定ユーザーのフォロワー数等の統計を取得します。",
	},
	"users/update-memo": {
		summary: "ユーザーメモを更新",
		description: "指定ユーザーに対する自分のメモを更新します。",
	},
	"users/emoji-stats": {
		summary: "ユーザーの絵文字統計を取得",
		description: "指定ユーザーの絵文字利用統計を取得します。",
	},
	"fetch-rss": {
		summary: "RSS を取得",
		description: "指定 URL の RSS を取得します。",
	},
	"get-sounds": {
		summary: "サウンド一覧を取得",
		description: "利用可能なサウンド一覧を取得します。",
	},
	invite: {
		summary: "招待コードを発行",
		description: "招待コードを発行します（管理者向け）。",
	},

	// #region 管理者向け（secure のため API ドキュメントには出ないがマップには定義）
	"admin/meta": {
		summary: "管理者用メタ情報を取得",
		description: "管理者向けのインスタンスメタ情報を取得します。",
	},
	"admin/abuse-user-reports": {
		summary: "通報一覧を取得",
		description: "ユーザー通報の一覧を取得します。",
	},
	"admin/accounts/create": {
		summary: "アカウントを管理者が作成",
		description: "管理者が新規アカウントを作成します。",
	},
	"admin/accounts/delete": {
		summary: "アカウントを管理者が削除",
		description: "管理者が指定アカウントを削除します。",
	},
	"admin/accounts/hosted": {
		summary: "ホスト済みアカウント一覧を取得",
		description: "このインスタンスのアカウント一覧を取得します。",
	},
	"admin/ad/create": {
		summary: "広告を作成",
		description: "管理者が広告を作成します。",
	},
	"admin/ad/delete": {
		summary: "広告を削除",
		description: "管理者が広告を削除します。",
	},
	"admin/ad/list": {
		summary: "広告一覧を取得",
		description: "管理者が広告一覧を取得します。",
	},
	"admin/ad/update": {
		summary: "広告を更新",
		description: "管理者が広告を更新します。",
	},
	"admin/announcements/create": {
		summary: "お知らせを作成",
		description: "管理者がお知らせを作成します。",
	},
	"admin/announcements/delete": {
		summary: "お知らせを削除",
		description: "管理者がお知らせを削除します。",
	},
	"admin/announcements/list": {
		summary: "お知らせ一覧を取得",
		description: "管理者がお知らせ一覧を取得します。",
	},
	"admin/announcements/update": {
		summary: "お知らせを更新",
		description: "管理者がお知らせを更新します。",
	},
	"admin/delete-all-files-of-a-user": {
		summary: "ユーザーの全ファイルを削除",
		description: "管理者が指定ユーザーのドライブファイルをすべて削除します。",
	},
	"admin/drive/clean-remote-files": {
		summary: "リモートファイルをクリーンアップ",
		description: "管理者がドライブのリモートファイルをクリーンアップします。",
	},
	"admin/drive/cleanup": {
		summary: "ドライブをクリーンアップ",
		description: "管理者がドライブの未使用ファイルをクリーンアップします。",
	},
	"admin/drive/files": {
		summary: "管理者がドライブファイル一覧を取得",
		description: "管理者が全ユーザーのドライブファイル一覧を取得します。",
	},
	"admin/drive/show-file": {
		summary: "管理者がファイル情報を取得",
		description: "管理者が指定ドライブファイルの情報を取得します。",
	},
	"admin/drive-capacity-override": {
		summary: "ドライブ容量を上書き",
		description: "管理者がユーザーのドライブ容量制限を上書きします。",
	},
	"admin/emoji/add": {
		summary: "絵文字を追加",
		description: "管理者がカスタム絵文字を追加します。",
	},
	"admin/emoji/add-aliases-bulk": {
		summary: "絵文字のエイリアスを一括追加",
		description: "管理者が絵文字のエイリアスを一括追加します。",
	},
	"admin/emoji/copy": {
		summary: "絵文字をコピー",
		description: "管理者がリモートの絵文字をコピーして追加します。",
	},
	"admin/emoji/delete": {
		summary: "絵文字を削除",
		description: "管理者がカスタム絵文字を削除します。",
	},
	"admin/emoji/delete-bulk": {
		summary: "絵文字を一括削除",
		description: "管理者が絵文字を一括削除します。",
	},
	"admin/emoji/import-zip": {
		summary: "ZIP から絵文字をインポート",
		description: "管理者が ZIP から絵文字を一括インポートします。",
	},
	"admin/emoji/list": {
		summary: "絵文字一覧を取得",
		description: "管理者が絵文字一覧を取得します。",
	},
	"admin/emoji/list-remote": {
		summary: "リモート絵文字一覧を取得",
		description: "管理者がリモートインスタンスの絵文字一覧を取得します。",
	},
	"admin/emoji/remove-aliases-bulk": {
		summary: "絵文字のエイリアスを一括削除",
		description: "管理者が絵文字のエイリアスを一括削除します。",
	},
	"admin/emoji/set-aliases-bulk": {
		summary: "絵文字のエイリアスを一括設定",
		description: "管理者が絵文字のエイリアスを一括設定します。",
	},
	"admin/emoji/set-category-bulk": {
		summary: "絵文字のカテゴリを一括設定",
		description: "管理者が絵文字のカテゴリを一括設定します。",
	},
	"admin/emoji/set-license-bulk": {
		summary: "絵文字のライセンスを一括設定",
		description: "管理者が絵文字のライセンスを一括設定します。",
	},
	"admin/emoji/reparse-license": {
		summary: "絵文字のライセンスを再解析",
		description: "管理者が絵文字のライセンス情報を再解析します。",
	},
	"admin/emoji/update": {
		summary: "絵文字を更新",
		description: "管理者が絵文字の情報を更新します。",
	},
	"admin/federation/delete-all-files": {
		summary: "リモートの全ファイルを削除",
		description: "管理者がリモートインスタンス由来のファイルを一括削除します。",
	},
	"admin/federation/refresh-remote-instance-metadata": {
		summary: "リモートインスタンスのメタを更新",
		description: "管理者がリモートインスタンスのメタ情報を再取得します。",
	},
	"admin/federation/remove-all-following": {
		summary: "リモートへのフォローを全解除",
		description: "管理者が指定インスタンスへのフォローをすべて解除します。",
	},
	"admin/federation/update-instance": {
		summary: "リモートインスタンス情報を更新",
		description: "管理者がリモートインスタンスの情報を更新します。",
	},
	"admin/get-index-stats": {
		summary: "インデックス統計を取得",
		description: "管理者が検索インデックスの統計を取得します。",
	},
	"admin/get-table-stats": {
		summary: "テーブル統計を取得",
		description: "管理者がデータベーステーブルの統計を取得します。",
	},
	"admin/get-user-ips": {
		summary: "ユーザーの IP 一覧を取得",
		description: "管理者が指定ユーザーのログイン IP 一覧を取得します。",
	},
	"admin/invite": {
		summary: "招待コードを発行",
		description: "管理者が招待コードを発行します。",
	},
	"admin/moderators/add": {
		summary: "モデレーターを追加",
		description: "管理者がモデレーターを追加します。",
	},
	"admin/moderators/remove": {
		summary: "モデレーターを削除",
		description: "管理者がモデレーターを削除します。",
	},
	"admin/promo/create": {
		summary: "プロモを作成",
		description: "管理者がプロモを作成します。",
	},
	"admin/queue/clear": {
		summary: "キューをクリア",
		description: "管理者がジョブキューをクリアします。",
	},
	"admin/queue/deliver-delayed": {
		summary: "遅延配信キューを取得",
		description: "管理者が遅延配信キューを取得します。",
	},
	"admin/queue/inbox-delayed": {
		summary: "遅延 inbox キューを取得",
		description: "管理者が遅延 inbox キューを取得します。",
	},
	"admin/queue/stats": {
		summary: "キュー統計を取得",
		description: "管理者がジョブキューの統計を取得します。",
	},
	"admin/relays/add": {
		summary: "リレーを追加",
		description: "管理者がリレーを追加します。",
	},
	"admin/relays/list": {
		summary: "リレー一覧を取得",
		description: "管理者がリレー一覧を取得します。",
	},
	"admin/relays/remove": {
		summary: "リレーを削除",
		description: "管理者がリレーを削除します。",
	},
	"admin/reset-password": {
		summary: "パスワードをリセット（管理者）",
		description: "管理者が指定ユーザーのパスワードをリセットします。",
	},
	"admin/resolve-abuse-user-report": {
		summary: "通報を解決",
		description: "管理者がユーザー通報を解決済みにします。",
	},
	"admin/search/index-all": {
		summary: "全インデックスを再構築",
		description: "管理者が検索インデックスを全件再構築します。",
	},
	"admin/send-email": {
		summary: "メールを送信",
		description: "管理者がユーザーにメールを送信します。",
	},
	"admin/send-mod-mail": {
		summary: "モデメールを送信",
		description: "管理者がモデレーションメールを送信します。",
	},
	"admin/server-info": {
		summary: "サーバー情報を取得（管理者）",
		description: "管理者がサーバーの詳細情報を取得します。",
	},
	"admin/performance-incidents": {
		summary: "パフォーマンスインシデント一覧を取得",
		description: "管理者がパフォーマンスインシデント一覧を取得します。",
	},
	"admin/clear-performance-incidents": {
		summary: "パフォーマンスインシデントをクリア",
		description: "管理者がパフォーマンスインシデントをクリアします。",
	},
	"admin/analyze-performance-incident": {
		summary: "パフォーマンスインシデントを分析",
		description: "管理者がパフォーマンスインシデントを分析します。",
	},
	"admin/get-performance-incident-prompt": {
		summary: "パフォーマンスインシデント用プロンプトを取得",
		description: "管理者がインシデント分析用のプロンプトを取得します。",
	},
	"admin/show-moderation-logs": {
		summary: "モデレーションログを取得",
		description: "管理者がモデレーションログを取得します。",
	},
	"admin/show-user": {
		summary: "ユーザー情報を取得（管理者）",
		description: "管理者が指定ユーザーの詳細情報を取得します。",
	},
	"admin/show-users": {
		summary: "ユーザー一覧を取得（管理者）",
		description: "管理者がユーザー一覧を取得します。",
	},
	"admin/silence-user": {
		summary: "ユーザーをサイレンス",
		description: "管理者が指定ユーザーをサイレンス（一部制限）します。",
	},
	"admin/suspend-user": {
		summary: "ユーザーをサスペンド",
		description: "管理者が指定ユーザーをサスペンド（凍結）します。",
	},
	"admin/canInvite-user": {
		summary: "ユーザーを招待可能にする",
		description: "管理者が指定ユーザーを招待可能にします。",
	},
	"admin/unsilence-user": {
		summary: "ユーザーのサイレンスを解除",
		description: "管理者が指定ユーザーのサイレンスを解除します。",
	},
	"admin/unsuspend-user": {
		summary: "ユーザーのサスペンドを解除",
		description: "管理者が指定ユーザーのサスペンドを解除します。",
	},
	"admin/cantInvite-user": {
		summary: "ユーザーを招待不可にする",
		description: "管理者が指定ユーザーを招待不可にします。",
	},
	"admin/update-meta": {
		summary: "メタ情報を更新",
		description: "管理者がインスタンスのメタ情報を更新します。",
	},
	"admin/vacuum": {
		summary: "VACUUM を実行",
		description: "管理者がデータベースの VACUUM を実行します。",
	},
	"admin/delete-account": {
		summary: "アカウントを削除（管理者）",
		description: "管理者が指定アカウントを削除します。",
	},
	"admin/update-user-note": {
		summary: "ユーザーメモを更新（管理者）",
		description: "管理者が指定ユーザーに対する管理者用メモを更新します。",
	},
};

/**
 * エンドポイント名からデフォルトの日本語要約を生成する（マップに無い場合のフォールバック）。
 * @internal
 */
function deriveSummaryJa(name: string): string {
	const part = name.split("/").pop() ?? name;
	const actionMap: Record<string, string> = {
		create: "を作成",
		delete: "を削除",
		show: "を取得",
		list: "の一覧を取得",
		update: "を更新",
		"mark-read": "を既読にする",
		"mark-all-as-read": "をすべて既読にする",
		add: "を追加",
		remove: "を削除",
		follow: "をフォロー",
		unfollow: "のフォローを解除",
		like: "をいいね",
		unlike: "のいいねを解除",
		accept: "を承認",
		reject: "を拒否",
		cancel: "をキャンセル",
		leave: "から退出",
		invite: "を招待",
		transfer: "を譲渡",
		push: "を追加",
		pull: "を削除",
		featured: "のおすすめを取得",
		search: "を検索",
		register: "を登録",
		unregister: "の登録を解除",
	};
	for (const [action, suffix] of Object.entries(actionMap)) {
		if (part === action || name.endsWith("/" + action)) {
			const resource = name.slice(0, -action.length - 1).split("/").pop() ?? name;
			const resourceJa: Record<string, string> = {
				notes: "ノート",
				users: "ユーザー",
				drive: "ドライブ",
				files: "ファイル",
				folders: "フォルダ",
				lists: "リスト",
				groups: "グループ",
				antennas: "アンテナ",
				clips: "クリップ",
				channels: "チャンネル",
				pages: "ページ",
				reactions: "リアクション",
				favorites: "お気に入り",
				following: "フォロー",
				blocking: "ブロック",
				mute: "ミュート",
				notifications: "通知",
				messaging: "メッセージ",
				webhooks: "ウェブフック",
				admin: "管理者",
				emoji: "絵文字",
			};
			const r = resourceJa[resource] ?? resource;
			return r + suffix;
		}
	}
	// フォールバック: パスをそのまま返す（英語のまま）
	return name;
}

export function genOpenapiSpec() {
	const tagNames = new Set<string>();
	for (const ep of endpoints) {
		if (ep.meta.tags) {
			for (const t of ep.meta.tags) {
				tagNames.add(t);
			}
		}
	}

	const spec = {
		openapi: "3.0.0",

		info: {
			version: "v1",
			title: "Cluckey API",
			description: [
				"**Cluckey API** は、このインスタンス用の REST API です。",
				"",
				"### 認証",
				"- 多くのエンドポイントでは **認証が不要** です（メタ情報の取得、ノートの閲覧など）。",
				"- 認証が必要な操作では、リクエストボディに **API キー `i`** を渡すか、**Bearer トークン**（Authorization ヘッダー）を使用してください。",
				"",
				"### 利用上の注意",
				"- ベース URL はこのインスタンスの API URL です。",
				"- 一部のエンドポイントではレートリミットが適用されます。",
			].join("\n"),
			"x-logo": { url: "/static-assets/api-doc.png" },
		},

		externalDocs: {
			description: "リポジトリ",
			url: "https://github.com/emtkmkk/mkkey",
		},

		tags: [...tagNames].sort().map((name) => ({
			name,
			description: TAG_DESCRIPTIONS[name] ?? name,
		})),

		"x-tagGroups": [
			{ name: "ユーザー・アカウント", tags: ["users", "account", "following", "lists", "groups"] },
			{
				name: "ノート・タイムライン",
				tags: ["notes", "clips", "antennas", "channels", "reactions", "favorites"],
			},
			{ name: "ドライブ・ファイル", tags: ["drive"] },
			{ name: "メッセージ・通知", tags: ["messaging", "notifications", "webhooks"] },
			{
				name: "インスタンス・メタ",
				tags: ["meta", "federation", "hashtags", "charts", "pages", "gallery", "categories", "endpoints"],
			},
			{ name: "認証・アプリ", tags: ["auth", "app", "reset password"] },
			{ name: "絵文字", tags: ["emoji", "emoji-import-request"] },
			{ name: "管理者", tags: ["admin"] },
			{ name: "開発・テスト", tags: ["non-productive"] },
		],

		servers: [
			{
				url: config.apiUrl,
			},
		],

		paths: {} as any,

		components: {
			schemas: schemas,

			securitySchemes: {
				ApiKeyAuth: {
					type: "apiKey",
					in: "body",
					name: "i",
				},
				// TODO: 残りの OAuth 対応ができたら oauth2 に変更する
				Bearer: {
					type: "http",
					scheme: "bearer",
				},
			},
		},
	};

	for (const endpoint of endpoints.filter((ep) => !ep.meta.secure)) {
		const errors = {} as any;

		if (endpoint.meta.errors) {
			for (const e of Object.values(endpoint.meta.errors)) {
				errors[e.code] = {
					value: {
						error: e,
					},
				};
			}
		}

		const resSchema = endpoint.meta.res
			? convertSchemaToOpenApiSchema(endpoint.meta.res)
			: {};

		const ja = ENDPOINT_DESCRIPTIONS_JA[endpoint.name];
		const descBody = ja?.description ?? endpoint.meta.description ?? "説明なし。";
		let desc = `${descBody}\n\n`;
		desc += endpoint.meta.requireCredential ? "**認証**: 必要" : "**認証**: 不要";
		if (endpoint.meta.kind) {
			desc += ` / **権限**: *${endpoint.meta.kind}*`;
		}

		const requestType = endpoint.meta.requireFile
			? "multipart/form-data"
			: "application/json";
		const schema = endpoint.params;

		if (endpoint.meta.requireFile) {
			schema.properties.file = {
				type: "string",
				format: "binary",
				description: "ファイル内容。",
			};
			schema.required.push("file");
		}

		const security = [
			{
				ApiKeyAuth: [],
			},
			{
				Bearer: [],
			},
		];
		if (!endpoint.meta.requireCredential) {
			// 認証を任意にするため追加
			security.push({});
		}

		const summary =
			ja?.summary ?? deriveSummaryJa(endpoint.name) ?? endpoint.name;
		const info = {
			operationId: endpoint.name,
			summary,
			description: desc,
			externalDocs: {
				description: "ソースコード",
				url: `https://github.com/emtkmkk/mkkey/blob/develop/packages/backend/src/server/api/endpoints/${endpoint.name}.ts`,
			},
			tags: endpoint.meta.tags || undefined,
			security,
			requestBody: {
				required: true,
				content: {
					[requestType]: {
						schema,
					},
				},
			},
			responses: (() => {
				const res: Record<string, any> = {
					...(endpoint.meta.res
						? {
								"200": {
									description: "OK（結果あり）",
									content: {
										"application/json": {
											schema: resSchema,
										},
									},
								},
						  }
						: {
								"204": {
									description: "OK（結果なし）",
								},
						  }),
					"400": {
						description: "クライアントエラー",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: { ...errors, ...basicErrors["400"] },
							},
						},
					},
				};
				// 認証必須エンドポイントのみ 401 を返しうる（call.ts: requireCredential && user == null）
				if (endpoint.meta.requireCredential) {
					res["401"] = {
						description: "認証エラー",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["401"],
							},
						},
					};
				}
				// 認証・権限系エンドポイントのみ 403 を返しうる（凍結・管理者・モデレータ・secure）
				if (
					endpoint.meta.requireCredential ||
					endpoint.meta.requireAdmin ||
					endpoint.meta.requireModerator ||
					endpoint.meta.secure
				) {
					res["403"] = {
						description: "禁止エラー",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["403"],
							},
						},
					};
				}
				if (endpoint.meta.limit) {
					res["429"] = {
						description: "リクエスト過多",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["429"],
							},
						},
					};
				}
				res["500"] = {
					description: "サーバー内部エラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["500"],
						},
					},
				};
				return res;
			})(),
		};

		const path = {
			post: info,
		};
		if (endpoint.meta.allowGet) {
			path.get = { ...info };
			// GET リクエストでは API Key 認証は許可しない
			path.get.security = path.get.security.filter(
				(elem) => !Object.prototype.hasOwnProperty.call(elem, "ApiKeyAuth"),
			);
		}

		spec.paths[`/${endpoint.name}`] = path;
	}

	return spec;
}
