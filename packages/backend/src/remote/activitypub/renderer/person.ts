import { URL } from "node:url";
import * as mfm from "mfm-js";
import config from "@/config/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { DriveFiles, UserProfiles } from "@/models/index.js";
import { getUserKeypair } from "@/misc/keypair-store.js";
import { toHtml } from "../../../mfm/to-html.js";
import renderImage from "./image.js";
import renderKey from "./key.js";
import { getEmojis } from "./note.js";
import renderEmoji from "./emoji.js";
import renderHashtag from "./hashtag.js";
import type { IIdentifier } from "../models/identifier.js";

export async function renderPerson(user: ILocalUser) {
	const id = `${config.url}/users/${user.id}`;
	const isSystem = !!user.username.match(/\./);

	const [avatar, banner, profile] = await Promise.all([
		user.avatarId
			? DriveFiles.findOneBy({ id: user.avatarId })
			: Promise.resolve(undefined),
		user.bannerId
			? DriveFiles.findOneBy({ id: user.bannerId })
			: Promise.resolve(undefined),
		UserProfiles.findOneByOrFail({ userId: user.id }),
	]);

	const attachment: {
		type: "PropertyValue";
		name: string;
		value: string;
		identifier?: IIdentifier;
	}[] = [];

	if (profile.fields) {
		for (const field of profile.fields) {
			attachment.push({
				type: "PropertyValue",
				name: field.name,
				value: field.value?.match(/^https?:/)
					? `<a href="${
							new URL(field.value).href
					  }" rel="me nofollow noopener" target="_blank">${
							new URL(field.value).href
					  }</a>`
					: field.value,
			});
		}
	}

	const emojis = await getEmojis(user.emojis);
	const apemojis = emojis.map((emoji) => renderEmoji(emoji));

	const hashtagTags = (user.tags || []).map((tag) => renderHashtag(tag));

	const tag = [...apemojis, ...hashtagTags];

	const keypair = await getUserKeypair(user.id);

	const person = {
		type: isSystem ? "Application" : user.isBot ? "Service" : "Person",
		id,
		inbox: `${id}/inbox`,
		outbox: `${id}/outbox`,
		followers: `${id}/followers`,
		following: `${id}/following`,
		featured: `${id}/collections/featured`,
		sharedInbox: `${config.url}/inbox`,
		endpoints: { sharedInbox: `${config.url}/inbox` },
		url: `${config.url}/@${user.username}`,
		preferredUsername: user.username,
		name: user.name,
		summary: profile.description
			? toHtml(mfm.parse(profile.description))
			: null,
		_misskey_summary: profile.description,
		_misskey_followedMessage: profile.followedMessage,
		icon: avatar ? renderImage(avatar) : null,
		image: banner ? renderImage(banner) : null,
		tag,
		manuallyApprovesFollowers:
			!user.isSilentLocked &&
			(user.isLocked || user.blockPostNotLocal || user.isRemoteLocked),
		discoverable: !!user.isRemoteExplorable && !!user.isExplorable,
		publicKey: renderKey(user, keypair, "#main-key"),
		isCat: user.isCat,
		attachment: attachment.length ? attachment : undefined,
	} as any;

	if (user.movedToUri) {
		person.movedTo = user.movedToUri;
	}

	if (user.alsoKnownAs) {
		person.alsoKnownAs = user.alsoKnownAs;
	}

	if (profile.birthday) {
		// 固定年齢が有効かつ誕生日に月日がある場合、年を逆算してリモートに配送する
		const pinnedAge = profile.pinnedAge;
		if (
			pinnedAge != null &&
			pinnedAge >= 6 &&
			pinnedAge <= 122 &&
			profile.birthday.length >= 10
		) {
			const today = new Date();
			const month = profile.birthday.slice(5, 7);
			const day = profile.birthday.slice(8, 10);
			let year = today.getFullYear() - pinnedAge;
			const thisYearBirthday = new Date(
				today.getFullYear(),
				parseInt(month, 10) - 1,
				parseInt(day, 10),
			);
			if (thisYearBirthday > today) {
				year -= 1;
			}
			person["vcard:bday"] = `${String(year).padStart(4, "0")}-${month}-${day}`;
		} else {
			person["vcard:bday"] = profile.birthday;
		}
	}

	if (profile.location) {
		person["vcard:Address"] = profile.location;
	}

	return person;
}

export async function renderDeletedPerson(user: ILocalUser) {
        const id = `${config.url}/users/${user.id}`;
        const keypair = await getUserKeypair(user.id);
        return {
                type: "Person",
                id,
                inbox: `${id}/inbox`,
                outbox: `${id}/outbox`,
                followers: `${id}/followers`,
                following: `${id}/following`,
                featured: `${id}/collections/featured`,
                sharedInbox: `${config.url}/inbox`,
                endpoints: { sharedInbox: `${config.url}/inbox` },
                url: `${config.url}/@${user.username}`,
                preferredUsername: user.username,
                name: "",
                summary: "",
                _misskey_summary: "",
                _misskey_followedMessage: "",
                icon: null,
                image: null,
                tag: [],
                manuallyApprovesFollowers: false,
                discoverable: false,
                publicKey: renderKey(user, keypair, "#main-key"),
                isCat: false,
        } as any;
}
