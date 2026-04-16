import {
	PrimaryColumn,
	Entity,
	Index,
	JoinColumn,
	Column,
	OneToOne,
} from "typeorm";
import { id } from "../id.js";
import { Note } from "./note.js";
import type { User } from "./user.js";
import { noteVisibilities } from "../../types.js";

/**
 * アンケート（投票）エンティティ。`choices` の各要素は DB 上 `varchar(256)`（`DB_MAX_POLL_CHOICE_LENGTH` と一致）。
 *
 * @remarks
 * API が許す 1 肢あたりの短い上限は `APP_MAX_POLL_CHOICE_LENGTH`（`notes/create`）。重複肢の `\u200B` 付与後も DB 上限を超えないこと。
 *
 * @see `misc/hard-limits.ts` の `DB_MAX_POLL_CHOICE_LENGTH` / `APP_MAX_POLL_CHOICE_LENGTH`
 */
@Entity()
export class Poll {
	@PrimaryColumn(id())
	public noteId: Note["id"];

	@OneToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public expiresAt: Date | null;

	@Column('boolean')
	public multiple: boolean;

	@Column('varchar', {
		length: 256, array: true, default: '{}',
	})
	public choices: string[];

	@Column('integer', {
		array: true,
	})
	public votes: number[];

	@Column('boolean', {
		default: false,
	})
	public hideResults: boolean;

	//#region Denormalized fields
	@Column('enum', {
		enum: noteVisibilities,
		comment: '[Denormalized]',
	})
	public noteVisibility: typeof noteVisibilities[number];

	@Index()
	@Column({
		...id(),
		comment: '[Denormalized]',
	})
	public userId: User["id"];

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public userHost: string | null;
	//#endregion

	constructor(data: Partial<Poll>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

export type IPoll = {
	choices: string[];
	votes?: number[];
	multiple: boolean;
	expiresAt: Date | null;
	hideResults?: boolean;
};
