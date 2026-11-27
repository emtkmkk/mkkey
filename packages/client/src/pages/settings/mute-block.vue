<template>
	<div class="_formRoot">
		<MkTab v-model="tab" style="margin-bottom: var(--margin)">
			<option value="mute">{{ i18n.ts.mutedUsers }}</option>
			<option value="block">{{ i18n.ts.blockedUsers }}</option>
		</MkTab>
		<div v-if="tab === 'mute'">
			<MkPagination
				ref="mutingPaginationEl"
				:pagination="mutingPagination"
				class="muting"
			>
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<div
						v-for="mute in items"
						:key="mute.id"
						class="mute-row _formBlock"
					>
						<div v-if="mute.mutee.isDeleted" class="user deleted">
							<MkAcct :user="mute.mutee" />
						</div>
						<FormLink v-else :to="userPage(mute.mutee)" class="user">
							<MkAcct :user="mute.mutee" />
						</FormLink>
						<div class="scopes">{{ formatMuteScopes(mute.muteTypes) }}</div>
						<MkButton inline @click="editMute(mute)">
							{{ i18n.ts.edit }}
						</MkButton>
					</div>
				</template>
			</MkPagination>
		</div>
		<div v-if="tab === 'block'">
			<MkPagination
				ref="blockingPaginationEl"
				:pagination="blockingPagination"
				class="blocking"
			>
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<div
						v-for="block in items"
						:key="block.id"
						class="block-row _formBlock"
					>
						<div v-if="block.blockee.isDeleted" class="user deleted">
							<MkAcct :user="block.blockee" />
						</div>
						<FormLink v-else :to="userPage(block.blockee)" class="user">
							<MkAcct :user="block.blockee" />
						</FormLink>
						<MkButton inline @click="unblock(block)">
							{{ i18n.ts.unblock }}
						</MkButton>
					</div>
				</template>
			</MkPagination>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 範囲付きミュートとブロックの設定一覧ページ。
 *
 * @internal
 */
import {} from "vue";
import MkPagination from "@/components/MkPagination.vue";
import MkTab from "@/components/MkTab.vue";
import FormInfo from "@/components/MkInfo.vue";
import FormLink from "@/components/form/link.vue";
import { userPage } from "@/filters/user";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import MkButton from "@/components/MkButton.vue";
import { configureUserMute } from "@/scripts/mute-scope";
import type { MuteType, UserDetailed } from "calckey-js/built/entities";

/**
 * ミュート一覧APIから受け取る編集対象。
 *
 * @remarks
 * 利用者情報へ範囲と共有期限を補って、統合ミュート設定フォームへ渡す。
 *
 * @internal
 */
type PackedMuting = {
	mutee: UserDetailed;
	muteTypes: MuteType[];
	expiresAt: string | null;
};

let tab = $ref("mute");
let mutingPaginationEl = $ref<InstanceType<typeof MkPagination>>();
/** ブロック一覧（解除後の読み直しに使う） */
let blockingPaginationEl = $ref<InstanceType<typeof MkPagination>>();

const mutingPagination = {
	endpoint: "mute/list" as const,
	limit: 10,
};

const blockingPagination = {
	endpoint: "blocking/list" as const,
	limit: 10,
};

/**
 * APIの範囲名を一覧表示用の文へ変換する。
 *
 * @param types - 表示するミュート範囲
 * @returns ロケール名を中黒で連結した文字列
 * @internal
 */
function formatMuteScopes(types: MuteType[]): string {
	return (types ?? [])
		.map(
			(type) =>
				(i18n.ts._muteScopes as Record<string, string>)[type] ?? type,
		)
		.join("・");
}

/**
 * 一覧行から範囲設定を編集し、完了後に一覧を再取得する。
 *
 * @param mute - 編集するミュート関係
 * @returns 編集を反映して一覧を再取得した時点で解決するPromise
 * @internal
 */
async function editMute(mute: PackedMuting): Promise<void> {
	const updated = await configureUserMute({
		...mute.mutee,
		muteTypes: mute.muteTypes,
		muteExpiresAt: mute.expiresAt,
	});
	if (updated != null) mutingPaginationEl?.reload();
}

/**
 * 一覧の行からブロックを解除し、一覧を読み直す。
 *
 * @param block - 解除するブロック関係
 * @returns 解除して一覧を読み直した時点で解決する Promise
 *
 * @remarks
 * 以前は解除するのにプロフィールを開く必要があり、プロフィールを開けない削除済みの人は
 * ブロックを解除できなかった。
 *
 * @internal
 */
async function unblock(block: { blockee: { id: string } }): Promise<void> {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.unblockConfirm,
	});
	if (canceled) return;
	await os.apiWithDialog("blocking/delete", { userId: block.blockee.id });
	blockingPaginationEl?.reload();
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.muteAndBlock,
	icon: "ph-prohibit ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
// 削除済みの人はプロフィールへのリンクにしない（開いても「削除されたか、見つかりません」になるため）
.user.deleted {
	opacity: 0.7;
}

.block-row {
	display: flex;
	align-items: center;
	gap: 8px 12px;

	.user {
		flex: 1;
		min-width: 0;
	}
}

.mute-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px 12px;
	align-items: center;

	.user {
		grid-column: 1 / -1;
	}

	.scopes {
		color: var(--fgTransparentWeak);
		font-size: 0.9em;
	}
}
</style>
