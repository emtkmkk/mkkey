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
				url?: string;
				canonicalUrl?: string;
				checkinShortUrl?: string;
				checkinUrl?: string;
				photos?: {
					items?: Array<{
						prefix?: string;
						suffix?: string;
					}>;
				};
				venue?: {
					name?: string;
					localizedName?: string;
					nameJa?: string;
					name_ja?: string;
					url?: string;
					canonicalUrl?: string;
					location?: {
						city?: string;
						state?: string;
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
	const firstCheckinPhoto = checkin.photos?.items?.[0];
	if (!firstCheckinPhoto?.prefix || !firstCheckinPhoto?.suffix) return null;
	return `${firstCheckinPhoto.prefix}original${firstCheckinPhoto.suffix}`;
}

function getPreferredVenueName(checkin: CheckinItem): string {
	const venue = checkin.venue;
	if (!venue) return "";

	return venue.name_ja ?? venue.nameJa ?? venue.localizedName ?? venue.name ?? "";
}

function getCheckinUrl(checkin: CheckinItem): string {
	return (
		checkin.checkinShortUrl ??
		checkin.checkinUrl ??
		checkin.url ??
		checkin.canonicalUrl ??
		checkin.venue?.url ??
		checkin.venue?.canonicalUrl ??
		""
	);
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
		`https://api.foursquare.com/v2/users/self/checkins?v=20240101&locale=ja&limit=${ps.limit}&offset=${ps.offset}`,
		"application/json, */*",
		10000,
		{ Authorization: `Bearer ${token}` },
	) as SwarmCheckinResponse;

	const items = response.response?.checkins?.items ?? [];
	const count = response.response?.checkins?.count ?? items.length;

	return {
		items: items.map((item) => ({
			id: item.id,
			createdAt: item.createdAt ?? null,
			comment: item.shout ?? "",
			venueName: getPreferredVenueName(item),
			location: compactLocation(item.venue?.location?.city, item.venue?.location?.state),
			url: getCheckinUrl(item),
			photoUrl: getVenuePhotoUrl(item),
		})),
		hasMore: ps.offset + items.length < count,
	};
});
