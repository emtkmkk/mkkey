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
					v-if="pageId"
					class="button"
					inline
					link
					:to="`/@${author.username}/pages/${currentName}`"
					><i class="ph-arrow-square-out ph-bold ph-lg"></i>
					{{ i18n.ts._pages.viewPage }}</MkButton
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
					v-if="pageId && !readonly"
					inline
					class="button"
					@click="duplicate"
					><i class="ph-clipboard-text ph-bold ph-lg"></i>
					{{ i18n.ts.duplicate }}</MkButton
				>
				<MkButton
					v-if="pageId && !readonly"
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
					<MkInput
						v-model="title"
						class="_formBlock"
						:readonly="readonly"
					>
						<template #label>{{ i18n.ts._pages.title }}</template>
					</MkInput>

					<MkInput
						v-model="summary"
						class="_formBlock"
						:readonly="readonly"
					>
						<template #label>{{ i18n.ts._pages.summary }}</template>
					</MkInput>

					<MkInput
						v-model="name"
						class="_formBlock"
						:readonly="readonly"
					>
						<template #prefix
							>{{ url }}/@{{ author.username }}/pages/</template
						>
						<template #label>{{ i18n.ts._pages.url }}</template>
					</MkInput>

					<MkSwitch
						v-model="isPublic"
						class="_formBlock"
						:disabled="readonly"
						>{{ i18n.ts.public }}</MkSwitch
					>

					<MkSwitch
						v-if="!readonly"
						class="_formBlock"
						:model-value="isPlayMode"
						@update:model-value="onPlayModeToggle"
					>
						{{ i18n.ts._pages.playMode.enable }}
						<template #caption>{{
							i18n.ts._pages.playMode.enableDescription
						}}</template>
					</MkSwitch>
					<MkSwitch
						v-else
						class="_formBlock"
						:model-value="isPlayMode"
						disabled
					>
						{{ i18n.ts._pages.playMode.enable }}
						<template #caption>{{
							i18n.ts._pages.playMode.enableDescription
						}}</template>
					</MkSwitch>

					<MkSwitch
						v-model="alignCenter"
						class="_formBlock"
						:disabled="readonly"
						>{{ i18n.ts._pages.alignCenter }}</MkSwitch
					>

					<MkSelect
						v-if="!isPlayMode"
						v-model="font"
						class="_formBlock"
						:disabled="readonly"
					>
						<template #label>{{ i18n.ts._pages.font }}</template>
						<option value="serif">
							{{ i18n.ts._pages.fontSerif }}
						</option>
						<option value="sans-serif">
							{{ i18n.ts._pages.fontSansSerif }}
						</option>
					</MkSelect>

					<div class="eyeCatch">
						<MkButton
							v-if="eyeCatchingImageId == null && !readonly"
							@click="setEyeCatchingImage"
							><i class="ph-plus ph-bold ph-lg"></i>
							{{ i18n.ts._pages.eyeCatchingImageSet }}</MkButton
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
									i18n.ts._pages.eyeCatchingImageRemove
								}}</MkButton
							>
						</div>
					</div>
				</div>
			</div>

			<div v-else-if="tab === 'contents'">
				<div>
					<XBlocks
						v-model="content"
						class="content"
						:hpml="hpml"
						:readonly="readonly"
					/>
					<MkButton v-if="!readonly" @click="add()"
						><i class="ph-plus ph-bold ph-lg"></i
					></MkButton>
				</div>
			</div>

			<div v-else-if="tab === 'variables'">
				<div class="qmuvgica">
					<XDraggable
						v-show="variables.length > 0"
						v-model="variables"
						tag="div"
						class="variables"
						item-key="name"
						handle=".drag-handle"
						:group="{ name: 'variables' }"
						:disabled="readonly"
						animation="150"
						swap-threshold="0.5"
					>
						<template #item="{ element }">
							<XVariable
								:model-value="element"
								:removable="!readonly"
								:hpml="hpml"
								:name="element.name"
								:title="element.name"
								:draggable="!readonly"
								@remove="() => removeVariable(element)"
							/>
						</template>
					</XDraggable>

					<MkButton
						v-if="!readonly"
						class="add"
						@click="addVariable()"
						><i class="ph-plus ph-bold ph-lg"></i
					></MkButton>
				</div>
			</div>

			<div v-else-if="tab === 'script'">
				<div class="play-script-editor">
					<div v-if="!readonly && isPlayMode" class="play-mode-actions _gap">
						<MkButton inline @click="insertPlayPreset()">
							<i class="ph-code ph-bold ph-lg"></i>
							{{ i18n.ts._pages.playMode.insertPreset }}
						</MkButton>
						<MkButton inline primary @click="previewPlayScript()">
							<i class="ph-play ph-bold ph-lg"></i>
							{{ i18n.ts._pages.playMode.preview }}
						</MkButton>
					</div>
					<p v-if="isPlayMode" class="play-mode-hint">
						{{ i18n.ts._pages.playMode.hint }}
					</p>
					<MkTextarea v-model="script" class="_code" :readonly="readonly" />
					<div
						v-if="isPlayMode && previewRoot"
						class="play-preview _panel _gap"
					>
						<h3>{{ i18n.ts._pages.playMode.previewTitle }}</h3>
						<div
							class="play-preview-root iroscrza asui-play-root"
							:class="{ center: alignCenter }"
						>
							<MkAsUi
								:component="previewRoot"
								:components="previewComponents"
								:align="alignCenter ? 'center' : 'left'"
							/>
						</div>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, provide, watch, onUnmounted } from "vue";
import { v4 as uuid } from "uuid";
import XVariable from "./page-editor.script-block.vue";
import XBlocks from "./page-editor.blocks.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkButton from "@/components/MkButton.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkInput from "@/components/form/input.vue";
import MkAsUi from "@/components/MkAsUi.vue";
import { blockDefs } from "@/scripts/hpml/index";
import { HpmlTypeChecker } from "@/scripts/hpml/type-checker";
import { url } from "@/config";
import { collectPageVars } from "@/scripts/collect-page-vars";
import { isPagePlayMode } from "@/scripts/aiscript/page-mode";
import {
	abortPlayScript,
	createPlayScriptContext,
	runPlayScript,
} from "@/scripts/aiscript/play-runner";
import * as os from "@/os";
import { selectFile } from "@/scripts/select-file";
import { mainRouter } from "@/router";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { $i } from "@/account";

const XDraggable = defineAsyncComponent(() =>
	import("vuedraggable").then((x) => x.default)
);

const props = defineProps<{
	initPageId?: string;
	initPageName?: string;
	initUser?: string;
}>();

let tab = $ref("settings");
let author = $ref($i);
let readonly = $ref(false);
let page = $ref(null);
let pageId = $ref(null);
let currentName = $ref(null);
let title = $ref("");
let summary = $ref(null);
let name = $ref(Date.now().toString());
let eyeCatchingImage = $ref(null);
let eyeCatchingImageId = $ref(null);
let font = $ref("sans-serif");
let content = $ref([]);
let alignCenter = $ref(false);
let isPublic = $ref(true);
let variables = $ref([]);
let hpml = $ref(null);
let script = $ref("");

/** content 空 + script ありで Play モード */
const isPlayMode = $computed(() => isPagePlayMode({ content, script }));

/** Play モードプレビュー用コンテキスト */
const previewCtx = createPlayScriptContext();
const previewRoot = $computed(() => previewCtx.root.value);
const previewComponents = $computed(() => previewCtx.components.value);

onUnmounted(() => {
	abortPlayScript(previewCtx);
});

/** Misskey Play 互換の最小プリセット */
const PLAY_SCRIPT_PRESET = `/// @ 0.16.0

Ui:render([
	Ui:C:container({
		align: "center"
		children: [
			Ui:C:text({ text: "Hello, Play!" })
			Ui:C:button({
				text: "更新"
				primary: true
				onClick: @() {
					Ui:render([
						Ui:C:text({ text: "ボタンが押されました" })
					])
				}
			})
		]
	})
])
`;

async function switchToPlayMode() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts._pages.playMode.switchToPlayConfirm,
	});
	if (canceled) return;

	content = [];
	variables = [];
	// Play モードは Misskey Play に合わせてデフォルト中央寄せ
	alignCenter = true;
	if (!script.trim()) {
		script = PLAY_SCRIPT_PRESET;
	}
}

async function switchToBlockMode() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts._pages.playMode.switchToBlockConfirm,
	});
	if (canceled) return;

	const id = uuid();
	content = [{ id, type: "text", text: "" }];
}

async function onPlayModeToggle(enabled: boolean): Promise<void> {
	if (enabled) {
		await switchToPlayMode();
	} else {
		await switchToBlockMode();
	}
}

function insertPlayPreset() {
	script = PLAY_SCRIPT_PRESET;
}

async function previewPlayScript() {
	if (!script.trim()) return;
	try {
		await runPlayScript(script, previewCtx, {
			storageKey: `pages:preview:${pageId ?? "new"}`,
			thisId: pageId ?? "preview",
			thisUrl: `${url}/@${author?.username ?? "user"}/pages/${name}`,
			token: $i?.token,
		});
	} catch (err: any) {
		os.alert({
			type: "error",
			text: err.message ?? String(err),
		});
	}
}

provide("readonly", computed(() => readonly));
provide("getScriptBlockList", getScriptBlockList);
provide("getPageBlockList", getPageBlockList);

watch($$(eyeCatchingImageId), async () => {
	if (eyeCatchingImageId == null) {
		eyeCatchingImage = null;
	} else {
		eyeCatchingImage = await os.api("drive/files/show", {
			fileId: eyeCatchingImageId,
		});
	}
});

function getSaveOptions() {
	return {
		title: title.trim(),
		name: name.trim(),
		summary: summary,
		font: font,
		script: script,
		alignCenter: alignCenter,
		isPublic: isPublic,
		content: content,
		variables: variables,
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
					title: i18n.ts._pages.invalidNameTitle,
					text: i18n.ts._pages.invalidNameText,
				});
			}
		} else if (err.code === "NAME_ALREADY_EXISTS") {
			os.alert({
				type: "error",
				text: i18n.ts._pages.nameAlreadyExists,
			});
		}
	};

	if (pageId) {
		options.pageId = pageId;
		os.api("pages/update", options)
			.then((page) => {
				currentName = name.trim();
				os.alert({
					type: "success",
					text: i18n.ts._pages.updated,
				});
			})
			.catch(onError);
	} else {
		os.api("pages/create", options)
			.then((created) => {
				pageId = created.id;
				currentName = name.trim();
				os.alert({
					type: "success",
					text: i18n.ts._pages.created,
				});
				mainRouter.push(`/pages/edit/${pageId}`);
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
		os.api("pages/delete", {
			pageId: pageId,
		}).then(() => {
			os.alert({
				type: "success",
				text: i18n.ts._pages.deleted,
			});
			mainRouter.push("/pages");
		});
	});
}

function duplicate() {
	title = `${title} - copy`;
	name = `${name}-copy`;
	os.api("pages/create", getSaveOptions()).then((created) => {
		pageId = created.id;
		currentName = name.trim();
		os.alert({
			type: "success",
			text: i18n.ts._pages.created,
		});
		mainRouter.push(`/pages/edit/${pageId}`);
	});
}

async function add() {
	const { canceled, result: type } = await os.select({
		type: null,
		title: i18n.ts._pages.chooseBlock,
		groupedItems: getPageBlockList(),
	});
	if (canceled) return;

	const id = uuid();
	content.push({ id, type });
}

async function addVariable() {
	let { canceled, result: name } = await os.inputText({
		title: i18n.ts._pages.enterVariableName,
	});
	if (canceled) return;

	name = name.trim();

	if (hpml.isUsedName(name)) {
		os.alert({
			type: "error",
			text: i18n.ts._pages.variableNameIsAlreadyUsed,
		});
		return;
	}

	const id = uuid();
	variables.push({ id, name, type: null });
}

function removeVariable(v) {
	variables = variables.filter((x) => x.name !== v.name);
}

function getPageBlockList() {
	return [
		{
			label: i18n.ts._pages.contentBlocks,
			items: [
				{ value: "section", text: i18n.ts._pages.blocks.section },
				{ value: "text", text: i18n.ts._pages.blocks.text },
				{ value: "image", text: i18n.ts._pages.blocks.image },
				{ value: "textarea", text: i18n.ts._pages.blocks.textarea },
				{ value: "note", text: i18n.ts._pages.blocks.note },
				{ value: "canvas", text: i18n.ts._pages.blocks.canvas },
			],
		},
		{
			label: i18n.ts._pages.inputBlocks,
			items: [
				{ value: "button", text: i18n.ts._pages.blocks.button },
				{
					value: "radioButton",
					text: i18n.ts._pages.blocks.radioButton,
				},
				{ value: "textInput", text: i18n.ts._pages.blocks.textInput },
				{
					value: "textareaInput",
					text: i18n.ts._pages.blocks.textareaInput,
				},
				{
					value: "numberInput",
					text: i18n.ts._pages.blocks.numberInput,
				},
				{ value: "switch", text: i18n.ts._pages.blocks.switch },
				{ value: "counter", text: i18n.ts._pages.blocks.counter },
			],
		},
		{
			label: i18n.ts._pages.specialBlocks,
			items: [
				{ value: "if", text: i18n.ts._pages.blocks.if },
				{ value: "post", text: i18n.ts._pages.blocks.post },
			],
		},
	];
}

function getScriptBlockList(type: string = null) {
	const list = [];

	const blocks = blockDefs.filter(
		(block) =>
			type == null ||
			block.out == null ||
			block.out === type ||
			typeof block.out === "number"
	);

	for (const block of blocks) {
		const category = list.find((x) => x.category === block.category);
		if (category) {
			category.items.push({
				value: block.type,
				text: i18n.t(`_pages.script.blocks.${block.type}`),
			});
		} else {
			list.push({
				category: block.category,
				label: i18n.t(`_pages.script.categories.${block.category}`),
				items: [
					{
						value: block.type,
						text: i18n.t(`_pages.script.blocks.${block.type}`),
					},
				],
			});
		}
	}

	const userFns = variables.filter((x) => x.type === "fn");
	if (userFns.length > 0) {
		list.unshift({
			label: i18n.t("_pages.script.categories.fn"),
			items: userFns.map((v) => ({
				value: `fn:${v.name}`,
				text: v.name,
			})),
		});
	}

	return list;
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
	hpml = new HpmlTypeChecker();

	watch(
		$$(variables),
		() => {
			hpml.variables = variables;
		},
		{ deep: true }
	);

	watch(
		$$(content),
		() => {
			hpml.pageVars = collectPageVars(content);
		},
		{ deep: true }
	);

	if (props.initPageId) {
		page = await os.api("pages/show", {
			pageId: props.initPageId,
		});
	} else if (props.initPageName && props.initUser) {
		page = await os.api("pages/show", {
			name: props.initPageName,
			username: props.initUser,
		});
		readonly = true;
	}

	if (page) {
		author = page.user;
		pageId = page.id;
		title = page.title;
		name = page.name;
		currentName = page.name;
		summary = page.summary;
		font = page.font;
		script = page.script;
		alignCenter = page.alignCenter;
		isPublic = page.isPublic;
		content = page.content;
		variables = page.variables;
		eyeCatchingImageId = page.eyeCatchingImageId;
	} else {
		const id = uuid();
		content = [
			{
				id,
				type: "text",
				text: "",
			},
		];
	}
}

init();

const headerActions = $computed(() => []);

const headerTabs = $computed(() => {
	const tabs = [
		{
			key: "settings",
			title: i18n.ts._pages.pageSetting,
			icon: "ph-gear-six ph-bold ph-lg",
		},
		{
			key: "contents",
			title: i18n.ts._pages.contents,
			icon: "ph-sticker ph-bold ph-lg",
		},
		{
			key: "variables",
			title: i18n.ts._pages.variables,
			icon: "ph-magic-wand ph-bold ph-lg",
		},
		{
			key: "script",
			title: i18n.ts.script,
			icon: "ph-code ph-bold ph-lg",
		},
	];

	if (isPlayMode) {
		return tabs.filter((t) => t.key === "settings" || t.key === "script");
	}
	return tabs;
});

definePageMetadata(
	computed(() => {
		let title = i18n.ts._pages.newPage;
		if (props.initPageId) {
			title = i18n.ts._pages.editPage;
		} else if (props.initPageName && props.initUser) {
			title = i18n.ts._pages.readPage;
		}
		return {
			title: title,
			icon: "ph-pencil ph-bold ph-lg",
		};
	})
);
</script>

<style lang="scss" scoped>
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

.play-script-editor {
	> .play-mode-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	> .play-mode-hint {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		opacity: 0.8;
	}

	> .play-preview {
		margin-top: 1rem;
		padding: 1rem;

		> h3 {
			margin: 0 0 0.75rem 0;
			font-size: 0.95rem;
		}

		> .play-preview-root {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			width: 100%;

			&.center {
				text-align: center;
			}
		}
	}
}
</style>
