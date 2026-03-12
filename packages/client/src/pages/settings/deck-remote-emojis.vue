<template>
	<div class="_formRoot">
		<p v-if="remoteEmojis.length === 0" class="description">
			{{ i18n.ts.deckRemoteEmojiEmpty ?? "絵文字デッキにリモート絵文字はありません。" }}
		</p>
		<div v-else class="emojis">
			<button
				v-for="e in remoteEmojis"
				:key="`${e.name}@${e.host}`"
				class="item _button _panel"
				:class="{ convertible: hasLocalSameName(e.name) }"
				@click="(ev: MouseEvent) => openItemMenu(e, ev)"
			>
				<MkEmoji
					:emoji="`:${e.name}@${e.host}:`"
					:normal="true"
					class="emoji"
				/>
				<div class="body">
					<div class="label">
						<i
							v-if="hasLocalSameName(e.name)"
							class="convertible-icon ph-hand-withdraw ph-bold ph-sm"
							:title="i18n.ts.convertToLocalEmoji ?? 'ローカル絵文字に変換'"
						></i>
						{{ e.name }}@{{ e.host }}
					</div>
				</div>
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字デッキ（reactions / reactions2〜5）に含まれるリモート絵文字を一覧表示する設定ページ。
 * 行タップで「ローカル絵文字に変換」「インポート申請」メニューを表示する。
 */
import { computed } from "vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { instance } from "@/instance";
import * as config from "@/config";
import { requestEmojiImportFlow } from "@/scripts/request-emoji-import";
import type { MenuItem } from "@/types/menu";

const DECK_KEYS = [
	"reactions",
	"reactions2",
	"reactions3",
	"reactions4",
	"reactions5",
] as const;

function parseDeckEntry(entry: string): { name: string; host: string } | null {
	if (!entry.startsWith(":") || !entry.endsWith(":")) return null;
	const inner = entry.slice(1, -1);
	const at = inner.indexOf("@");
	if (at === -1) return null;
	const name = inner.slice(0, at);
	const host = inner.slice(at + 1);
	if (!name || !host) return null;
	if (host === config.host) return null;
	return { name, host };
}

const remoteEmojis = computed(() => {
	const set = new Map<string, { name: string; host: string }>();
	for (const key of DECK_KEYS) {
		const deck = defaultStore.state[key] as string[] | undefined;
		if (!deck) continue;
		for (const entry of deck) {
			const parsed = parseDeckEntry(entry);
			if (!parsed) continue;
			const keyStr = `${parsed.name}@${parsed.host}`;
			if (!set.has(keyStr)) set.set(keyStr, parsed);
		}
	}
	return [...set.values()];
});

function hasLocalSameName(name: string): boolean {
	const local = instance.emojis ?? [];
	return local.some(
		(e) =>
			(e.host == null || e.host === config.host) &&
			e.name.toLowerCase() === name.toLowerCase(),
	);
}

function convertToLocal(item: { name: string; host: string }): void {
	const remoteKey = `:${item.name}@${item.host}:`;
	const localKey = `:${item.name}:`;
	for (const key of DECK_KEYS) {
		const deck = defaultStore.state[key] as string[];
		const next = deck.map((entry) =>
			entry === remoteKey ? localKey : entry,
		);
		if (JSON.stringify(next) !== JSON.stringify(deck)) {
			defaultStore.set(key, next);
		}
	}
}

function openItemMenu(
	item: { name: string; host: string },
	ev: MouseEvent,
): void {
	const canConvert = hasLocalSameName(item.name);
	const menu: MenuItem[] = [];
	if (canConvert) {
		menu.push({
			text: i18n.ts.convertToLocalEmoji ?? "ローカル絵文字に変換",
			icon: "ph-hand-withdraw ph-bold ph-lg",
			action: () => {
				convertToLocal(item);
				os.success();
			},
		});
	}
	menu.push({
		text: i18n.ts.requestEmojiImport ?? "インポート申請",
		icon: "ph-smiley-sticker ph-bold ph-lg",
		action: () => requestEmojiImportFlow(item.name, item.host),
	});
	os.popupMenu(menu, ev.currentTarget ?? (ev.target as HTMLElement));
}

definePageMetadata({
	title: i18n.ts.deckRemoteEmojiList ?? "絵文字デッキのリモート絵文字一覧",
	icon: "ph-planet ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.description {
	margin: 0;
	color: var(--fgTransparentWeak);
	font-size: 0.9em;
}
.emojis {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
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

	&.convertible {
		border-left: 3px solid var(--accent);
		.body .label {
			color: var(--accent);
		}
	}

	.emoji {
		width: 2.625rem;
		height: 2.625rem;
		flex-shrink: 0;
	}
	.body {
		min-width: 0;
		.label {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;

			.convertible-icon {
				flex-shrink: 0;
				opacity: 0.9;
			}
		}
	}
}
</style>
