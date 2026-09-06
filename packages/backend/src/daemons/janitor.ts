/**
 * @packageDocumentation
 *
 * データベースを定期的にクリーンアップするデーモン（古いチャレンジ削除など）。
 *
 * @remarks
 * - **役割**: 古い認証用レコードと期限切れ分割アップロードを定期的に削除する。
 *
 * @internal
 */
// TODO: 消したい

const interval = 30 * 60 * 1000;
import {
	AttestationChallenges,
	PasskeyLoginChallenges,
} from "@/models/index.js";
import { cleanupExpiredChunkedUploads } from "@/services/drive/chunked-upload.js";
import { LessThan } from "typeorm";

/**
 * データベースを定期的にクリーンアップする
 */
export default function () {
	async function tick() {
		await AttestationChallenges.delete({
			createdAt: LessThan(new Date(new Date().getTime() - 5 * 60 * 1000)),
		});

		await PasskeyLoginChallenges.delete({
			createdAt: LessThan(new Date(new Date().getTime() - 5 * 60 * 1000)),
		});

		await cleanupExpiredChunkedUploads();
	}

	tick();

	setInterval(tick, interval);
}
