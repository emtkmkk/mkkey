<template>
	<XModalWindow
		ref="dialog"
		:width="800"
		@close="dialog?.close()"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts._tutorial.title }}</template>

		<div class="_monolithic_">
			<div class="_section">
				<div class="tbkwesmv">
					<div class="_footer navigation">
						<div class="step">
							<button
								class="arrow _button"
								:disabled="tutorial === 0"
								@click="tutorial--"
							>
								<i class="ph-caret-left ph-bold ph-lg"></i>
							</button>
							<span>{{ tutorial + 1 }} / 7</span>
							<button
								class="arrow _button"
								:disabled="tutorial === 6"
								@click="tutorial++"
							>
								<i class="ph-caret-right ph-bold ph-lg"></i>
							</button>
						</div>
						<MkButton
							v-if="tutorial === 6 || tutorial === -1"
							class="ok"
							primary
							@click="close"
							><i class="ph-check ph-bold ph-lg"></i>
							{{ i18n.ts.gotIt }}</MkButton
						>
						<MkButton v-else class="ok" primary @click="tutorial++"
							><i class="ph-check ph-bold ph-lg"></i>
							{{ i18n.ts.next }}</MkButton
						>
					</div>
					<Transition name="fade">
						<section
							v-if="tutorial === -1"
							key="0"
							class="_content"
						>
							<h2 class="_title title">
								すみません、すでにチュートリアルは完了しているようです!
							</h2>
							<h3>
								{{
									`${i18n.ts.gotIt}を押下してダイアログを閉じてください。`
								}}
							</h3>
						</section>
						<section v-if="tutorial === 0" key="1" class="_content">
							<h2 class="_title title">
								<i class="ph-info ph-bold ph-lg"></i>
								{{ i18n.ts._tutorial.title }}
							</h2>
							<h3>{{ i18n.ts._tutorial.step1_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step1_2 }}</div>
							<!-- TODO: move to new slide -->
							<!-- <FormSwitch v-model="autoplayMfm" class="_formBlock">
								{{ i18n.ts._mfm.alwaysPlay }}
								<template #caption>
									<i class="ph-warning ph-bold ph-lg" style="color: var(--warn)"></i>
									{{ i18n.ts._mfm.warn }}
								</template>
							</FormSwitch> -->
							<FormSwitch
								v-model="reduceAnimation"
								class="_formBlock"
							>
								{{ i18n.ts.reduceUiAnimation }}
							</FormSwitch>
						</section>
						<section
							v-else-if="tutorial === 1"
							key="2"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step2_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step2_2 }}</div>
							<br />
							<XSettings :save-button="true" />
							<br />
						</section>
						<section
							v-else-if="tutorial === 2"
							key="3"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step3_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step3_2 }}</div>
							<XFeaturedUsers />
							<br />
							<MkButton class="ok" primary @click="tutorial++"
								><i class="ph-check ph-bold ph-lg"></i>
								{{ i18n.ts.next }}</MkButton
							>
						</section>
						<section
							v-else-if="tutorial === 3"
							key="4"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step4_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step4_2 }}</div>
							<br />
							<XPostForm class="post-form _block" />
						</section>
						<section
							v-else-if="tutorial === 4"
							key="5"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step5_1 }}</h3>
							<I18n :src="i18n.ts._tutorial.step5_2" tag="div">
								<template #timelines>
									<span>{{ timelines.length }}</span>
								</template>
							</I18n>
							<ul>
								<li>
									<I18n
										:src="i18n.ts._tutorial.step5_3"
										tag="div"
									>
										<template #icon>
											<i class="ph-house ph-bold ph-lg" />
										</template>
									</I18n>
								</li>
								<li v-if="timelines.includes('local')">
									<I18n
										:src="i18n.ts._tutorial.step5_4"
										tag="div"
									>
										<template #icon>
											<i class="ph-users ph-bold ph-lg" />
										</template>
									</I18n>
								</li>
								<li v-if="timelines.includes('recommended')">
									<I18n
										:src="i18n.ts._tutorial.step5_5"
										tag="div"
									>
										<template #icon>
											<i
												class="ph-thumbs-up ph-bold ph-lg"
											/>
										</template>
									</I18n>
								</li>
								<li v-if="timelines.includes('global')">
									<I18n
										:src="i18n.ts._tutorial.step5_6"
										tag="div"
									>
										<template #icon>
											<i
												class="ph-planet ph-bold ph-lg"
											/>
										</template>
									</I18n>
								</li>
							</ul>
						</section>
						<section
							v-else-if="tutorial === 5"
							key="6"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step6_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step6_2 }}</div>
							<div>{{ i18n.ts._tutorial.step6_3 }}</div>
						</section>
						<section
							v-else-if="tutorial === 6"
							key="7"
							class="_content"
						>
							<h3>{{ i18n.ts._tutorial.step7_1 }}</h3>
							<div>{{ i18n.ts._tutorial.step7_2 }}</div>
							<pwa-install />
							<MkButton
								primary
								rounded
								inline
								@click="installPwa"
								>{{ i18n.ts._apps.pwa }}</MkButton
							>
							<div>{{ i18n.ts._tutorial.step7_3 }}</div>
							<MkPushNotificationAllowButton
								primary
								show-only-to-register
							/>
							<div>{{ i18n.ts._tutorial.step7_4 }}</div>
							<br />
							<MkSparkle>
								<h3>
									{{ i18n.ts._tutorial.step7_5 }}
									<Mfm text="$[shake 🚀]"></Mfm>
								</h3>
							</MkSparkle>
						</section>
					</Transition>
				</div>
			</div>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
import { reactive, computed } from "vue";
import XSettings from "@/pages/settings/profile.vue";
import XModalWindow from "@/components/MkModalWindow.vue";
import MkButton from "@/components/MkButton.vue";
import XFeaturedUsers from "@/pages/explore.users.vue";
import XPostForm from "@/components/MkPostForm.vue";
import MkSparkle from "@/components/MkSparkle.vue";
import MkPushNotificationAllowButton from "@/components/MkPushNotificationAllowButton.vue";
import FormSwitch from "@/components/form/switch.vue";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { instance } from "@/instance";
import "@khmyznikov/pwa-install";

const isLocalTimelineAvailable =
	!instance.disableLocalTimeline ||
	($i != null && ($i.isModerator || $i.isAdmin));
const isRecommendedTimelineAvailable =
	!instance.disableRecommendedTimeline ||
	($i != null && ($i.isModerator || $i.isAdmin));
const isGlobalTimelineAvailable =
	!instance.disableGlobalTimeline ||
	($i != null && ($i.isModerator || $i.isAdmin));

let timelines = ["home"];

if (isLocalTimelineAvailable) {
	timelines.push("local");
}
if (isRecommendedTimelineAvailable) {
	timelines.push("recommended");
}
if (isGlobalTimelineAvailable) {
	timelines.push("global");
}

const emit = defineEmits<{
	(ev: "done"): void;
	(ev: "closed"): void;
}>();

const dialog = $ref<InstanceType<typeof XModalWindow>>();

const tutorial = computed({
	get() {
		return defaultStore.reactiveState.tutorial.value || 0;
	},
	set(value) {
		defaultStore.set("tutorial", value);
	},
});

const autoplayMfm = computed(
	defaultStore.makeGetterSetter(
		"animatedMfm",
		(v) => !v,
		(v) => !v
	)
);
const reduceAnimation = computed(
	defaultStore.makeGetterSetter(
		"animation",
		(v) => !v,
		(v) => !v
	)
);

function close(res) {
	tutorial.value = -1;
	dialog.close();
}

function installPwa(ev: MouseEvent) {
	const pwaInstall = document.getElementsByTagName("pwa-install")[0];
	pwaInstall.showDialog();
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.tbkwesmv {
	> ._content {
		> small {
			opacity: 0.7;
		}
	}

	> .navigation {
		display: flex;
		flex-direction: row;
		align-items: baseline;

		> .step {
			> .arrow {
				padding: 0.25rem;

				&:disabled {
					opacity: 0.5;
				}

				&:first-child {
					padding-right: 0.5rem;
				}

				&:last-child {
					padding-left: 0.5rem;
				}
			}

			> span {
				margin: 0 0.25rem;
			}
		}

		> .ok {
			margin-left: auto;
		}
	}
}
</style>
