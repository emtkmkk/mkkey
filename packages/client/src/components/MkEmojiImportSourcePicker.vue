<template>
	<MkModalWindow
		ref="dialog"
		:width="520"
		:scroll="true"
		@close="dialog.close()"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts.selectEmojiSource ?? "絵文字の出典を選択" }}</template>
		<p class="description">
			{{ i18n.ts.selectEmojiSourceDescription ?? "同名の絵文字が複数あります。\n情報を確認し、申請するホストを選んでください。" }}
		</p>
		<div class="emojis">
			<button
				v-for="e in emojis"
				:key="e.host"
				class="item _button _panel"
				:class="{ current: e.host === currentHost }"
				@click="(ev: MouseEvent) => openItemMenu(e.host, ev)"
			>
				<MkEmoji
					:emoji="`:${emojiName}@${e.host}:`"
					:normal="true"
					class="emoji"
				/>
				<div class="body">
					<div class="host">{{ e.host }}</div>
				</div>
			</button>
		</div>
	</MkModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 同名絵文字のホスト選択用ピッカー。フォルダ風グリッドで絵文字を並べ、タップで選択 or 情報メニューを表示する。
 */
import MkModalWindow from "@/components/MkModalWindow.vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import MkCustomEmojiDetailedDialog from "@/components/MkCustomEmojiDetailedDialog.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = defineProps<{
	emojiName: string;
	emojis: Array<{ host: string }>;
	currentHost?: string | null;
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
	(ev: "done", host: string): void;
}>();

const dialog = $ref<InstanceType<typeof MkModalWindow>>();

function select(host: string) {
	emit("done", host);
	dialog.close();
}

function openItemMenu(host: string, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: i18n.ts.select ?? i18n.ts.choose ?? "選択",
				icon: "ph-check ph-bold ph-lg",
				action: () => select(host),
			},
			{
				text: i18n.ts.info ?? "情報",
				icon: "ph-info ph-bold ph-lg",
				action: () => {
					os.apiGet("emoji", { name: props.emojiName, host }).then(
						(res) => {
							os.popup(
								MkCustomEmojiDetailedDialog,
								{ emoji: res },
								{},
								"closed",
							);
						},
					);
				},
			},
		],
		ev.currentTarget ?? (ev.target as HTMLElement),
	);
}
</script>

<style lang="scss" scoped>
.description {
	margin: 0 0 1rem;
	color: var(--fgTransparentWeak);
	font-size: 0.9em;
	white-space: pre-line;
}
.emojis {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(11.875rem, 1fr));
	grid-gap: 0.75rem;
}
.item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem;
	text-align: left;
	border-radius: 0.5rem;
	transition: border-color 0.15s;

	&:hover {
		border-color: var(--accent);
	}
	&.current {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.emoji {
		width: 2.625rem;
		height: 2.625rem;
		flex-shrink: 0;
	}
	.body {
		min-width: 0;
		.host {
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
}
</style>
