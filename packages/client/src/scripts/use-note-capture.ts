import { onUnmounted, Ref } from "vue";
import * as misskey from "calckey-js";
import { stream } from "@/stream";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import * as os from "@/os";

export function useNoteCapture(props: {
	rootEl: Ref<HTMLElement>;
	note: Ref<misskey.entities.Note>;
	isDeletedRef: Ref<boolean>;
}) {
	const note = props.note;
	const connection = $i ? stream : null;

	async function onStreamNoteUpdated(noteData): Promise<void> {
		const { type, id, body } = noteData;

		if (id !== note.value.id) return;

		switch (type) {
			case "reacted": {
				const reaction = body.reaction;

				if (body.emoji) {
					const emojis = note.value.emojis || [];
					if (!emojis.includes(body.emoji)) {
						note.value.emojis = [...emojis, body.emoji];
					}
				}

				// TODO: reactionsプロパティがない場合ってあったっけ？ なければ || {} は消せる
				const currentCount = note.value.reactions?.[reaction] || 0;

				note.value.reactions[reaction] = currentCount + 1;

				if ($i && body.userId === $i.id) {
					note.value.myReaction = reaction;
					note.value.myReactions = [...(note.value.myReactions || []), reaction];
					note.value.myReactionsCnt += 1;
				}
				break;
			}

			case "unreacted": {
				const reaction = body.reaction;

				// TODO: reactionsプロパティがない場合ってあったっけ？ なければ || {} は消せる
				const currentCount = note.value.reactions?.[reaction] || 0;

				note.value.reactions[reaction] = Math.max(0, currentCount - 1);

				if ($i && body.userId === $i.id) {
					note.value.myReaction = undefined;
					note.value.myReactions = note.value.myReactions.filter((x) => x !== reaction);
					note.value.myReactionsCnt -= 1
					
				}
				break;
			}

			case "pollVoted": {
				const choice = body.choice;

				if (note.value.poll) {
					const choices = [...note.value.poll.choices];
					choices[choice] = {
						...choices[choice],
						votes: choices[choice].votes + 1,
						...($i && body.userId === $i.id
							? {
									isVoted: true,
							  }
							: {}),
					};
					note.value.poll.choices = choices;
				}

				break;
			}

			case "deleted": {
				if (body.physical) {
					props.isDeletedRef.value = true;
				} else {
					note.value.deletedAt = body.deletedAt ?? new Date();
					note.value.text = note.value.renoteId ? "QT" : "";
					note.value.cw = "";
					note.value.fileIds = {};
					note.value.attachedFileTypes = {};
					note.value.mentions = {};
					note.value.mentionedRemoteUsers = [];
					note.value.emojis = [];
					note.value.tags = [];
					note.value.hasPoll = false;
				}
				break;
			}

			case "updated": {
				const editedNote = await os.api("notes/show", {
					noteId: id,
				});

				const keys = new Set<string>();
				Object.keys(editedNote)
					.concat(Object.keys(note.value))
					.forEach((key) => keys.add(key));
				keys.forEach((key) => {
					note.value[key] = editedNote[key];
				});
				break;
			}
		}
	}

	function capture(withHandler = false): void {
		if (connection) {
			// TODO: このノートがストリーミング経由で流れてきた場合のみ sr する
			connection.send(document.body.contains(props.rootEl.value) ? "sr" : "s", {
				id: note.value.id,
			});
			if (withHandler) connection.on("noteUpdated", onStreamNoteUpdated);
		}
	}

	function decapture(withHandler = false): void {
		if (connection) {
			connection.send("un", {
				id: note.value.id,
			});
			if (withHandler) connection.off("noteUpdated", onStreamNoteUpdated);
		}
	}

	function onStreamConnected() {
		capture(false);
	}

	capture(true);
	if (connection) {
		connection.on("_connected_", onStreamConnected);
	}

	onUnmounted(() => {
		decapture(true);
		if (connection) {
			connection.off("_connected_", onStreamConnected);
		}
	});
}
