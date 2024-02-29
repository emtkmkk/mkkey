import { defineAsyncComponent, Ref, inject } from "vue";
import * as misskey from "calckey-js";
import { pleaseLogin } from "./please-login";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { instance } from "@/instance";
import * as os from "@/os";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import { url } from "@/config";
import { noteActions } from "@/store";
import { shareAvailable } from "@/scripts/share-available";
import { defaultStore } from "@/store";

export function getNoteMenu(props: {
	note: misskey.entities.Note;
	menuButton: Ref<HTMLElement>;
	translation: Ref<any>;
	translating: Ref<boolean>;
	isDeleted: Ref<boolean>;
	currentClipPage?: Ref<misskey.entities.Clip>;
	info?: Ref<any>;
}) {
	const isRenote =
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null;

	const appearNote =
		isRenote && !defaultStore.state.developerNoteMenu
			? (props.note.renote as misskey.entities.Note)
			: props.note;

	function del(): void {
		os.confirm({
			type: "warning",
			text: i18n.ts.noteDeleteConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			os.api("notes/delete", {
				noteId: appearNote.id,
			});
		});
	}

	function delActivity(): void {
		os.confirm({
			type: "warning",
			text: i18n.ts.noteDeleteActivityConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			os.api("notes/delete", {
				noteId: appearNote.id,
			});

			appearNote.lastSendActivityAt = new Date();
		});
	}

	function directReply(): void {
		os.post({
			reply: appearNote,
			initialVisibility: "specified",
			initialVisibleUsers: appearNote.mentions
				? [appearNote.user, ...appearNote.mentions]
				: [appearNote.user],
		});
	}

	function airReply(): void {
		const v =
			appearNote.user.host != null && appearNote.visibility === "public"
				? "home"
				: appearNote.visibility;
		os.post({
			airReply: appearNote,
			initialVisibility: v,
			initialLocalOnly: appearNote.user.host == null,
			key: appearNote.id,
		});
	}

	function delEdit(): void {
		os.confirm({
			type: "warning",
			text: i18n.ts.deleteAndEditConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			os.api("notes/delete", {
				noteId: appearNote.id,
			});

			os.post({
				initialNote: appearNote,
				renote: appearNote.renote,
				reply: appearNote.reply,
				channel: appearNote.channel,
			});
		});
	}

	function toggleFavorite(favorite: boolean): void {
		os.apiWithDialog(
			favorite ? "notes/favorites/create" : "notes/favorites/delete",
			{
				noteId: appearNote.id,
			},
		);
	}

	function toggleWatch(watch: boolean): void {
		os.apiWithDialog(
			watch ? "notes/watching/create" : "notes/watching/delete",
			{
				noteId: appearNote.id,
			},
		);
	}

	function toggleThreadMute(mute: boolean): void {
		os.apiWithDialog(
			mute ? "notes/thread-muting/create" : "notes/thread-muting/delete",
			{
				noteId: appearNote.id,
			},
		);
	}

	function copyContent(): void {
		if (
			defaultStore.state.copyPostRemoteEmojiCode &&
			appearNote.user?.host != null
		) {
			copyToClipboard(
				appearNote.text.replaceAll(
					/:(\w+):/g,
					`:\$1@${appearNote.user?.host}:`,
				),
			);
		} else {
			copyToClipboard(appearNote.text);
		}
		os.success();
	}

	function showSource(): void {
		let text: string;
		let cw: string | undefined;
		if (
			defaultStore.state.copyPostRemoteEmojiCode &&
			appearNote.user?.host != null
		) {
			if (appearNote.cw) {
				cw = appearNote.cw.replaceAll(
					/:(\w+):/g,
					`:\$1@${appearNote.user?.host}:`,
				);
			}

			text = (appearNote.text ?? "").replaceAll(
				/:(\w+):/g,
				`:\$1@${appearNote.user?.host}:`,
			);
		} else {
			if (appearNote.cw) {
				cw = appearNote.cw;
			}
			text = appearNote.text ?? "";
		}
		const replacecw = cw?.replaceAll(
			/[\u001c\u001f\u11a3-\u11a7\u180e\u200b-\u200f\u2060\u3164\u034f\u202a-\u202e\u2061-\u2063]/g,
			function (match) {
				// マッチした文字の Unicode コードポイントを取得し、"(u+XXXX)" 形式に変換
				return `[u+${match.charCodeAt(0).toString(16).toUpperCase()}]`;
			},
		);
		const replaceText = text.replaceAll(
			/[\u001c\u001f\u11a3-\u11a7\u180e\u200b-\u200f\u2060\u3164\u034f\u202a-\u202e\u2061-\u2063]/g,
			function (match) {
				// マッチした文字の Unicode コードポイントを取得し、"(u+XXXX)" 形式に変換
				return `[u+${match.charCodeAt(0).toString(16).toUpperCase()}]`;
			},
		);
		props.info.value = {
			ready: true,
			title: i18n.ts.noteSource,
			text: replacecw ? replacecw + "\n\n" + replaceText : replaceText,
			copy: text,
			mfm: false,
		};
	}

	function copyLink(): void {
		copyToClipboard(`${url}/notes/${appearNote.id}`);
		os.success();
	}

	function copyRemoteLink(): void {
		copyToClipboard(appearNote.url || appearNote.uri);
		os.success();
	}

	function copyId(): void {
		copyToClipboard(appearNote.id);
		os.success();
	}

	function noteReplacer(key: string, value: unknown) {
		if (
			key === "user" ||
			key === "myReactionCnt" ||
			key.startsWith("_") ||
			value === null ||
			value === false ||
			value === 0 ||
			(Array.isArray(value) && value.length !== undefined && value.length === 0) ||
			(typeof value === "object" && Object.keys(value).length === 0)
		) {
			return undefined;
		}
		return typeof value === "string" ? value.replaceAll(
			/[\u001c\u001f\u11a3-\u11a7\u180e\u200b-\u200f\u2060\u3164\u034f\u202a-\u202e\u2061-\u2063]/g,
			function (match) {
				// マッチした文字の Unicode コードポイントを取得し、"(u+XXXX)" 形式に変換
				return `\\u${match.charCodeAt(0).toString(16).toLowerCase()}`;
			},
		) : value;
	}

	function copyNote(): void {
		let _note = { ...appearNote };
		copyToClipboard(JSON.stringify(_note, noteReplacer, "\t"));
		os.success();
	}

	function showNote(): void {
		let _note = { ...appearNote };
		const text = JSON.stringify(_note, noteReplacer, "\t");
		props.info.value = {
			ready: true,
			title: i18n.ts.noteInfo,
			text,
			copy: text,
			mfm: false,
		};
	}

	function togglePin(pin: boolean): void {
		os.apiWithDialog(
			pin ? "i/pin" : "i/unpin",
			{
				noteId: appearNote.id,
			},
			undefined,
		).catch((res) => {
			if (res.id === "72dab508-c64d-498f-8740-a8eec1ba385a") {
				os.alert({
					type: "error",
					text: i18n.ts.pinLimitExceeded,
				});
			}
		});
	}

	async function clip(): Promise<void> {
		const clips = await os.api("clips/list");
		os.popupMenu(
			[
				{
					icon: "ph-plus ph-bold ph-lg",
					text: i18n.ts.createNew,
					action: async () => {
						const { canceled, result } = await os.form(i18n.ts.createNewClip, {
							name: {
								type: "string",
								label: i18n.ts.name,
							},
							description: {
								type: "string",
								required: false,
								multiline: true,
								label: i18n.ts.description,
							},
							isPublic: {
								type: "boolean",
								label: i18n.ts.public,
								default: false,
							},
						});
						if (canceled) return;

						const clip = await os.apiWithDialog("clips/create", result);

						os.apiWithDialog("clips/add-note", {
							clipId: clip.id,
							noteId: appearNote.id,
						});
					},
				},
				null,
				...clips.map((clip) => ({
					text: clip.name,
					action: () => {
						os.promiseDialog(
							os.api("clips/add-note", {
								clipId: clip.id,
								noteId: appearNote.id,
							}),
							null,
							async (err) => {
								if (err.id === "734806c4-542c-463a-9311-15c512803965") {
									const confirm = await os.confirm({
										type: "warning",
										text: i18n.t("confirmToUnclipAlreadyClippedNote", {
											name: clip.name,
										}),
									});
									if (!confirm.canceled) {
										os.apiWithDialog("clips/remove-note", {
											clipId: clip.id,
											noteId: appearNote.id,
										});
										if (props.currentClipPage?.value.id === clip.id)
											props.isDeleted.value = true;
									}
								} else {
									os.alert({
										type: "error",
										text: `${err.message}\n${err.id}`,
									});
								}
							},
						);
					},
				})),
			],
			props.menuButton.value,
			{},
		).then(focus);
	}

	async function unclip(): Promise<void> {
		os.apiWithDialog("clips/remove-note", {
			clipId: props.currentClipPage.value.id,
			noteId: appearNote.id,
		});
		props.isDeleted.value = true;
	}

	async function promote(): Promise<void> {
		const { canceled, result: days } = await os.inputNumber({
			title: i18n.ts.numberOfDays,
		});

		if (canceled) return;

		os.apiWithDialog("admin/promo/create", {
			noteId: appearNote.id,
			expiresAt: Date.now() + 86400000 * days,
		});
	}

	function share(): void {
		navigator.share({
			title: i18n.t("noteOf", { user: appearNote.user.name }),
			text: appearNote.text,
			url: `${url}/notes/${appearNote.id}`,
		});
	}

	function showReactions(): void {
		os.popup(
			defineAsyncComponent(
				() => import("@/components/MkReactedUsersDialog.vue"),
			),
			{
				noteId: appearNote.id,
			},
			{},
			"closed",
		);
	}

	async function translate(): Promise<void> {
		if (props.translation.value != null) return;
		props.translating.value = true;
		const res = await os.api("notes/translate", {
			noteId: appearNote.id,
			targetLang: localStorage.getItem("lang") || navigator.language,
		});
		props.translating.value = false;
		props.translation.value = res;
	}

	let menu;
	if ($i) {
		const statePromise = os.api("notes/state", {
			noteId: appearNote.id,
		});

		menu = [
			...(props.currentClipPage?.value.userId === $i.id
				? [
						{
							icon: "ph-minus-circle ph-bold ph-lg",
							text: i18n.ts.unclip,
							danger: true,
							action: unclip,
						},
						null,
				  ]
				: []),
			defaultStore.state.enabledAirReply &&
			(appearNote.visibility !== 'specified' || (!appearNote?.user.host && appearNote?.ccUserIdsCount))
				? {
						icon: "ph-paper-plane-tilt ph-bold ph-lg",
						text: i18n.ts.airReply,
						action: airReply,
				  }
				: undefined,

			defaultStore.state.firstPostButtonVisibilityForce &&
			![
				defaultStore.state.defaultNoteVisibility,
				...(defaultStore.state.secondPostButton
					? [defaultStore.state.secondPostVisibility]
					: []),
				...(defaultStore.state.thirdPostButton
					? [defaultStore.state.thirdPostVisibility]
					: []),
				...(defaultStore.state.fourthPostButton
					? [defaultStore.state.fourthPostVisibility]
					: []),
				...(defaultStore.state.fifthPostButton
					? [defaultStore.state.fifthPostVisibility]
					: []),
			].includes("specified")
				? {
						icon: "ph-envelope-simple-open ph-bold ph-lg",
						text: i18n.ts.directReply,
						action: directReply,
				  }
				: undefined,
			{
				icon: "ph-smiley ph-bold ph-lg",
				text: i18n.ts.reaction,
				action: showReactions,
			},
			...(/[\*<>$`\[\]_~:\u001c\u001f\u11a3-\u11a7\u180e\u200b-\u200f\u2060\u3164\u034f\u202a-\u202e\u2061-\u2063]|\\\(|\\\)/.test(
				(appearNote.cw ?? "") + (appearNote.text ?? ""),
			) && !appearNote.deletedAt
				? [
						{
							icon: "ph-clipboard-text ph-bold ph-lg",
							text: i18n.ts.showSource,
							action: showSource,
						},
				  ]
				: ((appearNote.cw ?? "") + (appearNote.text ?? "")).length > 0 && !appearNote.deletedAt
				? [
						{
							icon: "ph-clipboard-text ph-bold ph-lg",
							text: i18n.ts.copyContent,
							action: copyContent,
						},
				  ]
				: []),
			{
				icon: "ph-link-simple ph-bold ph-lg",
				text: i18n.ts.copyLink,
				action: copyLink,
			},
			appearNote.url || appearNote.uri
				? {
						icon: "ph-link ph-bold ph-lg",
						text: i18n.ts.copyRemoteLink,
						action: copyRemoteLink,
				  }
				: undefined,
			...(defaultStore.state.developer
				? [
						{
							icon: "ph-file-code ph-bold ph-lg",
							text: i18n.ts.showNote,
							action: showNote,
						},
				  ]
				: []),
			appearNote.url || appearNote.uri
				? {
						icon: "ph-arrow-square-out ph-bold ph-lg",
						text: i18n.ts.showOnRemote,
						action: () => {
							window.open(appearNote.url || appearNote.uri, "_blank");
						},
				  }
				: undefined,
			shareAvailable() && !appearNote.deletedAt
				? {
						icon: "ph-share-network ph-bold ph-lg",
						text: i18n.ts.share,
						action: share,
				  }
				: undefined,
			instance.translatorAvailable && !appearNote.deletedAt
				? {
						icon: "ph-translate ph-bold ph-lg",
						text: i18n.ts.translate,
						action: translate,
				  }
				: undefined,
			null,
			statePromise.then((state) =>
				state?.isFavorited
					? {
							icon: "ph-bookmark-simple ph-bold ph-lg",
							text: i18n.ts.unfavorite,
							action: () => toggleFavorite(false),
					  }
					: {
							icon: "ph-bookmark-simple ph-bold ph-lg",
							text: i18n.ts.favorite,
							action: () => toggleFavorite(true),
					  },
			),
			{
				icon: "ph-paperclip ph-bold ph-lg",
				text: i18n.ts.clip,
				action: () => clip(),
			},
			appearNote.userId !== $i.id
				? statePromise.then((state) =>
						state.isWatching
							? {
									icon: "ph-eye-slash ph-bold ph-lg",
									text: i18n.ts.unwatch,
									action: () => toggleWatch(false),
							  }
							: {
									icon: "ph-eye ph-bold ph-lg",
									text: i18n.ts.watch,
									action: () => toggleWatch(true),
							  },
				  )
				: undefined,
			statePromise.then((state) =>
				state.isMutedThread
					? {
							icon: "ph-speaker-x ph-bold ph-lg",
							text: i18n.ts.unmuteThread,
							action: () => toggleThreadMute(false),
					  }
					: {
							icon: "ph-speaker-x ph-bold ph-lg",
							text: i18n.ts.muteThread,
							action: () => toggleThreadMute(true),
					  },
			),
			...(appearNote.userId === $i.id
				? ($i.pinnedNoteIds || []).includes(appearNote.id)
					? [
							{
								icon: "ph-caret-double-up ph-bold ph-lg",
								text: i18n.ts.upperPin,
								action: () => togglePin(true),
							},
							{
								icon: "ph-push-pin ph-bold ph-lg",
								text: i18n.ts.unpin,
								action: () => togglePin(false),
							},
					  ]
					: [
							{
								icon: "ph-push-pin ph-bold ph-lg",
								text: i18n.ts.pin,
								action: () => togglePin(true),
							},
					  ]
				: []),
			/*
		...($i.isModerator || $i.isAdmin ? [
			null,
			{
				icon: 'ph-megaphone-simple ph-bold ph-lg',
				text: i18n.ts.promote,
				action: promote
			}]
			: []
		),*/
			...(appearNote.userId !== $i.id
				? [
						null,
						{
							icon: "ph-warning-circle ph-bold ph-lg",
							text: i18n.ts.reportAbuse,
							action: () => {
								const u =
									appearNote.url ||
									appearNote.uri ||
									`${url}/notes/${appearNote.id}`;
								os.popup(
									defineAsyncComponent(
										() => import("@/components/MkAbuseReportWindow.vue"),
									),
									{
										user: appearNote.user,
										initialComment: `Note: ${u}\n-----\n`,
									},
									{},
									"closed",
								);
							},
						},
				  ]
				: []),
			...((appearNote.userId === $i.id || $i.isModerator || $i.isAdmin) &&
			!appearNote.deletedAt
				? [
						null,
						appearNote.userId === $i.id
							? {
									icon: "ph-eraser ph-bold ph-lg",
									text: i18n.ts.deleteAndEdit,
									action: delEdit,
							  }
							: undefined,
						{
							icon: "ph-trash ph-bold ph-lg",
							text: i18n.ts.delete,
							danger: true,
							action: del,
						},
				  ]
				: []),
			...((appearNote.userId === $i.id || $i.isModerator || $i.isAdmin) &&
			appearNote.deletedAt &&
			!(appearNote.localOnly && appearNote.channelId) &&
			!(
				appearNote.lastSendActivityAt &&
				Date.now() < appearNote.lastSendActivityAt.valueOf() + 1000 * 60 * 30
			)
				? [
						null,
						{
							icon: "ph-trash ph-bold ph-lg",
							text: i18n.ts.deleteActivity,
							danger: true,
							action: delActivity,
						},
				  ]
				: []),
		].filter((x) => x !== undefined);
	} else {
		menu = [
			{
				icon: "ph-clipboard-text ph-bold ph-lg",
				text: i18n.ts.showSource,
				action: showSource,
			},
			{
				icon: "ph-link-simple ph-bold ph-lg",
				text: i18n.ts.copyLink,
				action: copyLink,
			},
			appearNote.url || appearNote.uri
				? {
						icon: "ph-arrow-square-out ph-bold ph-lg",
						text: i18n.ts.showOnRemote,
						action: () => {
							window.open(appearNote.url || appearNote.uri, "_blank");
						},
				  }
				: undefined,
		].filter((x) => x !== undefined);
	}

	if (noteActions.length > 0) {
		menu = menu.concat([
			null,
			...noteActions.map((action) => ({
				icon: "ph-plug ph-bold ph-lg",
				text: action.title,
				action: () => {
					action.handler(appearNote);
				},
			})),
		]);
	}

	return menu;
}
