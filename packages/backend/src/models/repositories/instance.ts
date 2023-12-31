import { db } from "@/db/postgre.js";
import { Instance } from "@/models/entities/instance.js";
import type { Packed } from "@/misc/schema.js";
import {
	shouldBlockInstance,
	shouldSilenceInstance,
} from "@/misc/should-block-instance.js";

export const InstanceRepository = db.getRepository(Instance).extend({
	async pack(instance: Instance): Promise<Packed<"FederationInstance">> {
		return {
			id: instance.id,
			caughtAt: instance.caughtAt.toISOString(),
			firstRetrievedAt: instance.caughtAt.toISOString(),
			host: instance.host,
			usersCount: instance.usersCount,
			notesCount: instance.notesCount,
			followingCount: instance.followingCount,
			followersCount: instance.followersCount,
			latestRequestSentAt: instance.latestRequestSentAt
				? instance.latestRequestSentAt.toISOString()
				: null,
			latestStatus: instance.latestStatus,
			latestRequestReceivedAt: instance.latestRequestReceivedAt,
			lastCommunicatedAt: instance.lastCommunicatedAt.toISOString(),
			isNotResponding: instance.isNotResponding,
			isSuspended: instance.isSuspended,
			isBlocked: await shouldBlockInstance(instance.host),
			isSilenced: await shouldSilenceInstance(instance.host),
			softwareName: instance.softwareName,
			softwareVersion: instance.softwareVersion,
			openRegistrations: instance.openRegistrations,
			name: instance.name,
			description: instance.description,
			maintainerName: instance.maintainerName,
			maintainerEmail: instance.maintainerEmail,
			iconUrl: instance.iconUrl,
			faviconUrl: instance.faviconUrl,
			themeColor: instance.themeColor,
			maxReactionsPerAccount: instance.maxReactionsPerAccount,
			infoUpdatedAt: instance.infoUpdatedAt
				? instance.infoUpdatedAt.toISOString()
				: null,
		};
	},

	packMany(instances: Instance[]) {
		return Promise.all(instances.map((x) => this.pack(x)));
	},
});
