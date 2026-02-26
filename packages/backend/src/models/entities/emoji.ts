/**
 * カスタム絵文字エンティティ
 *
 * @remarks
 * license はライセンス補足情報として利用。構造化項目は copyPermission, licenseName, usageInfo, creator, description, isBasedOnUrl。isTextOnly 時は copyPermission / licenseName / creator を固定値として扱う。
 */
import { PrimaryColumn, Entity, Index, Column } from "typeorm";
import { id } from "../id.js";

@Entity()
@Index(['name', 'host'], { unique: true })
export class Emoji {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public createdAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public updatedAt: Date | null;

	@Index()
	@Column('varchar', {
		length: 128,
	})
	public name: string;

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
	})
	public host: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public category: string | null;

	@Column('varchar', {
		length: 512,
	})
	public originalUrl: string;

	@Column('varchar', {
		length: 512,
		default: '',
	})
	public publicUrl: string;

	@Column('varchar', {
		length: 512, nullable: true,
	})
	public uri: string | null;

	// publicUrlの方のtypeが入る
	@Column('varchar', {
		length: 64, nullable: true,
	})
	public type: string | null;

	@Column('varchar', {
		array: true, length: 128, default: '{}',
	})
	public aliases: string[];

	@Column('varchar', {
		length: 1024, nullable: true,
	})
	public license: string | null;

	/** コピー可否: DB では a/d/c/n の1文字で保存 */
	@Column('varchar', {
		length: 1, nullable: true,
	})
	public copyPermission: string | null;

	/** ライセンス名（「ライセンス : 」の値）。典型は 50 文字未満 */
	@Column('varchar', {
		length: 128, nullable: true,
	})
	public licenseName: string | null;

	/** 使用情報（ライセンス全文等）。長文を許容するため text */
	@Column('text', {
		nullable: true,
	})
	public usageInfo: string | null;

	/** 製作者（ホスト名やハンドル等） */
	@Column('varchar', {
		length: 256, nullable: true,
	})
	public creator: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
	})
	public description: string | null;

	/** コピー元 URL（ActivityPub URI 等）。長い URI を考慮して 512 */
	@Column('varchar', {
		length: 512, nullable: true,
	})
	public isBasedOnUrl: string | null;

	/** 文字だけ絵文字フラグ。true のとき copyPermission / licenseName / creator は固定値として扱う */
	@Column('boolean', {
		default: false,
	})
	public isTextOnly: boolean;

	/** センシティブフラグ。ActivityPub では "sensitive": "as:sensitive" として扱う */
	@Column('boolean', {
		default: false,
	})
	public sensitive: boolean;

	@Column('boolean', {
		default: false,
	})
	public oldEmoji: boolean;

	/**
	 * 使用可能状態: public（全公開）, limited（限定公開）, user（ユーザ指定）, private（非公開）。
	 * 未設定時は後方互換で category?.startsWith('!') なら private とみなす。
	 */
	@Column('varchar', {
		length: 32,
		nullable: true,
		default: 'private',
	})
	public usageVisibility: string | null;

	/**
	 * usageVisibility === 'user' のときのみ使用。使用を許可するユーザ ID の配列。
	 */
	@Column('varchar', {
		array: true,
		length: 128,
		default: '{}',
	})
	public allowedUserIds: string[];

	/**
	 * モチーフユーザー（紐づけユーザー）ID。未設定の場合は誰でも利用可能。
	 */
	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public motifUserId: string | null;

	/**
	 * モチーフユーザーの利用範囲: any（誰でも）, follow（フォロー限定）, owner（本人のみ）。デフォルト any。
	 */
	@Column('varchar', {
		length: 32,
		nullable: true,
		default: 'any',
	})
	public motifUserMode: string | null;
}
