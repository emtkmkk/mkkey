import { getJson } from "@/misc/fetch.js";
import { UserProfiles } from "@/models/index.js";
import define from "../../../define.js";

type SwarmCheckinResponse = {
	response?: {
		checkins?: {
			count?: number;
			items?: Array<{
				id: string;
				createdAt?: number;
				shout?: string;
				canonicalUrl?: string;
				checkinShortUrl?: string;
				venue?: {
					name?: string;
					location?: {
						city?: string;
						state?: string;
					};
					photos?: {
						groups?: Array<{
							items?: Array<{
								prefix?: string;
								suffix?: string;
							}>;
						}>;
					};
				};
			}>;
		};
	};
};

export const meta = {
	tags: ["account"],
	requireCredential: true,
	kind: "read:account",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 10, default: 10 },
		offset: { type: "integer", minimum: 0, default: 0 },
	},
	required: [],
} as const;

function compactLocation(city?: string, state?: string): string {
	return [city, state].filter(Boolean).join(" ");
}

type CheckinItem = NonNullable<NonNullable<NonNullable<SwarmCheckinResponse["response"]>["checkins"]>["items"]>[number];

function getVenuePhotoUrl(checkin: CheckinItem): string | null {
	const firstGroup = checkin.venue?.photos?.groups?.find((group) => (group.items?.length ?? 0) > 0);
	const firstPhoto = firstGroup?.items?.[0];
	if (!firstPhoto?.prefix || !firstPhoto?.suffix) return null;
	return `${firstPhoto.prefix}original${firstPhoto.suffix}`;
}

export default define(meta, paramDef, async (ps, me) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: me.id });
	const token = profile.integrations.swarm?.accessToken;
	if (!token) {
		return {
			items: [],
			hasMore: false,
		};
	}

	const response = await getJson(
		`https://api.foursquare.com/v2/users/self/checkins?oauth_token=${encodeURIComponent(token)}&v=20240101&limit=${ps.limit}&offset=${ps.offset}`,
	) as SwarmCheckinResponse;

	const items = response.response?.checkins?.items ?? [];
	const count = response.response?.checkins?.count ?? items.length;

	return {
		items: items.map((item) => ({
			id: item.id,
			createdAt: item.createdAt ?? null,
			comment: item.shout ?? "",
			venueName: item.venue?.name ?? "",
			location: compactLocation(item.venue?.location?.city, item.venue?.location?.state),
			url: item.checkinShortUrl ?? item.canonicalUrl ?? "",
			photoUrl: getVenuePhotoUrl(item),
		})),
		hasMore: ps.offset + items.length < count,
	};
});
