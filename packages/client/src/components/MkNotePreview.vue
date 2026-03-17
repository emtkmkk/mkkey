<template>
	<div v-size="{ min: [350, 500] }" class="fefdfafb">
		<MkAvatar class="avatar" :user="$i" disableLink />
		<div class="main">
			<div class="header">
				<MkUserName :user="$i" />
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
						:author="$i"
						:i="$i"
						:mfm-compat="mfmCompat"
						reaction-menu-enabled
					/>
					<Mfm
						:text="preprocess(text).trim()"
						:author="$i"
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
						<div v-for="reference in referenceIds" :key="reference" class="reference">
							<XNoteSimple v-if="notes[reference]" :note="notes[reference]" />
						</div>
					</MkFolder>
				</div>

			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { preprocess } from "@/scripts/preprocess";
import { shouldEnableMfmCompat } from "@/scripts/mfm-compat";
import { i18n } from "@/i18n";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import MkFolder from "@/components/MkFolder.vue";
import * as os from "@/os";
import type { Note } from "calckey-js/built/entities";

const props = defineProps<{
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
            console.error(`Failed to get note for referenceId ${referenceId}:`, error);
          }
        }
      }
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.fefdfafb {
	display: flex;
	margin: 0;
	padding: 0;
	overflow: clip;
	font-size: 0.95em;

	&.min-width_350px {
		> .avatar {
			margin: 0 0.625rem 0 0;
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	&.min-width_500px {
		> .avatar {
			margin: 0 0.75rem 0 0;
			width: 3rem;
			height: 3rem;
		}
	}

	> .avatar {
		flex-shrink: 0;
		display: block;
		margin: 0 0.625rem 0 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		pointer-events: none;
	}

	> .main {
		flex: 1;
		min-width: 0;

		> .header {
			margin-bottom: 0.125rem;
			font-weight: bold;
		}

		> .body {
			> .cw {
				cursor: default;
				display: block;
				margin: 0;
				padding: 0;
				overflow-wrap: break-word;

				> .text {
					margin-right: 0.5rem;
				}
			}

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
}
</style>
