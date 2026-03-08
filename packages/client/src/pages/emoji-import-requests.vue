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

				<div v-else-if="tab === 'approved'" class="tab-content">
					<div v-if="approved.length === 0" class="empty">
						{{ i18n.ts.noApprovedEmojiRequests ?? "承認された申請はありません" }}
					</div>
					<div v-else class="list">
						<div
							v-for="r in approved"
							:key="r.id"
							class="item approved"
						>
							<MkEmoji
								:emoji="`:${r.emojiName}:`"
								:normal="true"
								class="emoji"
							/>
							<div class="body">
								<span class="name">:{{ r.emojiName }}:</span>
								<span class="date">{{ formatDate(r.processedAt ?? r.createdAt) }}</span>
								<div class="actions">
									<MkA :to="`/emoji_dialog/${r.emojiName}`" class="link">{{ i18n.ts.info ?? "詳細" }}</MkA>
									<span class="add-to-deck">
										<button
											v-for="(label, idx) in deckLabels"
											:key="idx"
											class="_button link"
											@click="addToDeck(r.emojiName, idx)"
										>
											{{ label }}に追加
										</button>
									</span>
								</div>
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
 * 申請中の絵文字一覧ページ。pending / rejected / approved を表示し、
 * 承認済みはデッキ追加・詳細リンクを提供する。
 */
import { ref, onMounted, computed } from "vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import MkEmoji from "@/components/global/MkEmoji.vue";

let tab = ref<"pending" | "rejected" | "approved">("pending");

const headerTabs = computed(() => [
	{ key: "pending", title: i18n.ts.pendingEmojiRequests ?? "申請中", icon: "ph-clock ph-bold ph-lg" },
	{ key: "rejected", title: i18n.ts.rejectedEmojiRequests ?? "否認済み", icon: "ph-x-circle ph-bold ph-lg" },
	{ key: "approved", title: i18n.ts.approvedEmojiRequests ?? "承認済み", icon: "ph-check-circle ph-bold ph-lg" },
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

const deckLabels = computed(() => [
	defaultStore.state.reactionsFolderName || "1ページ目",
	defaultStore.state.reactionsFolderName2 || "2ページ目",
	defaultStore.state.reactionsFolderName3 || "3ページ目",
	defaultStore.state.reactionsFolderName4 || "4ページ目",
	defaultStore.state.reactionsFolderName5 || "5ページ目",
]);

async function fetchList() {
	const res = await os.api("emoji-import-request/my-list", {});
	pending.value = res.pending ?? [];
	rejected.value = res.rejected ?? [];
	approved.value = res.approved ?? [];
}

function formatDate(s: string | null): string {
	if (!s) return "";
	const d = new Date(s);
	return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addToDeck(emojiName: string, pageIndex: number) {
	const key = pageIndex === 0 ? "reactions" : `reactions${pageIndex + 1}` as "reactions2" | "reactions3" | "reactions4" | "reactions5";
	const current = defaultStore.state[key] as string[];
	if (current.includes(`:${emojiName}:`)) {
		os.toast(i18n.ts.alreadyAdded ?? "既に追加されています");
		return;
	}
	defaultStore.set(key, [...current, `:${emojiName}:`]);
	os.success();
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
			.actions {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				margin-top: 4px;
				.add-to-deck {
					display: flex;
					gap: 4px;
				}
				.link {
					font-size: 0.9em;
				}
			}
		}
	}
}
</style>
