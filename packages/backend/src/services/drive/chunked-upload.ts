/**
 * @packageDocumentation
 *
 * Cloudflare の単一リクエスト上限を避けるための分割アップロードを管理する。
 *
 * @remarks
 * セッション状態は Web ワーカー間で共有できる Redis に置き、ファイル本体は同一ホストの
 * 一時ディスクへストリーム書き込みする。完成後は必ず既存の {@link addFile} を通す。
 *
 * @internal
 */
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import config from "@/config/index.js";
import { redisClient } from "@/db/redis.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { User } from "@/models/entities/user.js";
import type { DriveFileProgressReporter } from "@/misc/drive-file-progress.js";
import { addFile } from "./add-file.js";

/** Cloudflare の 100 MB より十分小さいパートサイズ。 */
export const CHUNKED_UPLOAD_PART_SIZE = 64 * 1024 * 1024;
/** 公式クライアントが分割へ切り替える推奨サイズ。 */
export const CHUNKED_UPLOAD_THRESHOLD = 90 * 1024 * 1024;
/** 最終操作からセッションを保持する秒数。 */
const SESSION_TTL_SECONDS = 24 * 60 * 60;
/** 1 ユーザーが同時に予約できるセッション数。 */
const MAX_ACTIVE_SESSIONS_PER_USER = 2;
/** 分割アップロード全体で予約できる一時ディスク容量。 */
const MAX_RESERVED_BYTES = 8 * 1024 * 1024 * 1024;
/** complete と part の競合を防ぐロックの有効時間。 */
const UPLOAD_LOCK_TTL_MS = 30 * 60 * 1000;
/** 一時データをまとめる専用ディレクトリ。 */
const UPLOAD_ROOT = join(tmpdir(), "mkkey-chunked-upload");
/** API で受け付ける UUID 形式。 */
const UPLOAD_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 分割アップロード開始時に保持する情報。 */
export type ChunkedUploadInit = {
	name: string | null;
	size: number;
	folderId: string | null;
	comment: string | null;
	isSensitive: boolean;
	force: boolean;
	marker: string | null;
};

/** Redis に保持する分割アップロードセッション。 */
type ChunkedUploadSession = ChunkedUploadInit & {
	uploadId: string;
	userId: User["id"];
	totalParts: number;
	state: "uploading" | "processing";
	createdAt: number;
	touchedAt: number;
};

/** 分割アップロード固有の検証エラー。 */
export class ChunkedUploadError extends Error {
	/** 機械判定用の理由。 */
	public readonly code: string;

	/**
	 * エラーを生成する。
	 *
	 * @param code - 機械判定用コード
	 * @param message - ログ向け説明
	 */
	public constructor(code: string, message: string) {
		super(message);
		this.name = "ChunkedUploadError";
		this.code = code;
	}
}

/** セッション本体の Redis キーを返す。 */
const sessionKey = (uploadId: string) => `drive:chunked-upload:${uploadId}`;
/** 受信済みパート集合の Redis キーを返す。 */
const partsKey = (uploadId: string) => `drive:chunked-upload:${uploadId}:parts`;
/** ユーザー単位の予約一覧を返す。 */
const userReservationsKey = (userId: string) =>
	`drive:chunked-upload:reservations:user:${userId}`;
/** サーバ全体の予約一覧。 */
const globalReservationsKey = "drive:chunked-upload:reservations:global";
/** 予約一覧の member。サイズを含め、期限切れ Redis セッション後も集計できる。 */
const reservationMember = (uploadId: string, size: number) =>
	`${uploadId}:${size}`;

/** uploadId が固定長の UUID であることを検証する。 */
function assertUploadId(uploadId: string): void {
	if (!UPLOAD_ID_PATTERN.test(uploadId)) {
		throw new ChunkedUploadError("INVALID_UPLOAD_ID", "Invalid upload id");
	}
}

/** uploadId から専用ディレクトリを安全に解決する。 */
function uploadDirectory(uploadId: string): string {
	assertUploadId(uploadId);
	const directory = resolve(UPLOAD_ROOT, uploadId);
	if (
		!directory.startsWith(
			`${resolve(UPLOAD_ROOT)}${process.platform === "win32" ? "\\" : "/"}`,
		)
	) {
		throw new ChunkedUploadError("INVALID_UPLOAD_ID", "Unsafe upload path");
	}
	return directory;
}

/** セッションの完成ファイルパスを返す。 */
const uploadDataPath = (uploadId: string) =>
	join(uploadDirectory(uploadId), "data");

/** Redis ロックを所有者確認付きで解放する。 */
async function releaseLock(key: string, token: string): Promise<void> {
	await redisClient.eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		1,
		key,
		token,
	);
}

/** 同一アップロードの更新を直列化する。 */
async function withLock<T>(
	key: string,
	callback: () => Promise<T>,
): Promise<T> {
	const token = randomUUID();
	const acquired = await redisClient.set(
		key,
		token,
		"PX",
		UPLOAD_LOCK_TTL_MS,
		"NX",
	);
	if (acquired !== "OK") {
		throw new ChunkedUploadError("UPLOAD_BUSY", "Upload is being updated");
	}
	try {
		return await callback();
	} finally {
		await releaseLock(key, token).catch(() => {});
	}
}

/** セッションを読み込み、所有者を検証する。 */
async function getOwnedSession(
	uploadId: string,
	userId: User["id"],
): Promise<ChunkedUploadSession> {
	const raw = await redisClient.get(sessionKey(uploadId));
	if (raw == null) {
		throw new ChunkedUploadError("UPLOAD_EXPIRED", "Upload session not found");
	}
	const session = JSON.parse(raw) as ChunkedUploadSession;
	if (session.userId !== userId) {
		throw new ChunkedUploadError("UPLOAD_NOT_OWNED", "Upload owner mismatch");
	}
	return session;
}

/** セッションと予約の期限を最終操作から延長する。 */
async function touchSession(session: ChunkedUploadSession): Promise<void> {
	const now = Date.now();
	const expiresAt = now + SESSION_TTL_SECONDS * 1000;
	session.touchedAt = now;
	const member = reservationMember(session.uploadId, session.size);
	await redisClient
		.multi()
		.set(
			sessionKey(session.uploadId),
			JSON.stringify(session),
			"EX",
			SESSION_TTL_SECONDS,
		)
		.expire(partsKey(session.uploadId), SESSION_TTL_SECONDS)
		.zadd(globalReservationsKey, expiresAt, member)
		.zadd(userReservationsKey(session.userId), expiresAt, member)
		.exec();
	await fs
		.utimes(uploadDirectory(session.uploadId), new Date(), new Date())
		.catch(() => {});
}

/** セッション、予約、一時ファイルを解放する。 */
async function cleanupSession(session: ChunkedUploadSession): Promise<void> {
	const member = reservationMember(session.uploadId, session.size);
	await redisClient
		.multi()
		.del(sessionKey(session.uploadId))
		.del(partsKey(session.uploadId))
		.zrem(globalReservationsKey, member)
		.zrem(userReservationsKey(session.userId), member)
		.exec()
		.catch(() => {});
	await fs.rm(uploadDirectory(session.uploadId), {
		recursive: true,
		force: true,
	});
}

/** 予約 member に含めたサイズを取り出す。 */
function reservedSize(member: string): number {
	const separator = member.lastIndexOf(":");
	const size = Number(member.slice(separator + 1));
	return Number.isSafeInteger(size) && size > 0 ? size : 0;
}

/**
 * 分割アップロードを開始する。
 *
 * @param userId - 所有ユーザー
 * @param input - ファイル情報と Drive 保存条件
 * @returns クライアントが使用するセッション情報
 * @public
 */
export async function initChunkedUpload(
	userId: User["id"],
	input: ChunkedUploadInit,
) {
	const maxFileSize = config.maxFileSize ?? 262144000;
	if (
		!Number.isSafeInteger(input.size) ||
		input.size < CHUNKED_UPLOAD_THRESHOLD ||
		input.size > maxFileSize
	) {
		throw new ChunkedUploadError(
			"INVALID_FILE_SIZE",
			"File size is outside chunked upload limits",
		);
	}

	return await withLock("drive:chunked-upload:reservations:lock", async () => {
		const now = Date.now();
		await redisClient
			.multi()
			.zremrangebyscore(globalReservationsKey, 0, now)
			.zremrangebyscore(userReservationsKey(userId), 0, now)
			.exec();
		const [userMembers, globalMembers] = await Promise.all([
			redisClient.zrangebyscore(userReservationsKey(userId), now, "+inf"),
			redisClient.zrangebyscore(globalReservationsKey, now, "+inf"),
		]);
		if (userMembers.length >= MAX_ACTIVE_SESSIONS_PER_USER) {
			throw new ChunkedUploadError(
				"TOO_MANY_UPLOADS",
				"Too many active uploads",
			);
		}
		const reserved = globalMembers.reduce(
			(total, member) => total + reservedSize(member),
			0,
		);
		if (reserved + input.size > MAX_RESERVED_BYTES) {
			throw new ChunkedUploadError(
				"TEMPORARY_STORAGE_FULL",
				"Chunked upload storage is reserved",
			);
		}

		const uploadId = randomUUID();
		const nowDate = Date.now();
		const session: ChunkedUploadSession = {
			...input,
			uploadId,
			userId,
			totalParts: Math.ceil(input.size / CHUNKED_UPLOAD_PART_SIZE),
			state: "uploading",
			createdAt: nowDate,
			touchedAt: nowDate,
		};
		const directory = uploadDirectory(uploadId);
		await fs.mkdir(UPLOAD_ROOT, { recursive: true });
		await fs.mkdir(directory, { recursive: false });
		const handle = await fs.open(uploadDataPath(uploadId), "wx");
		try {
			await handle.truncate(input.size);
		} finally {
			await handle.close();
		}
		try {
			await touchSession(session);
		} catch (error) {
			await fs.rm(directory, { recursive: true, force: true });
			throw error;
		}

		return {
			uploadId,
			chunkSize: CHUNKED_UPLOAD_PART_SIZE,
			totalParts: session.totalParts,
			expiresAt: new Date(nowDate + SESSION_TTL_SECONDS * 1000).toISOString(),
		};
	});
}

/**
 * 受信した 1 パートを完成ファイルの所定位置へ書き込む。
 *
 * @param uploadId - セッション ID
 * @param userId - 認証ユーザー
 * @param partNumber - 1 始まりのパート番号
 * @param partPath - Multer が作った一時ファイル
 * @returns 受信済みの合計バイト数
 * @public
 */
export async function writeChunkedUploadPart(
	uploadId: string,
	userId: User["id"],
	partNumber: number,
	partPath: string,
): Promise<number> {
	assertUploadId(uploadId);
	return await withLock(`drive:chunked-upload:lock:${uploadId}`, async () => {
		const session = await getOwnedSession(uploadId, userId);
		if (session.state !== "uploading") {
			throw new ChunkedUploadError(
				"UPLOAD_NOT_WRITABLE",
				"Upload is not accepting parts",
			);
		}
		if (
			!Number.isInteger(partNumber) ||
			partNumber < 1 ||
			partNumber > session.totalParts
		) {
			throw new ChunkedUploadError(
				"INVALID_PART",
				"Part number is outside range",
			);
		}
		const offset = (partNumber - 1) * CHUNKED_UPLOAD_PART_SIZE;
		const expectedSize = Math.min(
			CHUNKED_UPLOAD_PART_SIZE,
			session.size - offset,
		);
		const partStat = await fs.stat(partPath);
		if (partStat.size !== expectedSize) {
			throw new ChunkedUploadError(
				"INVALID_PART_SIZE",
				"Part size does not match the session",
			);
		}

		await pipeline(
			createReadStream(partPath),
			createWriteStream(uploadDataPath(uploadId), {
				flags: "r+",
				start: offset,
			}),
		);
		await redisClient.sadd(partsKey(uploadId), String(partNumber));
		await touchSession(session);
		const receivedParts = await redisClient.smembers(partsKey(uploadId));
		return receivedParts.reduce((total, value) => {
			const number = Number(value);
			const start = (number - 1) * CHUNKED_UPLOAD_PART_SIZE;
			return total + Math.min(CHUNKED_UPLOAD_PART_SIZE, session.size - start);
		}, 0);
	});
}

/**
 * 完成ファイルを既存 Drive 登録処理へ渡す。
 *
 * @param uploadId - セッション ID
 * @param user - 認証ユーザー
 * @param requestIp - 完了リクエストの送信元 IP
 * @param requestHeaders - 完了リクエストのヘッダー
 * @param createProgressReporter - セッションの marker から進捗通知先を作る関数
 * @returns 作成された DriveFile
 * @public
 */
export async function completeChunkedUpload(
	uploadId: string,
	user: {
		id: User["id"];
		username: User["username"];
		host: User["host"];
		driveCapacityOverrideMb: User["driveCapacityOverrideMb"];
	},
	requestIp: string | null,
	requestHeaders: Record<string, string> | null,
	createProgressReporter: (
		marker: string | null,
	) => DriveFileProgressReporter | null,
): Promise<DriveFile> {
	assertUploadId(uploadId);
	return await withLock(`drive:chunked-upload:lock:${uploadId}`, async () => {
		const session = await getOwnedSession(uploadId, user.id);
		if (session.state !== "uploading") {
			throw new ChunkedUploadError(
				"UPLOAD_NOT_COMPLETABLE",
				"Upload cannot be completed",
			);
		}
		const receivedParts = new Set(
			await redisClient.smembers(partsKey(uploadId)),
		);
		for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
			if (!receivedParts.has(String(partNumber))) {
				throw new ChunkedUploadError(
					"MISSING_PART",
					`Part ${partNumber} is missing`,
				);
			}
		}
		session.state = "processing";
		await touchSession(session);
		const onProgress = createProgressReporter(session.marker);

		try {
			const file = await addFile({
				user,
				path: uploadDataPath(uploadId),
				name: session.name,
				comment: session.comment,
				folderId: session.folderId,
				force: session.force,
				sensitive: session.isSensitive,
				requestIp,
				requestHeaders,
				onProgress,
			});
			await cleanupSession(session);
			return file;
		} catch (error) {
			await cleanupSession(session).catch(() => {});
			throw error;
		}
	});
}

/** 所有する分割アップロードを中止し、一時データを削除する。 */
export async function abortChunkedUpload(
	uploadId: string,
	userId: User["id"],
): Promise<void> {
	assertUploadId(uploadId);
	const session = await getOwnedSession(uploadId, userId).catch((error) => {
		if (error instanceof ChunkedUploadError && error.code === "UPLOAD_EXPIRED")
			return null;
		throw error;
	});
	if (session == null) return;
	await withLock(`drive:chunked-upload:lock:${uploadId}`, async () => {
		await cleanupSession(session);
	});
}

/** master の janitor から呼び、期限切れの一時ディレクトリを回収する。 */
export async function cleanupExpiredChunkedUploads(): Promise<void> {
	await fs.mkdir(UPLOAD_ROOT, { recursive: true });
	const entries = await fs.readdir(UPLOAD_ROOT, { withFileTypes: true });
	const expiredBefore = Date.now() - SESSION_TTL_SECONDS * 1000;
	for (const entry of entries) {
		if (!(entry.isDirectory() && UPLOAD_ID_PATTERN.test(entry.name))) continue;
		const directory = uploadDirectory(entry.name);
		const stat = await fs.stat(directory).catch(() => null);
		if (stat != null && stat.mtimeMs < expiredBefore) {
			await fs.rm(directory, { recursive: true, force: true });
		}
	}
}
