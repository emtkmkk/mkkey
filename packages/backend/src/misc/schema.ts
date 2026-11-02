/**
 * @packageDocumentation
 *
 * API レスポンス用の Packed 型と refs。各モデルの schema を集約し SchemaType で型を取り出す。
 *
 * @remarks
 * - **役割**: エンドポイントの戻り値型や OpenAPI スキーマ生成で Packed 型を参照する。
 *
 * @see {@link server/api/define} API 定義
 * @internal
 */
import {
	packedUserLiteSchema,
	packedUserDetailedNotMeOnlySchema,
	packedMeDetailedOnlySchema,
	packedUserDetailedNotMeSchema,
	packedMeDetailedSchema,
	packedUserDetailedSchema,
	packedUserSchema,
} from "@/models/schema/user.js";
import { packedNoteSchema } from "@/models/schema/note.js";
import { packedUserListSchema } from "@/models/schema/user-list.js";
import { packedAppSchema } from "@/models/schema/app.js";
import { packedMessagingMessageSchema } from "@/models/schema/messaging-message.js";
import { packedNotificationSchema } from "@/models/schema/notification.js";
import { packedDriveFileSchema } from "@/models/schema/drive-file.js";
import { packedDriveFolderSchema } from "@/models/schema/drive-folder.js";
import { packedFollowingSchema } from "@/models/schema/following.js";
import { packedMutingSchema } from "@/models/schema/muting.js";
import { packedRenoteMutingSchema } from "@/models/schema/renote-muting.js";
import { packedPushMutingSchema } from "@/models/schema/push-muting.js";
import { packedBlockingSchema } from "@/models/schema/blocking.js";
import { packedFollowBlockingSchema } from "@/models/schema/follow-blocking.js";
import { packedNoteReactionSchema } from "@/models/schema/note-reaction.js";
import { packedHashtagSchema } from "@/models/schema/hashtag.js";
import { packedPageSchema } from "@/models/schema/page.js";
import { packedUserGroupSchema } from "@/models/schema/user-group.js";
import { packedNoteFavoriteSchema } from "@/models/schema/note-favorite.js";
import { packedChannelSchema } from "@/models/schema/channel.js";
import { packedAntennaSchema } from "@/models/schema/antenna.js";
import { packedClipSchema } from "@/models/schema/clip.js";
import { packedFederationInstanceSchema } from "@/models/schema/federation-instance.js";
import { packedQueueCountSchema } from "@/models/schema/queue.js";
import { packedGalleryPostSchema } from "@/models/schema/gallery-post.js";
import { packedEmojiSchema } from "@/models/schema/emoji.js";
import { packedNoteEdit } from "@/models/schema/note-edit.js";
import { packedEmojiCustomCategorieschema } from "@/models/schema/emoji-custom-category.js";

export const refs = {
	UserLite: packedUserLiteSchema,
	UserDetailedNotMeOnly: packedUserDetailedNotMeOnlySchema,
	MeDetailedOnly: packedMeDetailedOnlySchema,
	UserDetailedNotMe: packedUserDetailedNotMeSchema,
	MeDetailed: packedMeDetailedSchema,
	UserDetailed: packedUserDetailedSchema,
	User: packedUserSchema,

	UserList: packedUserListSchema,
	UserGroup: packedUserGroupSchema,
	App: packedAppSchema,
	MessagingMessage: packedMessagingMessageSchema,
	Note: packedNoteSchema,
	NoteEdit: packedNoteEdit,
	NoteReaction: packedNoteReactionSchema,
	NoteFavorite: packedNoteFavoriteSchema,
	Notification: packedNotificationSchema,
	DriveFile: packedDriveFileSchema,
	DriveFolder: packedDriveFolderSchema,
	Following: packedFollowingSchema,
	Muting: packedMutingSchema,
	RenoteMuting: packedRenoteMutingSchema,
	PushMuting: packedPushMutingSchema,
	FollowBlocking: packedFollowBlockingSchema,
	Blocking: packedBlockingSchema,
	Hashtag: packedHashtagSchema,
	Page: packedPageSchema,
	Channel: packedChannelSchema,
	QueueCount: packedQueueCountSchema,
	Antenna: packedAntennaSchema,
	Clip: packedClipSchema,
	FederationInstance: packedFederationInstanceSchema,
	GalleryPost: packedGalleryPostSchema,
	Emoji: packedEmojiSchema,
	EmojiCustomCategory: packedEmojiCustomCategorieschema,
};

export type Packed<x extends keyof typeof refs> = SchemaType<typeof refs[x]>;

type TypeStringef =
	| "null"
	| "boolean"
	| "integer"
	| "number"
	| "string"
	| "array"
	| "object"
	| "any";
type StringDefToType<T extends TypeStringef> = T extends "null"
	? null
	: T extends "boolean"
	? boolean
	: T extends "integer"
	? number
	: T extends "number"
	? number
	: T extends "string"
	? string | Date
	: T extends "array"
	? ReadonlyArray<any>
	: T extends "object"
	? Record<string, any>
	: any;

// https://swagger.io/specification/?sbsearch=optional#schema-object
type OfSchema = {
	readonly anyOf?: ReadonlyArray<Schema>;
	readonly oneOf?: ReadonlyArray<Schema>;
	readonly allOf?: ReadonlyArray<Schema>;
};

export interface Schema extends OfSchema {
	readonly type?: TypeStringef;
	readonly nullable?: boolean;
	readonly optional?: boolean;
	readonly items?: Schema;
	readonly properties?: Obj;
	readonly required?: ReadonlyArray<
		Extract<keyof NonNullable<this["properties"]>, string>
	>;
	readonly description?: string;
	readonly example?: any;
	readonly format?: string;
	readonly ref?: keyof typeof refs;
	/**
	 * 取りうる値の一覧。
	 *
	 * @remarks
	 * NB: Ajv は `nullable: true` でも enum に null を足さないので、null を受け付けるときは null もここに入れる。
	 * 型の上では null を除いて扱い、null かどうかは `nullable` で決める。
	 */
	readonly enum?: ReadonlyArray<string | null>;
	readonly default?:
		| (this["type"] extends TypeStringef ? StringDefToType<this["type"]> : any)
		| null;
	readonly maxLength?: number;
	readonly minLength?: number;
	readonly maximum?: number;
	readonly minimum?: number;
	readonly pattern?: string;
}

type RequiredPropertyNames<s extends Obj> = {
	[K in keyof s]: // K is not optional
	s[K]["optional"] extends false
		? K
		: // K has default value
		s[K]["default"] extends
				| null
				| string
				| number
				| boolean
				| Record<string, unknown>
		? K
		: never;
}[keyof s];

export type Obj = Record<string, Schema>;

// https://github.com/misskey-dev/misskey/issues/8535
// To avoid excessive stack depth error,
// deceive TypeScript with UnionToIntersection (or more precisely, `infer` expression within it).
export type ObjType<
	s extends Obj,
	RequiredProps extends keyof s,
> = UnionToIntersection<
	{
		-readonly [R in RequiredPropertyNames<s>]-?: SchemaType<s[R]>;
	} & {
		-readonly [R in RequiredProps]-?: SchemaType<s[R]>;
	} & {
		-readonly [P in keyof s]?: SchemaType<s[P]>;
	}
>;

type NullOrUndefined<p extends Schema, T> =
	| (p["nullable"] extends true ? null : never)
	| (p["optional"] extends true ? undefined : never)
	| T;

// https://stackoverflow.com/questions/54938141/typescript-convert-union-to-intersection
// Get intersection from union
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

// https://github.com/misskey-dev/misskey/pull/8144#discussion_r785287552
// To get union, we use `Foo extends any ? Hoge<Foo> : never`
type UnionSchemaType<
	a extends readonly any[],
	X extends Schema = a[number],
> = X extends any ? SchemaType<X> : never;
type ArrayUnion<T> = T extends any ? Array<T> : never;

/**
 * オブジェクトスキーマの anyOf / oneOf に並ぶ「分岐 1 つ」を型にする
 *
 * @remarks
 * paramDef の分岐は `{ properties, required }` だけで `type` を省く書き方が多い
 * （例: users/followers の「userId か username+host のどちらか」）。
 * この形は {@link SchemaTypeDef} では `type` が無いため `any` に落ちてしまい、
 * 分岐側のプロパティがパラメータ型から消えていた。
 *
 * - `properties` を持つ分岐: そのプロパティをオブジェクト型として展開する。
 * - `required` だけの分岐（例: notes/create の `{ required: ["fileIds"] }`）:
 *   親の `properties` から該当キーを必須にしたものとして扱う。
 * - どちらも無い分岐: 通常の {@link SchemaType} に委ねる。
 *
 * @typeParam X - 分岐スキーマ
 * @typeParam Parent - 親オブジェクトの `properties`（`required` だけの分岐を解決するために使う）
 * @internal
 */
type ObjectBranchType<X extends Schema, Parent extends Obj> =
	X["properties"] extends NonNullable<Obj>
		? ObjType<X["properties"], NonNullable<X["required"]>[number]>
		: X["required"] extends ReadonlyArray<keyof Parent>
		? {
				-readonly [R in X["required"][number]]-?: SchemaType<Parent[R]>;
		  }
		: SchemaType<X>;

/**
 * anyOf / oneOf の全分岐を合併型（union）にする
 *
 * @remarks
 * `X extends any ? ... : never` の形で分配し、分岐ごとの型の合併を得る。
 *
 * @internal
 */
type UnionObjectBranchType<
	a extends readonly any[],
	Parent extends Obj,
	X extends Schema = a[number],
> = X extends any ? ObjectBranchType<X, Parent> : never;

/**
 * anyOf を持つオブジェクトのパラメータ型
 *
 * @remarks
 * `分岐の合併型 & Partial<全分岐の交差型>` とすることで、
 * どの分岐でも他の分岐のプロパティに `undefined` 込みでアクセスできるようにする
 * （`if (ps.userId != null) ... else ps.username` のような書き方を許すため）。
 *
 * @internal
 */
type AnyOfObjectType<a extends readonly any[], Parent extends Obj> =
	UnionObjectBranchType<a, Parent> &
		Partial<UnionToIntersection<UnionObjectBranchType<a, Parent>>>;

export type SchemaTypeDef<p extends Schema> = p["type"] extends "null"
	? null
	: p["type"] extends "integer"
	? number
	: p["type"] extends "number"
	? number
	: p["type"] extends "string"
	? p["enum"] extends readonly (string | null)[]
		? Exclude<p["enum"][number], null>
		: p["format"] extends "date-time"
		? string
		: // Dateにする？？
		  string
	: p["type"] extends "boolean"
	? boolean
	: p["type"] extends "object"
	? p["ref"] extends keyof typeof refs
		? Packed<p["ref"]>
		: p["properties"] extends NonNullable<Obj>
		? p["anyOf"] extends ReadonlyArray<Schema>
			? // properties と anyOf の併用: 共通部分 & 分岐部分（分岐のプロパティも見えるようにする）
			  ObjType<p["properties"], NonNullable<p["required"]>[number]> &
					AnyOfObjectType<p["anyOf"], p["properties"]>
			: ObjType<p["properties"], NonNullable<p["required"]>[number]>
		: p["anyOf"] extends ReadonlyArray<Schema>
		? // properties 無しで anyOf だけ: 分岐は type 省略の { properties, required } 形式が多い
		  AnyOfObjectType<p["anyOf"], {}>
		: p["allOf"] extends ReadonlyArray<Schema>
		? UnionToIntersection<UnionSchemaType<p["allOf"]>>
		: any
	: p["type"] extends "array"
	? p["items"] extends OfSchema
		? p["items"]["anyOf"] extends ReadonlyArray<Schema>
			? UnionSchemaType<NonNullable<p["items"]["anyOf"]>>[]
			: p["items"]["oneOf"] extends ReadonlyArray<Schema>
			? ArrayUnion<UnionSchemaType<NonNullable<p["items"]["oneOf"]>>>
			: p["items"]["allOf"] extends ReadonlyArray<Schema>
			? UnionToIntersection<UnionSchemaType<NonNullable<p["items"]["allOf"]>>>[]
			: never
		: p["items"] extends NonNullable<Schema>
		? SchemaTypeDef<p["items"]>[]
		: any[]
	: p["oneOf"] extends ReadonlyArray<Schema>
	? UnionSchemaType<p["oneOf"]>
	: any;

export type SchemaType<p extends Schema> = NullOrUndefined<p, SchemaTypeDef<p>>;
