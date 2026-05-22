<template>
	<div v-size="{ min: [350, 500] }" class="fefdfafb">
		<div class="main">
			<!-- ヘッダー行: アイコンと表示名（実投稿の header-container と同じ並び） -->
			<div class="header-container">
				<MkAvatar class="avatar" :user="user" disableLink />
				<div class="header">
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
			<!-- 本文は main 全幅＝アイコン左端と揃えて、その下から開始 -->
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
						<template #header>{{ referenceIds?.length + " 件の参照" }}</template>
						<div
							v-for="reference in referenceIds"
							:key="reference"
							class="reference"
						>
							<XNoteSimple v-if="notes[reference]" :note="notes[reference]" />
						</div>
					</MkFolder>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 投稿フォーム内のノート本文プレビュー。
 *
 * @remarks
 * NOTE: 実投稿（{@link MkNote}）と同様、ヘッダーはアイコン横に名前・acct の2行、本文はアイコン直下から始める。
 * NOTE: 表示ユーザーは {@link MkPostForm} から渡す投稿予定アカウント（アカウント切替時は切替先）。
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

	> .main {
		min-width: 0;

		> .header-container {
			display: flex;
			align-items: flex-start;

			> .avatar {
				flex-shrink: 0;
				display: block;
				margin: 0 0.625rem 0 0;
				width: 2.5rem;
				height: 2.5rem;
				border-radius: 0.5rem;
				pointer-events: none;
			}

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
			// 実投稿の .article > .main > .body と同じく、ヘッダー行の下から本文を開始
			margin-top: 0.7em;

			> .content {
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
		}
	}

	&.min-width_350px {
		> .main > .header-container > .avatar {
			margin: 0 0.625rem 0 0;
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	&.min-width_500px {
		> .main > .header-container > .avatar {
			margin: 0 0.75rem 0 0;
			width: 3rem;
			height: 3rem;
		}
	}
}
</style>
