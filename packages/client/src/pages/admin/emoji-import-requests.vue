<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				:display-back-button="true"
			/>
		</template>
		<MkSpacer :content-max="900">
			<div class="admin-emoji-requests">
				<div class="tabs">
					<button
						class="tab"
						:class="{ active: statusFilter === 'pending' }"
						@click="statusFilter = 'pending'"
					>
						{{ i18n.ts.pendingEmojiRequests ?? "申請中" }}
					</button>
					<button
						class="tab"
						:class="{ active: statusFilter === 'rejected' }"
						@click="statusFilter = 'rejected'"
					>
						{{ i18n.ts.rejectedEmojiRequests ?? "否認済み" }}
					</button>
				</div>

				<div v-if="loading" class="loading">{{ i18n.ts.loading ?? "読み込み中" }}</div>
				<div v-else-if="items.length === 0" class="empty">
					{{ statusFilter === "pending" ? (i18n.ts.noPendingEmojiRequests ?? "申請はありません") : (i18n.ts.noRejectedEmojiRequests ?? "否認済みはありません") }}
				</div>
				<div v-else class="list">
					<div
						v-for="r in items"
						:key="r.id"
						class="item"
					>
						<MkEmoji
							:emoji="`:${r.emojiName}@${r.emojiHost}:`"
							:normal="true"
							class="emoji"
						/>
						<div class="body">
							<span class="name">:{{ r.emojiName }}@{{ r.emojiHost }}:</span>
							<span v-if="r.requester" class="requester">@{{ r.requester.username }}{{ r.requester.host ? `@${r.requester.host}` : "" }}</span>
							<span class="date">{{ r.createdAt }}</span>
							<p v-if="statusFilter === 'rejected' && r.reason" class="reason">{{ r.reason }}</p>
							<div class="actions">
								<template v-if="statusFilter === 'pending'">
									<MkButton primary inline @click="openApprove(r)">
										{{ i18n.ts.approve ?? "承認" }}
									</MkButton>
									<MkButton danger inline @click="openReject(r)">
										{{ i18n.ts.reject ?? "否認" }}
									</MkButton>
								</template>
								<template v-else-if="statusFilter === 'rejected'">
									<MkButton primary inline @click="openApprove(r)">
										{{ i18n.ts.emojiImportRequestApproveAgain ?? "再承認" }}
									</MkButton>
								</template>
								<MkButton @click="openDetail(r)">
									{{ i18n.ts.info ?? "詳細" }}
								</MkButton>
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
 * 管理者向け・絵文字インポート申請一覧。承認・否認・詳細確認を行う。
 */
import { ref, watch, onMounted } from "vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import MkEmoji from "@/components/global/MkEmoji.vue";
import MkButton from "@/components/MkButton.vue";
import MkCustomEmojiDetailedDialog from "@/components/MkCustomEmojiDetailedDialog.vue";

let statusFilter = ref<"pending" | "rejected">("pending");
let items = ref<any[]>([]);
let loading = ref(true);

async function fetchList() {
	loading.value = true;
	try {
		const res = await os.api("emoji-import-request/list", {
			status: statusFilter.value,
			limit: 50,
			offset: 0,
		});
		items.value = res.items ?? [];
	} finally {
		loading.value = false;
	}
}

watch(statusFilter, () => fetchList());
onMounted(() => fetchList());

async function openApprove(r: { id: string; emojiName: string; emojiHost: string }) {
	const { canceled, result: newName } = await os.inputText({
		title: i18n.ts.approve ?? "承認",
		text: i18n.ts.emojiImportRequestNewNameHint ?? "同名の絵文字がローカルに既にある場合のみ、重複しない新絵文字名を入力してください。ない場合は空でOK。",
		placeholder: r.emojiName,
		default: "",
	});
	if (canceled) return;
	try {
		await os.api("emoji-import-request/approve", {
			requestId: r.id,
			newEmojiName: newName?.trim() || undefined,
		});
		os.success();
		fetchList();
	} catch (err: any) {
		if (err?.code === "NEW_EMOJI_NAME_REQUIRED") {
			os.toast(i18n.ts.emojiImportRequestNewNameRequired ?? "同名の絵文字がローカルに存在します。新絵文字名を入力して再度承認してください。");
			openApprove(r);
			return;
		}
		if (err?.code === "NEW_EMOJI_NAME_CONFLICT") {
			os.toast(i18n.ts.emojiImportRequestNewNameConflict ?? "指定した絵文字名は既に使用されています。別の名前を入力してください。");
			openApprove(r);
			return;
		}
		os.toast(err?.message ?? String(err));
	}
}

async function openReject(r: { id: string; emojiName: string }) {
	const { canceled, result: reason } = await os.inputText({
		title: i18n.ts.reject ?? "否認",
		text: i18n.ts.rejectReasonOptional ?? "理由（任意）",
		placeholder: "",
		default: "",
	});
	if (canceled) return;
	try {
		await os.api("emoji-import-request/reject", {
			requestId: r.id,
			reason: reason?.trim() || null,
		});
		os.success();
		fetchList();
	} catch (err: any) {
		os.toast(err?.message ?? String(err));
	}
}

function openDetail(r: { emojiName: string; emojiHost: string }) {
	os.apiGet("emoji", {
		name: r.emojiName,
		host: r.emojiHost,
	}).then((res) => {
		os.popup(MkCustomEmojiDetailedDialog, { emoji: res }, {}, "closed");
	});
}

definePageMetadata({
	title: i18n.ts.emojiImportRequests ?? "絵文字インポート申請",
	icon: "ph-smiley-sticker ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.admin-emoji-requests {
	.tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		.tab {
			padding: 8px 16px;
			border-radius: 6px;
			background: var(--panel);
			&.active {
				background: var(--accent);
				color: var(--accentForeground);
			}
		}
	}
	.loading,
	.empty {
		color: var(--fgTransparentWeak);
		padding: 1em 0;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
			flex: 1;
			min-width: 0;
			.name { font-weight: 500; }
			.requester { font-size: 0.9em; color: var(--fgTransparentWeak); }
			.date { font-size: 0.85em; color: var(--fgTransparentWeak); }
			.reason { font-size: 0.9em; color: var(--fgTransparentWeak); margin: 4px 0 0; }
			.actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
		}
	}
}
</style>
