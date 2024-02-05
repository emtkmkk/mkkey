import { Feed } from "feed";
import { In, IsNull } from "typeorm";
import config from "@/config/index.js";
import type { User } from "@/models/entities/user.js";
import { Notes, DriveFiles, UserProfiles, Users } from "@/models/index.js";

export default async function (user: User) {
	const username = user.name.replace(/ ?:.*?:/, "") || user.username;

	const author = {
		link: `${config.url}/@${user.username}`,
		name: username,
	};

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	const notes = await Notes.find({
		where: {
			userId: user.id,
			renoteId: IsNull(),
			visibility: In(["public", "home"]),
			localOnly: false,
		},
		order: { createdAt: -1 },
		take: 20,
	});

	const feed = new Feed({
		id: author.link,
		title: `${author.name} (@${user.username}@${config.host})`,
		updated: notes[0].createdAt,
		generator: "Calckey",
		description: `${user.notesCount} 投稿, ${user.followingCount} フォロー, ${
			user.followersCount
		} フォロワー${profile.description ? ` · ${profile.description}` : ""}`,
		link: author.link,
		image: await Users.getAvatarUrl(user),
		feedLinks: {
			json: `${author.link}.json`,
			atom: `${author.link}.atom`,
		},
		author,
		copyright: username,
	});

	for (const note of notes) {
		const files =
			note.fileIds.length > 0
				? await DriveFiles.findBy({
						id: In(note.fileIds),
				  })
				: [];
		const file = files.find((file) => file.type.startsWith("image/"));

		feed.addItem({
			title: `新着投稿 : ${author.name}`,
			link: `${config.url}/notes/${note.id}`,
			date: note.createdAt,
			description: note.cw || undefined,
			content: note.text || undefined,
			image: file ? DriveFiles.getPublicUrl(file) || undefined : undefined,
		});
	}

	return feed;
}
