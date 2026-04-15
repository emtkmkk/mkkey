<template>
	<div v-if="text && ($i != null || !forceLocalOnly)" class="ngbfujlo">
		<MkTextarea :model-value="text" readonly style="margin: 0"></MkTextarea>
		<MkButton
			v-if="$i != null"
			class="button"
			primary
			:disabled="posting || posted"
			@click="post()"
		>
			<i v-if="posted" class="ph-check ph-bold ph-lg"></i>
			<i v-else class="ph-paper-plane-tilt ph-bold ph-lg"></i>
		</MkButton>
		<button
			ref="visibilityButton"
			class="_button visibility"
			@click="setVisibility"
			v-if="$i != null"
		>
			<span v-if="visibility === 'public'"
				><i class="ph-planet ph-bold ph-lg"></i
			></span>
			<span v-if="visibility === 'home'"
				><i class="ph-house ph-bold ph-lg"></i
			></span>
			<span v-if="visibility === 'followers'"
				><i class="ph-lock-simple ph-bold ph-lg"></i
			></span>
		</button>
		<span v-if="$i != null && localOnly" class="local-only"
			><i class="ph-hand-heart ph-bold ph-lg"></i
		></span>
		<div class="shareButton" v-if="$i == null">
			<MkButton
				v-if="$i == null"
				class="button"
				primary
				@click="ioShare()"
			>
				<MkEmoji class="emoji" emoji=":io:" style="height: 1.3em" />
			</MkButton>
			<MkButton
				v-if="$i == null"
				class="button"
				primary
				@click="misskeyShare()"
			>
				<MkEmoji
					class="emoji"
					emoji=":misskey:"
					style="height: 1.3em"
				/>
			</MkButton>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, PropType, defineAsyncComponent } from "vue";
import FormInput from "@/components/form/input.vue";
import MkTextarea from "../form/textarea.vue";
import MkButton from "../MkButton.vue";
import { apiUrl } from "@/config";
import { mergeMkkeyApiClientHeaders } from "@/scripts/mkkey-api-client-headers";
import * as os from "@/os";
import { $i } from "@/account";
import { PostBlock } from "@/scripts/hpml/block";
import { Hpml } from "@/scripts/hpml/evaluator";
import { defaultStore } from "@/store";
import { instance } from "@/instance";
import { i18n } from "@/i18n";

export default defineComponent({
	components: {
		MkTextarea,
		MkButton,
		FormInput,
	},
	props: {
		block: {
			type: Object as PropType<PostBlock>,
			required: true,
		},
		hpml: {
			type: Object as PropType<Hpml>,
			required: true,
		},
	},
	data() {
		return {
			text:
				$i == null
					? this.hpml
							.interpolate(this.block.text)
							.replaceAll(/:\w*?_?([a-zA-Z0-9]+):/g, (m, p1) =>
								p1.toUpperCase().includes("STAR") ? p1.toUpperCase() : ""
							)
							.replaceAll("STAR", "☆")
					: this.hpml.interpolate(this.block.text),
			posted: false,
			posting: false,
			localOnly:
				this.block.localOnly ||
				defaultStore.state.pagelocalAndFollower[this.hpml.page.id] ||
				(defaultStore.state.rememberNoteVisibility
					? defaultStore.state.localAndFollower
					: defaultStore.state.defaultNoteLocalAndFollower),
			forceLocalOnly: this.block.localOnly,
			visibility:
				defaultStore.state.pageVisibility[this.hpml.page.id] ||
				(defaultStore.state.rememberNoteVisibility
					? defaultStore.state.visibility
					: defaultStore.state.defaultNoteVisibility),
		};
	},
	watch: {
		"hpml.vars": {
			handler() {
				this.text =
					$i == null
						? this.hpml
								.interpolate(this.block.text)
								.replaceAll(
									/:\w*?_?([a-zA-Z0-9]+):/g,
									(m, p1) => p1.toUpperCase()
								)
								.replaceAll("STAR", "☆")
						: this.hpml.interpolate(this.block.text);
			},
			deep: true,
		},
		text: {
			handler() {
				if (this.posting && this.posted) {
					this.posting = false;
					this.posted = false;
				}
			},
		},
		visibility: {
			handler() {
				if (this.visibility === "specified")
					this.visibility = "followers";
			},
			deep: true,
		},
	},
	methods: {
		upload() {
			const promise = new Promise((ok) => {
				const canvas = this.hpml.canvases[this.block.canvasId];
				canvas.toBlob((blob) => {
					const formData = new FormData();
					formData.append("file", blob);
					if (this.$store.state.uploadFolder) {
						formData.append(
							"folderId",
							this.$store.state.uploadFolder
						);
					}

					fetch(`${apiUrl}/drive/files/create`, {
						method: "POST",
						body: formData,
						headers: mergeMkkeyApiClientHeaders({
							authorization: `Bearer ${this.$i.token}`,
						}),
					})
						.then((response) => response.json())
						.then((f) => {
							ok(f);
						});
				});
			});
			os.promiseDialog(promise);
			return promise;
		},
		async post() {
			this.posting = true;
			const file = this.block.attachCanvasImage
				? await this.upload()
				: null;

			if ($i.isMiniSilenced && this.visibility === "public") {
				const { canceled } = await os.confirm({
					type: "warning",
					text: i18n.ts.miniSilenceWarn,
					okText: "公開で投稿",
					wait: 7,
				});
				if (canceled) return;
			}
			os.apiWithDialog("notes/create", {
				text: this.text === "" ? null : this.text,
				fileIds: file ? [file.id] : undefined,
				visibility: this.visibility,
				localOnly: this.forceLocalOnly || this.localOnly,
			}).then(() => {
				this.posted = true;
			});
		},
		ioShare() {
			if (this.text !== "") {
				window.open(
					"https://misskey.io/share?text=" +
						encodeURIComponent(this.text),
					"_blank"
				);
			}
		},
		misskeyShare() {
			if (this.text !== "") {
				window.open(
					"https://misskeyshare.link/share.html?text=" +
						encodeURIComponent(this.text),
					"_blank"
				);
			}
		},
		setVisibility() {
			os.popup(
				defineAsyncComponent(
					() => import("@/components/MkVisibilityPicker.vue")
				),
				{
					currentVisibility: this.visibility,
					currentLocalOnly: this.localOnly,
					src: this.$refs.visibilityButton,
					canLocalSwitch: false,
					canVisibilitySwitch: true,
					forceMode: false,
					canPublic: !$i.blockPostPublic && !$i.isSilenced && !instance.disableLocalTimeline,
					canHome: !$i.blockPostHome && !$i.isSilenced,
					canFollower: true,
					canNotLocal: !this.forceLocalOnly && !$i.blockPostNotLocal && !$i.isSilenced,
					canDirect: false,
				},
				{
					changeVisibility: (
						v: "public" | "home" | "followers" | "specified"
					) => {
						this.visibility = v;
						defaultStore.set("pageVisibility", {
							...defaultStore.state.pageVisibility,
							[this.hpml.page.id]: v,
						});
					},
					changeLocalOnly: (v) => {
						this.localOnly = v;
						defaultStore.set("pagelocalAndFollower", {
							...defaultStore.state.pagelocalAndFollower,
							[this.hpml.page.id]: v,
						});
					},
				},
				"closed"
			);
		},
	},
});
</script>

<style lang="scss" scoped>
.ngbfujlo {
	position: relative;
	padding: 2rem;
	border-radius: 0.375rem;
	box-shadow: 0 0.125rem 0.5rem var(--shadow);
	z-index: 1;
	text-align: left;

	> .shareButton {
		text-align: left;

		> .button {
			display: inline-block !important;
			margin-top: 2rem;
		}
	}

	> .button {
		display: inline-block !important;
		margin-top: 2rem;
	}
	> .visibility {
		display: inline-block !important;
		height: 2.125rem;
		width: 2.125rem;
		margin: 0 0 0 0.75rem !important;
	}

	@media (max-width: 37.5rem) {
		padding: 1rem;

		> .shareButton {
			text-align: left;

			> .button {
				display: inline-block !important;
				margin-top: 1rem;
			}
		}

		> .button {
			margin-top: 1rem;
		}
	}
}
</style>
