/**
 * @packageDocumentation
 *
 * PostgreSQL（TypeORM DataSource）の初期化。メイン接続と集計用接続プールを扱う。
 *
 * @remarks
 * - **役割**: 起動時に DataSource を初期化。メイン DB と statsUser 用の接続を提供。getStatsDataSource で集計用を取得。
 * - https://github.com/typeorm/typeorm/issues/2400 の workaround で bigint を Number にパースしている。
 *
 * @see {@link config} DB 設定
 * @internal
 */
// https://github.com/typeorm/typeorm/issues/2400
import pg from "pg";
pg.types.setTypeParser(20, Number);

import type { Logger } from "typeorm";
import { DataSource } from "typeorm";
import * as highlight from "cli-highlight";
import config from "@/config/index.js";

import { User } from "@/models/entities/user.js";
import { ModerationWarningPopupAck } from "@/models/entities/moderation-warning-popup-ack.js";
import { NoteReferenceCache } from "@/models/entities/note-reference-cache.js";
import { DriveFile } from "@/models/entities/drive-file.js";
import { DriveFolder } from "@/models/entities/drive-folder.js";
import { AccessToken } from "@/models/entities/access-token.js";
import { App } from "@/models/entities/app.js";
import { PollVote } from "@/models/entities/poll-vote.js";
import { Note } from "@/models/entities/note.js";
import { NoteReaction } from "@/models/entities/note-reaction.js";
import { NoteWatching } from "@/models/entities/note-watching.js";
import { NoteThreadMuting } from "@/models/entities/note-thread-muting.js";
import { NoteUnread } from "@/models/entities/note-unread.js";
import { Notification } from "@/models/entities/notification.js";
import { Meta } from "@/models/entities/meta.js";
import { Following } from "@/models/entities/following.js";
import { Instance } from "@/models/entities/instance.js";
import { Muting } from "@/models/entities/muting.js";
import { SwSubscription } from "@/models/entities/sw-subscription.js";
import { Blocking } from "@/models/entities/blocking.js";
import { UserList } from "@/models/entities/user-list.js";
import { UserListJoining } from "@/models/entities/user-list-joining.js";
import { UserGroup } from "@/models/entities/user-group.js";
import { UserGroupJoining } from "@/models/entities/user-group-joining.js";
import { UserGroupInvitation } from "@/models/entities/user-group-invitation.js";
import { Hashtag } from "@/models/entities/hashtag.js";
import { NoteFavorite } from "@/models/entities/note-favorite.js";
import { AbuseUserReport } from "@/models/entities/abuse-user-report.js";
import { RegistrationTicket } from "@/models/entities/registration-tickets.js";
import { MessagingMessage } from "@/models/entities/messaging-message.js";
import { Signin } from "@/models/entities/signin.js";
import { AuthSession } from "@/models/entities/auth-session.js";
import { FollowRequest } from "@/models/entities/follow-request.js";
import { FollowReconfirm } from "@/models/entities/follow-reconfirm.js";
import { Emoji } from "@/models/entities/emoji.js";
import { EmojiCustomCategory } from "@/models/entities/emoji-custom-category.js";
import { UserNotePining } from "@/models/entities/user-note-pining.js";
import { Poll } from "@/models/entities/poll.js";
import { UserKeypair } from "@/models/entities/user-keypair.js";
import { UserPublickey } from "@/models/entities/user-publickey.js";
import { UserProfile } from "@/models/entities/user-profile.js";
import { UserSecurityKey } from "@/models/entities/user-security-key.js";
import { AttestationChallenge } from "@/models/entities/attestation-challenge.js";
import { Page } from "@/models/entities/page.js";
import { PageLike } from "@/models/entities/page-like.js";
import { GalleryPost } from "@/models/entities/gallery-post.js";
import { GalleryLike } from "@/models/entities/gallery-like.js";
import { ModerationLog } from "@/models/entities/moderation-log.js";
import { UsedUsername } from "@/models/entities/used-username.js";
import { Announcement } from "@/models/entities/announcement.js";
import { AnnouncementRead } from "@/models/entities/announcement-read.js";
import { Clip } from "@/models/entities/clip.js";
import { ClipNote } from "@/models/entities/clip-note.js";
import { Antenna } from "@/models/entities/antenna.js";
import { AntennaNote } from "@/models/entities/antenna-note.js";
import { PromoNote } from "@/models/entities/promo-note.js";
import { PromoRead } from "@/models/entities/promo-read.js";
import { Relay } from "@/models/entities/relay.js";
import { MutedNote } from "@/models/entities/muted-note.js";
import { Channel } from "@/models/entities/channel.js";
import { ChannelFollowing } from "@/models/entities/channel-following.js";
import { ChannelNotePining } from "@/models/entities/channel-note-pining.js";
import { RegistryItem } from "@/models/entities/registry-item.js";
import { Ad } from "@/models/entities/ad.js";
import { PasswordResetRequest } from "@/models/entities/password-reset-request.js";
import { UserPending } from "@/models/entities/user-pending.js";
import { Webhook } from "@/models/entities/webhook.js";
import { UserIp } from "@/models/entities/user-ip.js";
import { NoteEdit } from "@/models/entities/note-edit.js";
import { UserMemo } from "@/models/entities/user-memo.js";
import { UserSupport } from "@/models/entities/user-support.js";
import { PasskeyLoginChallenge } from "@/models/entities/passkey-login-challenge.js";
import { EmojiImportRequest } from "@/models/entities/emoji-import-request.js";
import { EmojiImportDenied } from "@/models/entities/emoji-import-denied.js";

import { entities as charts } from "@/services/chart/entities.js";
import { envOption } from "../env.js";
import { dbLogger } from "./logger.js";
import { redisClient } from "./redis.js";
import { notifyDbSlowQuery } from "@/queue/adaptive-queue-throttle.js";

const sqlLogger = dbLogger.createSubLogger("sql", "gray", false);

class MyCustomLogger implements Logger {
	private highlight(sql: string) {
		return highlight.highlight(sql, {
			language: "sql",
			ignoreIllegals: true,
		});
	}

	public logQuery(query: string, parameters?: any[]) {
		sqlLogger.info(this.highlight(query).substring(0, 100));
	}

	public logQueryError(error: string, query: string, parameters?: any[]) {
		sqlLogger.error(this.highlight(query));
	}

	public logQuerySlow(time: number, query: string, parameters?: any[]) {
		notifyDbSlowQuery(time);
		sqlLogger.warn(this.highlight(query));
	}

	public logSchemaBuild(message: string) {
		sqlLogger.info(message);
	}

	public log(message: string) {
		sqlLogger.info(message);
	}

	public logMigration(message: string) {
		sqlLogger.info(message);
	}
}

export const entities = [
	Announcement,
	AnnouncementRead,
	Meta,
	Instance,
	App,
	AuthSession,
	AccessToken,
	User,
	ModerationWarningPopupAck,
	UserProfile,
	UserKeypair,
	UserPublickey,
	UserList,
	UserListJoining,
	UserGroup,
	UserGroupJoining,
	UserGroupInvitation,
	UserNotePining,
	UserSecurityKey,
	UserMemo,
	UserSupport,
	UsedUsername,
	AttestationChallenge,
	PasskeyLoginChallenge,
	Following,
	FollowRequest,
	FollowReconfirm,
	Muting,
	Blocking,
	Note,
	NoteReferenceCache,
	NoteEdit,
	NoteFavorite,
	NoteReaction,
	NoteWatching,
	NoteThreadMuting,
	NoteUnread,
	Page,
	PageLike,
	GalleryPost,
	GalleryLike,
	DriveFile,
	DriveFolder,
	Poll,
	PollVote,
	Notification,
	Emoji,
	EmojiCustomCategory,
	EmojiImportRequest,
	EmojiImportDenied,
	Hashtag,
	SwSubscription,
	AbuseUserReport,
	RegistrationTicket,
	MessagingMessage,
	Signin,
	ModerationLog,
	Clip,
	ClipNote,
	Antenna,
	AntennaNote,
	PromoNote,
	PromoRead,
	Relay,
	MutedNote,
	Channel,
	ChannelFollowing,
	ChannelNotePining,
	RegistryItem,
	Ad,
	PasswordResetRequest,
	UserPending,
	Webhook,
	UserIp,
	...charts,
];

const log = process.env.NODE_ENV !== "production";

/** 集計系API用の接続プールが有効かどうか（config.db.statsUser が設定されているか）。 */
export const isStatsPoolEnabled = Boolean(
	config.db.statsUser != null && config.db.statsUser !== "",
);

const statsPoolSize = Math.max(1, config.db.statsPoolSize ?? 5);
const statsStatementTimeoutMs = config.db.statsStatementTimeoutMs ?? 120000;

/** 集計用接続に渡す PostgreSQL の -c オプション（work_mem, temp_file_limit, max_parallel_workers_per_gather）。 */
function buildStatsConnectionOptions(): string | undefined {
	const parts: string[] = [];
	if (
		config.db.statsWorkMem != null &&
		String(config.db.statsWorkMem).trim() !== ""
	) {
		parts.push(`-c work_mem=${String(config.db.statsWorkMem).trim()}`);
	}
	if (
		config.db.statsTempFileLimit != null &&
		String(config.db.statsTempFileLimit).trim() !== ""
	) {
		parts.push(
			`-c temp_file_limit=${String(config.db.statsTempFileLimit).trim()}`,
		);
	}
	if (config.db.statsMaxParallelWorkersPerGather != null) {
		parts.push(
			`-c max_parallel_workers_per_gather=${Number(config.db.statsMaxParallelWorkersPerGather)}`,
		);
	}
	return parts.length > 0 ? parts.join(" ") : undefined;
}

const statsConnectionOptions = buildStatsConnectionOptions();

/**
 * 集計系API用 DataSource。
 * config.db.statsUser が設定されている場合のみ生成され、initDb で初期化される。
 * 未設定の場合は null。利用側は getStatsDataSource() を使うこと。
 */
/** extra から user/password を除いたもの。stats 接続でメインDBの認証情報が上書きされないようにする。 */
const statsExtraFromConfig = (() => {
	const extra = config.db.extra ?? {};
	const { user: _u, password: _p, ...rest } = extra as Record<
		string,
		unknown
	> & { user?: string; password?: string };
	return rest;
})();

export const dbStats: DataSource | null = isStatsPoolEnabled
	? new DataSource({
			type: "postgres",
			host: config.db.host,
			port: config.db.port,
			username: config.db.statsUser,
			password: config.db.statsPass ?? "",
			database: config.db.db,
			extra: {
				statement_timeout: statsStatementTimeoutMs,
				max: statsPoolSize,
				...(statsConnectionOptions != null
					? { options: statsConnectionOptions }
					: {}),
				...statsExtraFromConfig,
			},
			synchronize: false,
			dropSchema: false,
			cache: false,
			logging: log,
			logger: log ? new MyCustomLogger() : undefined,
			maxQueryExecutionTime: Math.min(25000, statsStatementTimeoutMs),
			entities: entities,
			migrations: [],
		})
	: null;

/**
 * 集計系API用の DataSource を返す。
 * 専用プールが有効な場合は dbStats、そうでない場合はメインの db を返す。
 */
export function getStatsDataSource(): DataSource {
	return dbStats ?? db;
}

export const db = new DataSource({
	type: "postgres",
	host: config.db.host,
	port: config.db.port,
	username: config.db.user,
	password: config.db.pass,
	database: config.db.db,
	extra: {
		statement_timeout: 1000 * 300,
		...config.db.extra,
	},
	synchronize: process.env.NODE_ENV === "test",
	dropSchema: process.env.NODE_ENV === "test",
	cache: !config.db.disableCache
		? {
				type: "ioredis",
				options: {
					host: config.redis.host,
					port: config.redis.port,
					family: config.redis.family == null ? 0 : config.redis.family,
					password: config.redis.pass,
					keyPrefix: `${config.redis.prefix}:query:`,
					db: config.redis.db || 0,
				},
		  }
		: false,
	logging: log,
	logger: log ? new MyCustomLogger() : undefined,
	maxQueryExecutionTime: 25000,
	entities: entities,
	migrations: ["../../migration/*.js"],
});

export async function initDb(force = false) {
	if (force) {
		if (dbStats?.isInitialized) {
			await dbStats.destroy();
		}
		if (db.isInitialized) {
			await db.destroy();
		}
		dbLogger.info("Initializing main DB connection...");
		await db.initialize();
		dbLogger.info("Main DB connection established.");
		if (dbStats) {
			dbLogger.info(
				`Initializing stats pool... statsUser=${config.db.statsUser ?? "(none)"} statsPassDefined=${config.db.statsPass != null} statsPassLength=${config.db.statsPass?.length ?? 0}`,
			);
			await dbStats.initialize();
			dbLogger.info("Stats pool connection established.");
		}
		return;
	}

	if (db.isInitialized) {
		// 既に初期化済みの場合は何もしない
	} else {
		dbLogger.info("Initializing main DB connection...");
		await db.initialize();
		dbLogger.info("Main DB connection established.");
	}
	if (dbStats != null && !dbStats.isInitialized) {
		dbLogger.info(
			`Initializing stats pool... statsUser=${config.db.statsUser ?? "(none)"} statsPassDefined=${config.db.statsPass != null} statsPassLength=${config.db.statsPass?.length ?? 0}`,
		);
		await dbStats.initialize();
		dbLogger.info("Stats pool connection established.");
	}
}

export async function resetDb() {
	const reset = async () => {
		await redisClient.flushdb();
		const tables = await db.query(`SELECT relname AS "table"
		FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
		WHERE nspname NOT IN ('pg_catalog', 'information_schema')
			AND C.relkind = 'r'
			AND nspname !~ '^pg_toast';`);
		for (const table of tables) {
			await db.query(`DELETE FROM "${table.table}" CASCADE`);
		}
	};

	for (let i = 1; i <= 3; i++) {
		try {
			await reset();
		} catch (e) {
			if (i === 3) {
				throw e;
			} else {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}
		}
		break;
	}
}
