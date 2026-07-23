<template>
	<XModalWindow
		ref="dialog"
		:width="400"
		:height="500"
		@close="dialog?.close()"
		@closed="$emit('closed')"
	>
		<template #header>
			<i
				class="ph-seal-check ph-bold ph-lg"
				style="margin-right: 0.5rem"
			></i>
			{{ i18n.ts.badges }}
		</template>
		<div class="mk-badges-dialog">
			<div
				v-for="badge in badges"
				:key="badge.id ?? badge.key"
				class="badge"
			>
				<span class="emoji">
					<i
						v-if="badge.icon"
						:class="badge.icon"
						:style="badge.color ? { color: badge.color } : undefined"
					></i>
					<MkEmoji v-else :emoji="badge.emoji" :normal="true" />
				</span>
				<div class="body">
					<div class="name">{{ badge.name }}</div>
					<div v-if="describe(badge)" class="description">
						{{ describe(badge) }}
					</div>
				</div>
			</div>
			<div v-if="badges.length === 0" class="empty">
				{{ i18n.ts.nothing }}
			</div>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
import XModalWindow from "@/components/MkModalWindow.vue";
import { i18n } from "@/i18n";

/**
 * users/show の badges 要素、または管理人／モデレーター等の合成エントリ。
 * データ側に説明文は無い。emoji が無く icon（Phosphor クラス）で表すものもある。
 */
type Badge = {
	id?: string;
	key: string;
	name: string;
	emoji?: string;
	icon?: string;
	color?: string;
	/** 動的な説明文（周年バッジ等、サーバー側で内容を埋め込む場合）。あればこちらを優先する。 */
	description?: string;
	showBadgeNote?: boolean;
};

defineProps<{
	badges: Badge[];
}>();

defineEmits<{
	(ev: "closed"): void;
}>();

const dialog = $ref<InstanceType<typeof XModalWindow>>();

/**
 * バッジの説明文（key ごと）。バッジデータに説明が無いためクライアント側で補う。
 * 文言は自由に編集してよい。未定義の key は説明を表示しない。
 */
const badgeDescriptions: Record<string, string> = {
	star: "一度でもパワーが★ランクに到達すると付与されるバッジ",
	mkhb: "旧サーバーから移住した方に付与されるバッジ",
	mkb1: "サーバーを支援してくださった事がある方に付与されるバッジ",
	mkb2: "サーバーを支援してくださった事がある方に付与されるバッジ",
	mkb3: "サーバーを支援してくださった事がある方に付与されるバッジ",
	mkb4: "サーバーを支援してくださった事がある方に付与されるバッジ",
	admin: "サーバーの運営・管理を行う管理人に付与されるバッジ",
	moderator: "サーバーの管理をお手伝いするモデレーターに付与されるバッジ",
};

function describe(badge: Badge): string {
	return badge.description ?? badgeDescriptions[badge.key] ?? "";
}
</script>

<style lang="scss" scoped>
.mk-badges-dialog {
	> .badge {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1.25rem;

		&:not(:last-child) {
			border-bottom: solid 0.03125rem var(--divider);
		}

		> .emoji {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			font-size: 1.9rem;
			line-height: 1;

			> i {
				font-size: 2.1rem;
			}
		}

		> .body {
			min-width: 0;

			> .name {
				font-weight: bold;
				line-height: 1.4;
			}

			> .description {
				margin-top: 0.15rem;
				font-size: 0.85em;
				opacity: 0.8;
				line-height: 1.4;
			}
		}
	}

	> .empty {
		padding: 2rem;
		text-align: center;
		opacity: 0.7;
	}
}
</style>
