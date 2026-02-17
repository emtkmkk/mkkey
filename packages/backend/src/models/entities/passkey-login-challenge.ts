import {
	Entity,
	PrimaryColumn,
	Column,
	Index,
} from "typeorm";
import { id } from "../id.js";

@Entity()
export class PasskeyLoginChallenge {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column("varchar", {
		length: 64,
		comment: "Hex-encoded sha256 hash of the challenge.",
	})
	public challenge: string;

	@Column("timestamp with time zone", {
		comment: "The date challenge was created for expiry purposes.",
	})
	public createdAt: Date;

	constructor(data: Partial<PasskeyLoginChallenge>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
