import define from "../../define.js";
import { ClipNotes, Clips } from "@/models/index.js";
import { ApiError } from "../../error.js";
import { getNote } from "../../common/getters.js";

export const meta = {
	tags: ["account", "notes", "clips"],

	requireCredential: true,

	kind: "write:account",

	errors: {
		noSuchClip: {
			message: "No such clip.",
			code: "NO_SUCH_CLIP",
			id: "b80525c6-97f7-49d7-a42d-ebccd49cfd52",
		},

		noSuchNote: {
			message: "No such note.",
			code: "NO_SUCH_NOTE",
			id: "aff017de-190e-434b-893e-33a9ff5049d8",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		clipId: { type: "string", format: "misskey:id" },
		noteId: { type: "string", format: "misskey:id" },
	},
	required: ["clipId", "noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const clip = await Clips.findOneBy({
		id: ps.clipId,
		userId: user.id,
	});

	if (clip == null) {
		throw new ApiError(meta.errors.noSuchClip);
	}

	await ClipNotes.delete({
		noteId: ps.noteId,
		clipId: clip.id,
	});
});
