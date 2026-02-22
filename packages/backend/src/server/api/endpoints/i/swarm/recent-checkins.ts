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
					location?: {
						city?: string;
						state?: string;
						formattedAddress?: string[];
					};
				};
			}>;
		};
	};
};

type SwarmCheckinDetailResponse = {
	response?: {
		checkin?: {
			checkinShortUrl?: string;
			checkinUrl?: string;
			url?: string;
			canonicalUrl?: string;
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

function isZipCode(value: string): boolean {
	return /^\d{3}-\d{4}$/.test(value);
}

function getVenueAddress(formattedAddress?: string[], city?: string, state?: string): string {
	if (!formattedAddress || formattedAddress.length === 0) {
		return compactLocation(city, state);
	}

	const copiedAddress = [...formattedAddress];
	let venueAddress = copiedAddress.pop() ?? "";

	if (isZipCode(venueAddress)) {
		venueAddress = copiedAddress.pop() ?? venueAddress;
	}

	return venueAddress;
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

function getCheckinUrlFromItem(checkin: CheckinItem): string {
	return checkin.checkinShortUrl ?? checkin.checkinUrl ?? checkin.url ?? checkin.canonicalUrl ?? "";
}

function getCheckinUrlFromDetail(response: SwarmCheckinDetailResponse): string {
	const detail = response.response?.checkin;
	if (!detail) return "";
	return detail.checkinShortUrl ?? detail.checkinUrl ?? detail.url ?? detail.canonicalUrl ?? "";
}

async function resolveCheckinShareUrl(token: string, checkin: CheckinItem): Promise<string> {
	const fromTimeline = getCheckinUrlFromItem(checkin);
	if (fromTimeline) return fromTimeline;

	const detailResponse = await getJson(
		`https://api.foursquare.com/v2/checkins/${encodeURIComponent(checkin.id)}?v=20240101&locale=ja`,
		"application/json, */*",
		10000,
		{ Authorization: `Bearer ${token}` },
	) as SwarmCheckinDetailResponse;

	return getCheckinUrlFromDetail(detailResponse);
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

	const normalizedItems = await Promise.all(
		items.map(async (item) => ({
			id: item.id,
			createdAt: item.createdAt ?? null,
			comment: item.shout ?? "",
			venueName: getPreferredVenueName(item),
			location: getVenueAddress(
				item.venue?.location?.formattedAddress,
				item.venue?.location?.city,
				item.venue?.location?.state,
			),
			url: await resolveCheckinShareUrl(token, item),
			photoUrl: getVenuePhotoUrl(item),
		})),
	);

	return {
		items: normalizedItems,
		hasMore: ps.offset + items.length < count,
	};
});
