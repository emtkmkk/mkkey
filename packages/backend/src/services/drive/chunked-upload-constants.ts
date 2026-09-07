/**
 * @packageDocumentation
 *
 * 分割アップロードのサイズ境界を定義する。
 *
 * @remarks
 * パート本体のサイズと Multer に渡す上限は意図的に分けている。
 * Busboy はファイルサイズが上限値と等しくなった時点でも超過扱いにするため、
 * 受信上限には正常な最大パートより 1 byte 大きい値を指定する。
 *
 * @internal
 */

/**
 * 分割アップロードで送る最大パートサイズ。
 *
 * @remarks
 * Cloudflare の 100 MB 制限より十分小さい 64 MiB に固定する。
 *
 * @internal
 */
export const CHUNKED_UPLOAD_PART_SIZE = 64 * 1024 * 1024;

/**
 * Multer が分割パートを受信するときのファイルサイズ上限。
 *
 * @remarks
 * 上限値そのものは Busboy に拒否されるため、64 MiB を許可しつつ、それより
 * 大きいパートを拒否できる最小値として 1 byte だけ加算する。
 *
 * @internal
 */
export const CHUNKED_UPLOAD_PART_FILE_SIZE_LIMIT =
	CHUNKED_UPLOAD_PART_SIZE + 1;

/**
 * 公式クライアントが分割アップロードへ切り替えるサイズ。
 *
 * @remarks
 * 単一リクエストの multipart 付加分を考慮し、Cloudflare の上限より手前で切り替える。
 *
 * @internal
 */
export const CHUNKED_UPLOAD_THRESHOLD = 90 * 1024 * 1024;
