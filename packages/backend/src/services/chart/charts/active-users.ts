import type { KVs } from "../core.js";
import Chart from "../core.js";
import type { User } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import { name, schema } from "./entities/active-users.js";

const week = 1000 * 60 * 60 * 24 * 7;
const month = 1000 * 60 * 60 * 24 * 30;
const year = 1000 * 60 * 60 * 24 * 365;

/**
 * アクティブユーザーに関するチャート
 */

export default class ActiveUsersChart extends Chart<typeof schema> {
	constructor() {
		super(name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async read(user: {
		id: User["id"];
		host: null;
		createdAt: User["createdAt"];
	}): Promise<void> {
		const createdAtTime = new Date(user.createdAt).getTime();
		const userAge = Number.isNaN(createdAtTime) ? null : Date.now() - createdAtTime;

		await this.commit({
			read: [user.id],
			registeredWithinWeek:
				userAge != null && userAge < week ? [user.id] : [],
			registeredWithinMonth:
				userAge != null && userAge < month ? [user.id] : [],
			registeredWithinYear:
				userAge != null && userAge < year ? [user.id] : [],
			registeredOutsideWeek:
				userAge != null && userAge > week ? [user.id] : [],
			registeredOutsideMonth:
				userAge != null && userAge > month ? [user.id] : [],
			registeredOutsideYear:
				userAge != null && userAge > year ? [user.id] : [],
		});
	}

	public async write(user: {
		id: User["id"];
		host: null;
		createdAt: User["createdAt"];
	}): Promise<void> {
		await this.commit({
			write: [user.id],
		});
	}
}
