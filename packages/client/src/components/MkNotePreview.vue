<template>
	<div
		v-size="{ min: [350, 500] }"
		class="fefdfafb"
		:class="{ legacy: isLegacyLayout, modern: !isLegacyLayout }"
	>
		<!--#region legacy: 横並び（既定） -->
		<template v-if="isLegacyLayout">
			<MkAvatar class="avatar" :user="user" />
			<div class="main">
				<div class="header user-ident" @click.stop="onUserIdentClick">
					<MkUserName :user="user" class="mkusername" />
				</div>
				<div class="body">
					<div class="content">
						<Mfm
							v-if="cw != null"
							class="text"
							:text="
								(cw ? preprocess(cw).trim() + ' ' : '') +
								'[' +
								i18n.ts._cw.show +
								']\n'
							"
							:author="user"
							:i="$i"
							:mfm-compat="mfmCompat"
							reaction-menu-enabled
						/>
						<Mfm
							:text="preprocess(text).trim()"
							:author="user"
							:i="$i"
							:mfm-compat="mfmCompat"
							reaction-menu-enabled
						/>
						<MkFolder
							v-if="referenceIds?.length"
							class="references"
							:expanded="refExpand"
							no-style
						>
							<template #header>{{
								referenceIds?.length + " 件の参照"
							}}</template>
							<div
								v-for="reference in referenceIds"
								:key="reference"
								class="reference"
							>
								<XNoteSimple
									v-if="notes[reference]"
									:note="notes[reference]"
								/>
							</div>
						</MkFolder>
					</div>
				</div>
			</div>
		</template>
		<!--#endregion-->

		<!--#region modern: 実投稿に近い配置 -->
		<template v-else>
			<div class="main">
				<div class="header-container">
					<MkAvatar class="avatar" :user="user" />
					<div class="header user-ident" @click.stop="onUserIdentClick">
						<div class="user-names">
							<div class="name">
								<MkUserName :user="user" class="mkusername" />
							</div>
							<div class="username">
								<MkAcct :user="user" />
							</div>
						</div>
					</div>
				</div>
				<div class="body">
					<div class="content">
						<Mfm
							v-if="cw != null"
							class="text"
							:text="
								(cw ? preprocess(cw).trim() + ' ' : '') +
								'[' +
								i18n.ts._cw.show +
								']\n'
							"
							:author="user"
							:i="$i"
							:mfm-compat="mfmCompat"
							reaction-menu-enabled
						/>
						<Mfm
							:text="preprocess(text).trim()"
							:author="user"
							:i="$i"
							:mfm-compat="mfmCompat"
							reaction-menu-enabled
						/>
						<MkFolder
							v-if="referenceIds?.length"
							class="references"
							:expanded="refExpand"
							no-style
						>
							<template #header>{{
								referenceIds?.length + " 件の参照"
							}}</template>
							<div
								v-for="reference in referenceIds"
								:key="reference"
								class="reference"
							>
								<XNoteSimple
									v-if="notes[reference]"
									:note="notes[reference]"
								/>
							</div>
						</MkFolder>
					</div>
				</div>
			</div>
		</template>
		<!--#endregion-->
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 投稿フォーム内のノート本文プレビュー。
 *
 * @remarks
 * NOTE: 表示ユーザーは {@link MkPostForm} から渡す投稿予定アカウント（アカウント切替時は切替先）。
 * NOTE: 既定は legacy（横並び）。`.header`（表示名・acct）を 3 秒以内に二重タップで modern と切替（UI 案内なし）。
 * NOTE: アバターは {@link MkAvatar} 既定どおりプロフィールプレビュー・リンクを利用する。
 *
 * @internal
 */
import { ref, watch } from "vue";
import { preprocess } from "@/scripts/preprocess";
import { shouldEnableMfmCompat } from "@/scripts/mfm-compat";
import { i18n } from "@/i18n";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import MkFolder from "@/components/MkFolder.vue";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import * as os from "@/os";
import type * as misskey from "calckey-js";
import type { Note } from "calckey-js/built/entities";

const props = defineProps<{
	/** 投稿しようとしているアカウント（フォームのアカウント切替と同期） */
	user: misskey.entities.User;
	text: string;
	cw?: string;
	referenceIds?: string[];
}>();

let refExpand = $ref(false);

let previewLayout = $computed(
	defaultStore.makeGetterSetter("postFormPreviewLayout"),
);

/** legacy が既定。modern 以外は legacy 扱い */
const isLegacyLayout = $computed(() => previewLayout !== "modern");

/** `.header` の二重タップ判定ウィンドウ（ミリ秒） */
const USER_IDENT_DOUBLE_TAP_MS = 3000;

/** 直前の `.header` タップ時刻。0 は未タップ */
let lastUserIdentTapAt = 0;

/**
 * `.header`（表示名・acct）のタップ。3 秒以内の二重タップで legacy / modern を切替。
 *
 * @internal
 */
function onUserIdentClick(): void {
	const now = Date.now();
	if (
		lastUserIdentTapAt > 0 &&
		now - lastUserIdentTapAt <= USER_IDENT_DOUBLE_TAP_MS
	) {
		lastUserIdentTapAt = 0;
		previewLayout = previewLayout !== "modern" ? "modern" : "legacy";
		return;
	}
	lastUserIdentTapAt = now;
}

/** プレビューは新規投稿扱いのため、$[position] があれば常に Misskey 互換モードを有効にする */
const mfmCompat = $computed(
	() =>
		shouldEnableMfmCompat(preprocess(props.text).trim()) ||
		(props.cw != null && shouldEnableMfmCompat(preprocess(props.cw).trim())),
);

const notes = ref<Record<string, Note | null>>({});

/**
 * 参照ノートを API から取得する。
 *
 * @param noteId - 参照先ノート ID
 * @returns ノート实体
 * @internal
 */
const getNote = async (noteId: string): Promise<Note> => {
	return (await os.api("notes/show", { noteId })) as Note;
};

watch(
	() => props.referenceIds,
	async (newReferenceIds) => {
		if (newReferenceIds) {
			for (const referenceId of newReferenceIds) {
				if (!notes.value[referenceId]) {
					try {
						notes.value[referenceId] = await getNote(referenceId);
					} catch (error) {
						console.error(
							`Failed to get note for referenceId ${referenceId}:`,
							error,
						);
					}
				}
			}
		}
	},
	{ immediate: true },
);
</script>

<style lang="scss" scoped>
.fefdfafb {
	margin: 0;
	padding: 0;
	overflow: clip;
	font-size: 0.95em;

	// レイアウト共通のアバター見た目（legacy / modern の DOM 構造差を吸収するため、
	// 子孫セレクタ `.avatar` を一箇所だけで定義する）
	.avatar {
		flex-shrink: 0;
		display: block;
		margin: 0 0.625rem 0 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
	}

	.user-ident {
		cursor: default;
	}

	.content {
		> .text {
			cursor: default;
			margin: 0;
			padding: 0;
		}

		> .references {
			padding-top: 0.5rem;
			.reference {
				padding-top: 0.5rem;
				> * {
					padding: 1rem;
					border: solid 0.0625rem var(--accent);
					border-radius: 0.5rem;
					transition: background 0.2s;
					&:hover,
					&:focus-within {
						background: var(--tlPanelHighlight);
					}
				}
			}
		}
	}

	//#region legacy
	&.legacy {
		display: flex;

		> .main {
			flex: 1;
			min-width: 0;

			> .header {
				margin-bottom: 0.125rem;
				font-weight: bold;
			}
		}
	}
	//#endregion

	//#region modern
	&.modern {
		> .main {
			min-width: 0;

			> .header-container {
				display: flex;
				align-items: flex-start;

				// アバターサイズはレイアウト共通の `.avatar` 定義に任せる

				> .header {
					flex: 1;
					min-width: 0;
					line-height: 1.5;

					> .user-names {
						display: flex;
						flex-direction: column;
						align-items: flex-start;
						gap: 0.1em 0;
						overflow: hidden;

						> .name {
							max-width: 100%;
							overflow: hidden;
							font-weight: bold;
							text-overflow: ellipsis;
						}

						> .username {
							max-width: 100%;
							overflow: hidden;
							font-size: 0.9em;
							text-overflow: ellipsis;
						}
					}
				}
			}

			> .body {
				margin-top: 0.7em;
			}
		}
	}
	//#endregion

	// `v-size` のしきい値クラスは、legacy / modern どちらでも同じ `.avatar` に当てる
	&.min-width_350px .avatar {
		margin: 0 0.625rem 0 0;
		width: 2.75rem;
		height: 2.75rem;
	}

	&.min-width_500px .avatar {
		margin: 0 0.75rem 0 0;
		width: 3rem;
		height: 3rem;
	}
}
</style>
