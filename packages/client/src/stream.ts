/**
 * @packageDocumentation
 *
 * Misskey 互換のストリーミング（WebSocket）接続を生成し、Vue のリアクティブ外に置くエントリ。
 *
 * @remarks
 * NOTE: ブラウザの `WebSocket` API ではカスタムリクエストヘッダーを付与できないため、HTTP API で付けている `X-Mkkey-Client` はストリーミングには載らない。経路判別は接続先 URL・トークン・サーバ側ログに依存する。
 *
 * @public
 */
import * as Misskey from "calckey-js";
import { markRaw } from "vue";
import { $i } from "@/account";
import { url } from "@/config";

export const stream = markRaw(
	new Misskey.Stream(
		url,
		$i
			? {
					token: $i.token,
			  }
			: null,
	),
);
