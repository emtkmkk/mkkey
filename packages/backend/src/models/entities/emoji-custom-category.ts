import {
	Entity,
	Index,
	JoinColumn,
	Column,
	PrimaryColumn,
	ManyToOne,
} from "typeorm";
import { User } from "./user.js";
import { id } from "../id.js";
import { DriveFile } from "./drive-file.js";

@Entity()
@Index(['userId', 'name'], { unique: true })
export class EmojiCustomCategory {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Page.',
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The updated date of the Page.',
	})
	public updatedAt: Date;

	@Column('varchar', {
		length: 256,
	})
	public title: string;

	@Index()
	@Column('varchar', {
		length: 256,
	})
	public name: string;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public summary: string | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of author.',
	})
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column({
		...id(),
		nullable: true,
	})
	public eyeCatchingImageId: DriveFile["id"] | null;

	@ManyToOne(type => DriveFile, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public eyeCatchingImage: DriveFile | null;
	
	@Column({
			type: "varchar" as const,
			length: 256,
			array: true,
			default: '{}',
	})
	public contents: string[];

	constructor(data: Partial<EmojiCustomCategory>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
