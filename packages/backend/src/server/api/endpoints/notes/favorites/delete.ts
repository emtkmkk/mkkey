import { NoteFavorites } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getNote } from "../../../common/getters.js";

export const meta = {
	tags: ["notes", "favorites"],

	requireCredential: true,

	kind: "write:favorites",

	errors: {
		noSuchNote: {
			message: "No such note.",
			code: "NO_SUCH_NOTE",
			id: "80848a2c-398f-4343-baa9-df1d57696c56",
		},

		notFavorited: {
			message: "You have not marked that note a favorite.",
			code: "NOT_FAVORITED",
			id: "b625fc69-635e-45e9-86f4-dbefbef35af5",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: { type: "string", format: "misskey:id" },
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// if already favorited
	const exist = await NoteFavorites.findOneBy({
		noteId: ps.noteId,
		userId: user.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notFavorited);
	}

	// Delete favorite
	await NoteFavorites.delete(exist.id);
});
