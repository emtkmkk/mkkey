import { Notes } from "@/models/index.js";
import define from "../../define.js";
import { getNote } from "../../common/getters.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["notes"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Note",
	},

	errors: {
		noSuchNote: {
			message: "No such note.",
			code: "NO_SUCH_NOTE",
			id: "24fcbfc6-2e37-42b6-8388-c29b3861a08d",
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
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	return await Notes.pack(note, user, {
		// FIXME: packing with detail may throw an error if the reply or renote is not visible (#8774)
		detail: true,
		showInvisible: true,
	}).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});
});
