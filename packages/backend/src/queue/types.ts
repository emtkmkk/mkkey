/**
 * @packageDocumentation
 *
 * キュージョブのデータ型定義。Deliver / Inbox / Db / Webhook / NoteAp 等のジョブペイロード。
 *
 * @remarks
 * - **役割**: 各キュー processor が受け取るジョブデータの型を定義する。deliver・inbox・export 等で参照される。
 *
 * @see {@link queue/processors}  processor
 * @internal
 */
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { Note } from "@/models/entities/note";
import type { User } from "@/models/entities/user.js";
import type { Webhook } from "@/models/entities/webhook";
import type { IActivity } from "@/remote/activitypub/type.js";
import type httpSignature from "@peertube/http-signature";

export type DeliverJobData = {
	/** 配送元 Actor */
	user: ThinUser;
	/** 配送する Activity */
	content: unknown;
	/** 配送先 inbox URL */
	to: string;
	isSharedInbox: boolean;
};

export type InboxJobData = {
	activity: IActivity;
	signature: httpSignature.IParsedSignature;
};

export type DbJobData =
	| DbUserJobData
	| DbUserImportPostsJobData
	| DbUserImportJobData
	| DbUserDeleteJobData;

export type DbUserJobData = {
	user: ThinUser;
	excludeMuting: boolean;
	excludeInactive: boolean;
};

export type DbUserDeleteJobData = {
	user: ThinUser;
	soft?: boolean;
	/** 削除前に `followedAccountWasDeleted` を送ったローカルフォロワー ID（相互フォロー重複抑止用） */
	followedDeletedNotifiedIds?: User["id"][];
};

export type DbUserImportJobData = {
	user: ThinUser;
	fileId: DriveFile["id"];
};

export type DbUserImportPostsJobData = {
	user: ThinUser;
	fileId: DriveFile["id"];
	signatureCheck: boolean;
};

export type ObjectStorageJobData =
	| ObjectStorageFileJobData
	| Record<string, unknown>;

export type ObjectStorageFileJobData = {
	key: string;
};

export type EndedPollNotificationJobData = {
	noteId: Note["id"];
};

export type WebhookDeliverJobData = {
	type: string;
	content: unknown;
	webhookId: Webhook["id"];
	userId: User["id"];
	to: string;
	secret: string;
	createdAt: number;
	eventId: string;
};

export type NoteApDeliverJobData = {
	noteId: Note["id"];
	queuedAt: number;
	sameRenoteCount?: number | null;
};

export type ThinUser = {
	id: User["id"];
};
