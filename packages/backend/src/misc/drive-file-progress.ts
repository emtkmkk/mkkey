/**
 * @packageDocumentation
 *
 * ドライブへの登録処理の進捗を表す型。
 *
 * @remarks
 * ストリームの型定義（server/api/stream/types）と実処理（services/drive/add-file）の
 * 双方から参照するため、依存を持たないここに置いて循環参照を避けている。
 *
 * @public
 */

/**
 * ドライブへの登録処理の段階。
 *
 * リクエストボディの送信が終わってからファイルが作成されるまでの間、
 * クライアントに「今サーバが何をしているか」を伝えるために使う。
 *
 * - downloading: URL からのアップロード時、元ファイルの取得
 * - analyzing: ハッシュ計算・種別判定・画像情報の取得
 * - detecting: センシティブ判定
 * - generating: webpublic / サムネイルの生成
 * - storing: ストレージへの保存
 * - saving: DB への登録
 */
export type DriveFileProcessStage =
	| "downloading"
	| "analyzing"
	| "detecting"
	| "generating"
	| "storing"
	| "saving";

/**
 * 進捗の通知先。
 *
 * @param stage - 現在の段階
 * @param progress - 段階内の進捗（0-100）。算出できない段階では省略する
 */
export type DriveFileProgressReporter = (
	stage: DriveFileProcessStage,
	progress?: number | null,
) => void;
