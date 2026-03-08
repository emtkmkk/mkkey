<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				v-model:tab="tab"
				:tabs="headerTabs"
				:display-back-button="true"
			/>
		</template>
		<MkSpacer :content-max="700">
			<div class="emojirequests">
				<div v-if="tab === 'pending'" class="tab-content">
					<div v-if="pending.length === 0" class="empty">
						{{ i18n.ts.noPendingEmojiRequests ?? "申請中の絵文字はありません" }}
					</div>
					<div v-else class="list">
						<div
							v-for="r in pending"
							:key="r.id"
							class="item pending"
						>
							<MkEmoji
								:emoji="`:${r.emojiName}@${r.emojiHost}:`"
								:normal="true"
								class="emoji"
							/>
							<div class="body">
								<span class="name">:{{ r.emojiName }}@{{ r.emojiHost }}:</span>
								<span class="date">{{ formatDate(r.createdAt) }}</span>
							</div>
						</div>
					</div>
				</div>

				<div v-else-if="tab === 'approved'" class="tab-content">
					<div v-if="approved.length === 0" class="empty">
						{{ i18n.ts.noApprovedEmojiRequests ?? "承認された申請はありません" }}
					</div>
					<div v-else class="list">
						<div
							v-for="r in approved"
							:key="r.id"
							class="item approved _button"
							@click="(ev: MouseEvent) => openEmojiMenu(`:${r.emojiName}:`, ev)"
						>
							<MkEmoji
								:emoji="`:${r.emojiName}:`"
								:normal="true"
								class="emoji"
							/>
							<div class="body">
								<span class="name">:{{ r.emojiName }}:</span>
								<span class="date">{{ formatDate(r.processedAt ?? r.createdAt) }}</span>
							</div>
						</div>
					</div>
				</div>

				<div v-else-if="tab === 'rejected'" class="tab-content">
					<div v-if="rejected.length === 0" class="empty">
						{{ i18n.ts.noRejectedEmojiRequests ?? "否認された申請はありません" }}
					</div>
					<div v-else class="list">
						<div
							v-for="r in rejected"
							:key="r.id"
							class="item rejected"
						>
							<MkEmoji
								:emoji="`:${r.emojiName}@${r.emojiHost}:`"
								:normal="true"
								class="emoji"
							/>
							<div class="body">
								<span class="name">:{{ r.emojiName }}@{{ r.emojiHost }}:</span>
								<span class="reason" v-if="r.reason">{{ i18n.ts.rejectReason ?? "理由" }}: {{ r.reason }}</span>
								<span class="date">{{ formatDate(r.processedAt ?? r.createdAt) }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 申請中の絵文字一覧ページ。申請中 / 承認済み / 否認済みタブで表示する。
 * 承認済みの行はタップで既存の絵文字メニュー（コピー・詳細・デッキ追加等）を開く。
 */
import { ref, onMounted, computed } from "vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import MkEmoji from "@/components/global/MkEmoji.vue";
import { openReactionMenu_ } from "@/scripts/reaction-menu";

let tab = ref<"pending" | "rejected" | "approved">("pending");

const headerTabs = computed(() => [
	{ key: "pending", title: i18n.ts.pendingEmojiRequests ?? "申請中", icon: "ph-clock ph-bold ph-lg" },
	{ key: "approved", title: i18n.ts.approvedEmojiRequests ?? "承認済み", icon: "ph-check-circle ph-bold ph-lg" },
	{ key: "rejected", title: i18n.ts.rejectedEmojiRequests ?? "否認済み", icon: "ph-x-circle ph-bold ph-lg" },
]);

let pending = ref<Array<{
	id: string;
	emojiName: string;
	emojiHost: string;
	status: string;
	createdAt: string;
}>>([]);
let rejected = ref<Array<{
	id: string;
	emojiName: string;
	emojiHost: string;
	status: string;
	reason: string | null;
	processedAt: string | null;
	createdAt: string;
}>>([]);
let approved = ref<Array<{
	id: string;
	emojiName: string;
	emojiHost: string;
	status: string;
	importedEmojiId: string | null;
	processedAt: string | null;
	createdAt: string;
}>>([]);

async function fetchList() {
	const res = await os.api("emoji-import-request/my-list", {});
	pending.value = res.pending ?? [];
	rejected.value = res.rejected ?? [];
	approved.value = res.approved ?? [];
	// 申請中が無い場合は承認済みをデフォルト表示
	if (pending.value.length === 0 && tab.value === "pending") {
		tab.value = "approved";
	}
}

function openEmojiMenu(reaction: string, ev: MouseEvent) {
	const el = (ev.currentTarget ?? ev.target) as HTMLElement | null | undefined;
	openReactionMenu_(reaction, null, false, false, el ?? undefined);
}

function formatDate(s: string | null): string {
	if (!s) return "";
	const d = new Date(s);
	return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
	fetchList();
});

definePageMetadata({
	title: i18n.ts.emojiImportRequests ?? "申請中の絵文字",
	icon: "ph-hand-heart ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.emojirequests {
	.tab-content {
		padding-top: 0.5em;
	}
	.empty {
		color: var(--fgTransparentWeak);
		padding: 0.5em 0;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--panel);
		border-radius: 8px;
		.emoji {
			width: 40px;
			height: 40px;
			flex-shrink: 0;
		}
		.body {
			display: flex;
			flex-direction: column;
			gap: 4px;
			min-width: 0;
			.name {
				font-weight: 500;
			}
			.reason {
				font-size: 0.9em;
				color: var(--fgTransparentWeak);
			}
			.date {
				font-size: 0.85em;
				color: var(--fgTransparentWeak);
			}
		}
	}
	.item.approved {
		cursor: pointer;
	}
}
</style>
