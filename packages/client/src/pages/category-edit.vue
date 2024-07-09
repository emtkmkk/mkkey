<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="700">
			<div class="jqqmcavi">
				<MkButton
					v-if="categoryId"
					class="button"
					inline
					link
					:to="`/@${author.username}/categories/${categoryId}`"
					><i class="ph-arrow-square-out ph-bold ph-lg"></i>
					{{ i18n.ts._categories.viewCategory }}</MkButton
				>
				<MkButton
					v-if="!readonly"
					inline
					primary
					class="button"
					@click="save"
					><i class="ph-floppy-disk-back ph-bold ph-lg"></i>
					{{ i18n.ts.save }}</MkButton
				>
				<MkButton
					v-if="categoryId && !readonly"
					inline
					class="button"
					danger
					@click="del"
					><i class="ph-trash ph-bold ph-lg"></i>
					{{ i18n.ts.delete }}</MkButton
				>
			</div>

			<div v-if="tab === 'settings'">
				<div class="_formRoot">
					<MkInput v-model="title" class="_formBlock">
						<template #label>{{ i18n.ts._categories.title }}</template>
					</MkInput>

					<MkInput v-model="name" class="_formBlock">
						<template #label>{{ i18n.ts._categories.name }}</template>
					</MkInput>

					<MkInput v-model="summary" class="_formBlock">
						<template #label>{{ i18n.ts._categories.summary }}</template>
					</MkInput>

					<div class="eyeCatch">
						<MkButton
							v-if="eyeCatchingImageId == null && !readonly"
							@click="setEyeCatchingImage"
							><i class="ph-plus ph-bold ph-lg"></i>
							{{ i18n.ts._categories.eyeCatchingImageSet }}</MkButton
						>
						<div v-else-if="eyeCatchingImage">
							<img
								:src="eyeCatchingImage.url"
								:alt="eyeCatchingImage.name"
								style="max-width: 100%"
							/>
							<MkButton
								v-if="!readonly"
								@click="removeEyeCatchingImage()"
								><i class="ph-trash ph-bold ph-lg"></i>
								{{
									i18n.ts._categories.eyeCatchingImageRemove
								}}</MkButton
							>
						</div>
					</div>
				</div>
			</div>

			<div v-else-if="tab === 'contents'">
				<div>
					<XDraggable
						v-model="contents"
						class="zoaiodol"
						:item-key="(item) => item"
						animation="150"
						delay="100"
						delay-on-touch-only="true"
					>
						<template #item="{ element }">
							<button
								class="_button item"
								@click="remove(element, $event)"
							>
								<MkEmoji
									:emoji="element"
									:normal="true"
									:nofallback="true"
								/>
							</button>
						</template>
						<template #footer>
							<button class="_button add" @click="chooseEmoji">
								<i class="ph-plus ph-bold ph-lg"></i>
							</button>
						</template>
					</XDraggable>
					<template v-if="!contents?.length">
						<template v-if="defaultStore.state.enableEmojiReplace">
							<FormRadios v-model="copyDeckType" class="_formBlock">
								<option value="1">
									{{
										defaultStore.state.reactionsFolderName ||
										"1ページ目"
									}}
								</option>
								<option value="2">
									{{
										defaultStore.state.reactionsFolderName2 ||
										"2ページ目"
									}}
								</option>
								<option value="3">
									{{
										defaultStore.state.reactionsFolderName3 ||
										"3ページ目"
									}}
								</option>
								<option value="4">
									{{
										defaultStore.state.reactionsFolderName4 ||
										"4ページ目"
									}}
								</option>
								<option value="5">
									{{
										defaultStore.state.reactionsFolderName5 ||
										"5ページ目"
									}}
								</option>
								<option value="6">{{ "全絵文字置換" }}</option>
								<option value="7">
									{{
										defaultStore.state.reactionsFolderName5 ||
										"JSON / JSON5"
									}}
								</option>
							</FormRadios>
						</template>
						<template v-else>
							<FormRadios v-model="copyDeckType" class="_formBlock">
								<option value="1">
									{{
										defaultStore.state.reactionsFolderName ||
										"1ページ目"
									}}
								</option>
								<option value="2">
									{{
										defaultStore.state.reactionsFolderName2 ||
										"2ページ目"
									}}
								</option>
								<option value="3">
									{{
										defaultStore.state.reactionsFolderName3 ||
										"3ページ目"
									}}
								</option>
								<option value="4">
									{{
										defaultStore.state.reactionsFolderName4 ||
										"4ページ目"
									}}
								</option>
								<option value="5">
									{{
										defaultStore.state.reactionsFolderName5 ||
										"5ページ目"
									}}
								</option>
								<option value="7">
									{{
										defaultStore.state.reactionsFolderName5 ||
										"JSON / JSON5"
									}}
								</option>
							</FormRadios>
						</template>
						<FormTextarea v-model="code" tall class="_formBlock">
							<template #label>{{ i18n.ts.code }}</template>
						</FormTextarea>
						<MkButton
							@click="copyDeck"
							><i class="ph-copy ph-bold ph-lg"></i>
							{{ i18n.ts._categories.copyDeck }}</MkButton
						>
					</template>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, provide, watch, unref } from "vue";
import { v4 as uuid } from "uuid";
import JSON5 from "json5";
import MkTextarea from "@/components/form/textarea.vue";
import MkButton from "@/components/MkButton.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkInput from "@/components/form/input.vue";
import FormTextarea from "@/components/form/textarea.vue";
import { url } from "@/config";
import * as os from "@/os";
import { selectFile } from "@/scripts/select-file";
import { mainRouter } from "@/router";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import FormRadios from "@/components/form/radios.vue";
import { $i } from "@/account";
import { instance } from "@/instance";
import { defaultStore } from "@/store";
import * as config from "@/config";
import type { MenuLabel } from "@/types/menu";
import type { DriveFile } from "calckey-js/built/entities";

const XDraggable = defineAsyncComponent(() =>
	import("vuedraggable").then((x) => x.default)
);

const props = defineProps<{
	initCategoryId?: string;
	initCategoryName?: string;
	initUser?: string;
}>();

let tab = $ref("settings");
let author = $ref($i);
let readonly = $ref(false);
let category = $ref(null);
let categoryId = $ref(null);
let currentName = $ref(null);
let title = $ref("");
let summary = $ref(null);
let name = $ref(null);
let eyeCatchingImage = $ref<DriveFile | null>(null);
let eyeCatchingImageId = $ref(null);
let contents = $ref<string[]>([]);
let code = $ref<string>();
let copyDeckType = $ref("1");
const customEmojis = $computed(() => instance.emojis);
const allCustomEmojis = $computed(() => instance.allEmojis);
const emojiStr = $computed(() =>
	customEmojis
		? customEmojis.map((x) => `:${x.name}:`)
		: undefined
);
const remoteEmojiStr = $computed(() =>
	allCustomEmojis
		? allCustomEmojis.map((x) => `:${x.name}@${x.host}:`)
		: undefined
);

provide("readonly", readonly);

watch($$(eyeCatchingImageId), async () => {
	if (eyeCatchingImageId == null) {
		eyeCatchingImage = null;
	} else {
		eyeCatchingImage = await os.api("drive/files/show", {
			fileId: eyeCatchingImageId,
		});
	}
});

function copyDeck() {
	switch (copyDeckType) {
		case "1":
			contents = defaultStore.state.reactions;
			break;
		case "2":
			contents = defaultStore.state.reactions2;
			break;
		case "3":
			contents = defaultStore.state.reactions3;
			break;
		case "4":
			contents = defaultStore.state.reactions4;
			break;
		case "5":
			contents = defaultStore.state.reactions5;
			break;
		case "6":
			contents = defaultStore.state.allEmojiReplace;
			break;
		case "7":
			jsonImport();
			break;
	}
}

const onError = (ev) => {
	os.alert({
		type: "error",
		text: ev.message,
	});
};

const jsonImport = () => {
	try {
		if (!code) return;
		let parsedData;
		try {
			parsedData = JSON5.parse(code);
		} catch (parseError) {
			onError(parseError);
			return;
		}

		if (
			Array.isArray(parsedData) &&
			parsedData.every((item) => typeof item === "string")
		) {
			let deck: string[] = [];
			// biome-ignore lint/complexity/noForEach: <explanation>
			parsedData.forEach((x) => {
				if (!x.startsWith(":") || !x.endsWith(":")) {
					if (!deck.includes(x) && [...x].length === 1) {
						deck.push(x);
					}
					return;
				}
				const emojiName = x.split("@")?.[0]?.replaceAll(":", "");
				const emojiHost = x.split("@")?.[1]?.replaceAll(":", "");
				if (emojiStr?.includes(x) || emojiHost === config.host) {
					if (!deck.includes(`:${emojiName}:`)) {
						deck.push(`:${emojiName}:`);
					}
					return;
				}
				if (emojiHost) {
					if (!deck.includes(`:${emojiName}@${emojiHost}:`)) {
						deck.push(`:${emojiName}@${emojiHost}:`);
					}
					return;
				}
				if (!deck.includes(`:${emojiName}:`)) {
					deck.push(`:${emojiName}:`);
				}
				return
			});
			contents = deck;
			code = "";
		} else {
			onError(
				new Error("Invalid data format. Expected an array of strings.")
			);
		}
	} catch (error) {
		onError(error);
	}
};

function deleteReac(reaction) {
		contents = contents.filter((x) => x !== reaction);
	}

function remove(reaction, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: reaction.replace(/@(\S+)$/, "").replaceAll(":", ""),
				type: "label",
			} as MenuLabel,
			reaction.includes("@")
				? {
						text: reaction
							.replace(/^(\S+)@/, "@")
							.replaceAll(":", ""),
						type: "label",
				  } as MenuLabel
				: undefined,
			!reaction.includes("@") &&
			!emojiStr?.includes(reaction) &&
			customEmojis.some((x) =>
				x.aliases?.some(
					(y) => /^\w+$/.test(y) && y === reaction.replaceAll(":", "")
				)
			)
				? {
						text: "代替絵文字に変換",
						action: () => {
								contents[contents.indexOf(reaction)] = `:${
									customEmojis.find((x) =>
										x.aliases?.some(
											(y) =>
												/^\w+$/.test(y) &&
												y ===
													reaction.replaceAll(":", "")
										)
									)?.name
								}:`;
						},
				  }
				: undefined,
			reaction.includes("@") &&
			!remoteEmojiStr?.includes(reaction) &&
			emojiStr?.includes(reaction.replace(/@(\S+)$/, ":"))
				? {
						text: "ローカル絵文字に変換",
						action: () => {
							contents[contents.indexOf(reaction)] = reaction.replace(/@(\S+)$/, ":");
						},
				  }
				: undefined,
			{
				text: i18n.ts.remove,
				action: () => {
					deleteReac(reaction);
				},
			},
		].filter((x) => x !== undefined),
		ev.currentTarget ?? ev.target
	);
}
	
function chooseEmoji(ev: MouseEvent) {
	os.popup(
			defineAsyncComponent(
				() => import("@/components/MkEmojiPickerDialog.vue"),
			),
			{
				src: ev.currentTarget ?? ev.target,
				showPinned: false,
				asReactionPicker: true,
				afterChosenNotClose: true,
				notAddRecents: true,
			},
			{
				done: (emoji) => {
					if (!contents.includes(emoji)) {
						contents.push(emoji);
					}
				},
			},
			"closed",
		);
	}

function getSaveOptions() {
	return {
		title: title.trim(),
		name: (name ?? "").trim(),
		summary: summary,
		contents: contents,
		eyeCatchingImageId: eyeCatchingImageId,
	};
}

function save() {
	const options = getSaveOptions();

	const onError = (err) => {
		if (err.id === "3d81ceae-475f-4600-b2a8-2bc116157532") {
			if (err.info.param === "name") {
				os.alert({
					type: "error",
					title: i18n.ts._categories.invalidNameTitle,
					text: i18n.ts._categories.invalidNameText,
				});
			}
		} else if (err.code === "NAME_ALREADY_EXISTS") {
			os.alert({
				type: "error",
				text: i18n.ts._categories.nameAlreadyExists,
			});
		}
	};

	if (categoryId) {
		options.categoryId = categoryId;
		os.api("categories/update", options)
			.then((category) => {
				currentName = name.trim();
				os.alert({
					type: "success",
					text: i18n.ts._categories.updated,
				});
			})
			.catch(onError);
	} else {
		os.api("categories/create", options)
			.then((created) => {
				categoryId = created.id;
				currentName = name.trim();
				os.alert({
					type: "success",
					text: i18n.ts._categories.created,
				});
				mainRouter.push(`/categories/edit/${categoryId}`);
			})
			.catch(onError);
	}
}

function del() {
	os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: title.trim() }),
	}).then(({ canceled }) => {
		if (canceled) return;
		os.api("categories/delete", {
			categoryId: categoryId,
		}).then(() => {
			os.alert({
				type: "success",
				text: i18n.ts._categories.deleted,
			});
			mainRouter.push("/categories");
		});
	});
}

function setEyeCatchingImage(img) {
	selectFile(img.currentTarget ?? img.target, null).then((file) => {
		eyeCatchingImageId = file.id;
	});
}

function removeEyeCatchingImage() {
	eyeCatchingImageId = null;
}

async function init() {
	if (props.initCategoryId) {
		category = await os.api("categories/show", {
			categoryId: props.initCategoryId,
		});
	} else if (props.initCategoryName && props.initUser) {
		category = await os.api("categories/show", {
			name: props.initCategoryName,
			username: props.initUser,
		});
		readonly = true;
	}

	if (category) {
		author = category.user;
		categoryId = category.id;
		title = category.title;
		name = category.name;
		currentName = category.name;
		summary = category.summary;
		contents = category.contents;
		eyeCatchingImageId = category.eyeCatchingImageId;
	} else {
		const id = uuid();
		content = [];
	}
}

init();

const headerActions = $computed(() => []);

const headerTabs = $computed(() => [
	{
		key: "settings",
		title: i18n.ts._categories.pageSetting,
		icon: "ph-gear-six ph-bold ph-lg",
	},
	{
		key: "contents",
		title: i18n.ts._categories.contents,
		icon: "ph-sticker ph-bold ph-lg",
	},
]);

definePageMetadata(
	computed(() => {
		let title = i18n.ts._categories.newCategory;
		if (props.initCategoryId) {
			title = i18n.ts._categories.editCategory;
		} else if (props.initCategoryName && props.initUser) {
			title = i18n.ts._categories.readCategory;
		}
		return {
			title: title,
			icon: "ph-pencil ph-bold ph-lg",
		};
	})
);
</script>

<style lang="scss" scoped>
.zoaiodol {
	padding: 0.75rem;
	font-size: 1.1em;

	> .item {
		display: inline-block;
		padding: 0.5rem;
		cursor: move;
	}

	> .add {
		display: inline-block;
		padding: 0.5rem;
	}
}
.jqqmcavi {
	> .button {
		& + .button {
			margin: 0.25rem;
		}
	}
}

.gwbmwxkm {
	position: relative;

	> header {
		> .title {
			z-index: 1;
			margin: 0;
			padding: 0 1rem;
			line-height: 2.625rem;
			font-size: 0.9em;
			font-weight: bold;
			box-shadow: 0 0.0625rem rgba(#000, 0.07);

			> i {
				margin-right: 0.375rem;
			}

			&:empty {
				display: none;
			}
		}

		> .buttons {
			position: absolute;
			z-index: 2;
			top: 0;
			right: 0;

			> button {
				padding: 0;
				width: 2.625rem;
				font-size: 0.9em;
				line-height: 2.625rem;
			}
		}
	}

	> section {
		padding: 0 2rem 2rem 2rem;

		@media (max-width: 31.25rem) {
			padding: 0 1rem 1rem 1rem;
		}

		> .view {
			display: inline-block;
			margin: 1rem 0 0 0;
			font-size: 0.875rem;
		}

		> .content {
			margin-bottom: 1rem;
		}

		> .eyeCatch {
			margin-bottom: 1rem;

			> div {
				> img {
					max-width: 100%;
				}
			}
		}
	}
}

.qmuvgica {
	padding: 1rem;

	> .variables {
		margin-bottom: 1rem;
	}

	> .add {
		margin-bottom: 1rem;
	}
}
</style>
