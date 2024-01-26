<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
		/></template>
		<MkSpacer :content-max="800" :marginMin="6">
			<div class="fcuexfpr">
				<transition
					:name="$store.state.animation ? 'fade' : ''"
					mode="out-in"
				>
					<div v-if="note" class="note">
						<div v-if="showNext" class="_gap">
							<XNotes
								class="_content"
								key="nextUserNote"
								:pagination="nextPagination"
								:no-gap="true"
								:silence-no-notes="true"
							/>
						</div>

						<div class="main _gap">
							<div v-if="!showNext" class="load next">
								<MkButton
									v-if="!note.channelId && ($i || !note.user.host)"
									class="load loadbutton"
									@click="showNext = 'local'"
									>LTL <i class="ph-caret-up ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-if="note.channelId"
									class="load loadbutton"
									@click="showNext = 'channel'"
									><i class="ph-television ph-bold ph-lg"></i> <i class="ph-caret-up ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-if="(note.channelId || $i || !note.user.host)"
									class="load loadbutton"
									@click="showNext = 'user'"
									><i class="ph-user ph-bold ph-lg"></i> <i class="ph-caret-up ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-else
									class="load loadbutton"
									@click="showNext = 'user'"
									><i class="ph-caret-up ph-bold ph-lg"></i
								></MkButton>
							</div>
							<div class="note _gap">
								<MkRemoteCaution
									v-if="note.user.host != null"
									:href="note.url ?? note.uri"
								/>
								<XNoteDetailed
									:key="note.id"
									v-model:note="note"
									class="note"
								/>
							</div>
							<div
								v-if="clips && clips.length > 0"
								class="_content clips _gap"
							>
								<div class="title">{{ i18n.ts.clip }}</div>
								<MkA
									v-for="item in clips"
									:key="item.id"
									:to="`/clips/${item.id}`"
									class="item _panel _gap"
								>
									<b>{{ item.name }}</b>
									<div
										v-if="item.description"
										class="description"
									>
										{{ item.description }}
									</div>
									<div class="user">
										<MkAvatar
											:user="item.user"
											class="avatar"
											:show-indicator="true"
										/>
										<MkUserName
											:user="item.user"
											:nowrap="false"
										/>
									</div>
								</MkA>
							</div>
							<div v-if="!showPrev" class="load prev">
								<MkButton
									v-if="!note.channelId && ($i || !note.user.host)"
									class="load loadbutton"
									@click="showPrev = 'local'"
									>LTL <i class="ph-caret-down ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-if="note.channelId"
									class="load loadbutton"
									@click="showPrev = 'channel'"
									><i class="ph-television ph-bold ph-lg"></i> <i class="ph-caret-down ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-if="(note.channelId || $i || !note.user.host)"
									class="load loadbutton"
									@click="showNext = 'user'"
									><i class="ph-user ph-bold ph-lg"></i> <i class="ph-caret-down ph-bold ph-lg"></i
								></MkButton>
								<MkButton
									v-else
									class="load loadbutton"
									@click="showNext = 'user'"
									><i class="ph-caret-down ph-bold ph-lg"></i
								></MkButton>
							</div>
						</div>

						<div v-if="showPrev" class="_gap">
							<XNotes
								class="_content"
								key="prevUserNote"
								:pagination="prevPagination"
								:no-gap="true"
								:silence-no-notes="true"
							/>
						</div>
					</div>
					<MkError v-else-if="error" @retry="fetch()" />
					<MkLoading v-else />
				</transition>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, defineComponent, watch } from "vue";
import * as misskey from "calckey-js";
import XNote from "@/components/MkNote.vue";
import XNoteDetailed from "@/components/MkNoteDetailed.vue";
import XNotes from "@/components/MkNotes.vue";
import MkRemoteCaution from "@/components/MkRemoteCaution.vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { defaultStore } from "@/store";

const props = defineProps<{
	noteId: string;
}>();

let note = $ref<null | misskey.entities.Note>();
let clips = $ref();
let showPrev = $ref<"user" | "local" | "channel" | true | false>(false);
let showNext = $ref<"user" | "local" | "channel" | true | false>(false);
let error = $ref();

const prevPagination = {
	endpoint: computed(() => {
		switch (showPrev){
			case "user":
			default:
				return "users/notes";
			case "local":
				return "notes/local-timeline";
			case "channel":
				return "channels/timeline";
		}
	}),
	limit: 10,
	params: computed(() =>
		note
			? {
					...(showPrev === "local" && note.user.host ? {host: note.user.host, withBelowPublic: defaultStore.state.showLocalTimelineBelowPublic,} : showPrev === "local" ? {withBelowPublic: defaultStore.state.showLocalTimelineBelowPublic,} : showPrev === "channel" ? {channelId: note.channelId} : {userId: note.userId}),
					untilId: note.id,
			  }
			: null
	),
};

const nextPagination = {
	reversed: true,
	endpoint: computed(() => {
		switch (showNext){
			case "user":
			default:
				return "users/notes";
			case "local":
				return "notes/local-timeline";
			case "channel":
				return "channels/timeline";
		}
	}),
	limit: 10,
	params: computed(() =>
		note
			? {
				...(showNext === "local" && note.user.host ? {host: note.user.host, withBelowPublic: defaultStore.state.showLocalTimelineBelowPublic,} : showNext === "local" ? {withBelowPublic: defaultStore.state.showLocalTimelineBelowPublic,} : showNext === "channel" ? {channelId: note.channelId} : {userId: note.userId}),
					sinceId: note.id,
			  }
			: null
	),
};

function fetchNote() {
	showPrev = false;
	showNext = false;
	note = null;
	os.api("notes/show", {
		noteId: props.noteId,
	})
		.then((res) => {
			note = res;
			Promise.all([
				os.api("notes/clips", {
					noteId: note.id,
				}),
			]).then(([_clips, prev, next]) => {
				clips = _clips;
			});
		})
		.catch((err) => {
			error = err;
		});
}

watch(() => props.noteId, fetchNote, {
	immediate: true,
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		note
			? {
					title: i18n.ts.note,
					subtitle: new Date(note.createdAt).toLocaleString(),
					avatar: note.user,
					path: `/notes/${note.id}`,
					share: {
						title: i18n.t("noteOf", { user: note.user.name }),
						text: note.text,
					},
			  }
			: null
	)
);
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.fcuexfpr {
	#calckey_app > :not(.wallpaper) & {
		background: var(--bg);
	}

	> .note {
		> .main {
			> .load {
				display: flex;
				justify-content: center;

				&.next {
					margin-bottom: var(--margin);
				}

				&.prev {
					margin-top: var(--margin);
				}

				> .loadbutton {
					min-width: 0;
					border-radius: 999px;
				}
			}

			> .note {
				> .note {
					border-radius: var(--radius);
					background: var(--panel);
				}
			}

			> .clips {
				> .title {
					font-weight: bold;
					padding: 12px;
				}

				> .item {
					display: block;
					padding: 16px;

					> .description {
						padding: 8px 0;
					}

					> .user {
						$height: 32px;
						padding-top: 16px;
						border-top: solid 0.5px var(--divider);
						line-height: $height;

						> .avatar {
							width: $height;
							height: $height;
						}
					}
				}
			}
		}
	}
}
</style>
