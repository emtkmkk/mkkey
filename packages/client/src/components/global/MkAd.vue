<template>
	<div
		v-if="chosen && chosen.length > 0 && defaultStore.state.showAds"
		v-for="chosenItem in chosen"
		class="qiivuoyo"
	>
		<div v-if="!showMenu" class="main" :class="chosenItem.place">
			<a :href="chosenItem.url" target="_blank">
				<img :src="chosenItem.imageUrl" />
			</a>
		</div>
	</div>
	<div v-else-if="chosen && defaultStore.state.showAds" class="qiivuoyo">
		<div v-if="!showMenu" class="main" :class="chosen.place">
			<a :href="chosen.url" target="_blank">
				<img :src="chosen.imageUrl" />
				<button class="_button menu" @click.prevent.stop="toggleMenu">
					<span class="ph-info ph-bold ph-lg info-circle"></span>
				</button>
			</a>
		</div>
		<div v-else class="menu">
			<div class="body">
				<div>Ads by {{ host }}</div>
				<!--<MkButton class="button" primary>{{ i18n.ts._ad.like }}</MkButton>-->
				<MkButton
					v-if="chosen.ratio !== 0"
					class="button"
					@click="reduceFrequency"
					>{{ i18n.ts._ad.reduceFrequencyOfThisAd }}</MkButton
				>
				<button class="_textButton" @click="toggleMenu">
					{{ i18n.ts._ad.back }}
				</button>
			</div>
		</div>
	</div>
	<div v-else></div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { instance } from "@/instance";
import { host } from "@/config";
import MkButton from "@/components/MkButton.vue";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { i18n } from "@/i18n";

type Ad = (typeof instance)["ads"][number];

const props = defineProps<{
	prefer: string[];
	specify?: Ad;
}>();

const showMenu = ref(false);
const toggleMenu = (): void => {
	showMenu.value = !showMenu.value;
};

const choseAd = (): Ad | null => {
	if (props.specify) {
		return props.specify;
	}

	const allAds = instance.ads.map((ad) =>
		defaultStore.state.mutedAds.includes(ad.id)
			? {
					...ad,
					ratio: 0,
			  }
			: ad
	);

	let ads = allAds.filter((ad) => props.prefer.includes(ad.place));

	if (ads.length === 0) {
		ads = allAds.filter((ad) => ad.place === "square");
	}

	const lowPriorityAds = ads.filter((ad) => ad.ratio === 0);
	const widgetAds = ads.filter((ad) => ad.place === "widget");
	ads = ads.filter((ad) => ad.ratio !== 0);

	if (widgetAds.length !== 0) {
		return widgetAds;
	} else if (ads.length === 0) {
		if (lowPriorityAds.length !== 0) {
			return lowPriorityAds[
				Math.floor(Math.random() * lowPriorityAds.length)
			];
		} else {
			return null;
		}
	}

	const totalFactor = ads.reduce((a, b) => a + b.ratio, 0);
	const r = Math.random() * totalFactor;

	let stackedFactor = 0;
	for (const ad of ads) {
		if (r >= stackedFactor && r <= stackedFactor + ad.ratio) {
			return ad;
		} else {
			stackedFactor += ad.ratio;
		}
	}

	return null;
};

const chosen = ref(choseAd());

function reduceFrequency(): void {
	if (chosen.value == null) return;
	if (defaultStore.state.mutedAds.includes(chosen.value.id)) return;
	defaultStore.push("mutedAds", chosen.value.id);
	os.success();
	chosen.value = choseAd();
	showMenu.value = false;
}
</script>

<style lang="scss" scoped>
.qiivuoyo {
	background-size: auto auto;
	background-image: repeating-linear-gradient(
		45deg,
		transparent,
		transparent 0.5rem,
		var(--ad) 0.5rem,
		var(--ad) 0.875rem
	);

	> .main {
		text-align: center;

		> a {
			display: inline-block;
			position: relative;
			vertical-align: bottom;

			&:hover {
				> img {
					filter: contrast(120%);
				}
			}

			> img {
				display: block;
				object-fit: contain;
				margin: auto;
				border-radius: 0.3125rem;
			}

			> .menu {
				position: absolute;
				top: 0.0625rem;
				right: 0.0625rem;

				> .info-circle {
					border: 0.1875rem solid var(--panel);
					border-radius: 50%;
					background: var(--panel);
				}
			}
		}

		&.widget {
			> a,
			> a > img {
				max-width: min(18.75rem, 100%);
				max-height: 18.75rem;
			}
		}

		&.inline {
			padding: 0.5rem;

			> a,
			> a > img {
				max-width: min(37.5rem, 100%);
				max-height: 5rem;
			}
		}

		&.inline-big {
			padding: 0.5rem;

			> a,
			> a > img {
				max-width: min(37.5rem, 100%);
				max-height: 15.625rem;
			}
		}

		&.vertical {
			> a,
			> a > img {
				max-width: min(6.25rem, 100%);
			}
		}
	}

	> .menu {
		padding: 0.5rem;
		text-align: center;

		> .body {
			padding: 0.5rem;
			margin: 0 auto;
			max-width: 25rem;
			border: solid 0.0625rem var(--divider);

			> .button {
				margin: 0.5rem auto;
			}
		}
	}
}
</style>
