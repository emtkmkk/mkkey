<template>
	<div class="ngbfujlo">
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
		<div 
			class="shareButton"
			v-if="$i == null"
		>
			<MkButton
				v-if="$i == null"
				class="button"
				primary
				@click="ioShare()"
			>
				<MkEmoji
					class="emoji"
					emoji=":io:"
					style="height: 1.3em"
				/>
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
import { defineComponent, PropType } from "vue";
import FormInput from "@/components/form/input.vue";
import MkTextarea from "../form/textarea.vue";
import MkButton from "../MkButton.vue";
import { apiUrl } from "@/config";
import * as os from "@/os";
import { $i } from "@/account";
import { PostBlock } from "@/scripts/hpml/block";
import { Hpml } from "@/scripts/hpml/evaluator";

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
			text: $i == null ? this.hpml.interpolate(this.block.text).replaceAll(/:\w*?_?([a-zA-Z0-9]+):/g, ((m,p1) => p1.toUpperCase())).replaceAll("STAR","☆") : this.hpml.interpolate(this.block.text),
			posted: false,
			posting: false,
		};
	},
	watch: {
		"hpml.vars": {
			handler() {
				this.text = $i == null ? this.hpml.interpolate(this.block.text).replaceAll(/:\w*?_?([a-zA-Z0-9]+):/g, ((m,p1) => p1.toUpperCase())).replaceAll("STAR","☆") : this.hpml.interpolate(this.block.text);
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
						headers: {
							authorization: `Bearer ${this.$i.token}`,
						},
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
			os.apiWithDialog("notes/create", {
				text: this.text === "" ? null : this.text,
				fileIds: file ? [file.id] : undefined,
			}).then(() => {
				this.posted = true;
			});
		},
		ioShare() {
			if (this.text !== "") {
				window.open('https://misskey.io/share?text=' + encodeURIComponent(this.text), '_blank');
			}
		},
		misskeyShare() {
			if (this.text !== "") {
				window.open('https://misskeyshare.link/share.html?text=' + encodeURIComponent(this.text), '_blank');
			}
		},
	},
});
</script>

<style lang="scss" scoped>
.ngbfujlo {
	position: relative;
	padding: 32px;
	border-radius: 6px;
	box-shadow: 0 2px 8px var(--shadow);
	z-index: 1;
	
	> .shareButton {
		text-align: left;
		
		> .button {
			display: inline-block !important;
			margin-top: 32px;
		}
	}
	
	> .button {
		margin-top: 32px;
	}

	@media (max-width: 600px) {
		padding: 16px;
		
		> .shareButton {
			text-align: left;
			
			> .button {
				display: inline-block !important;
				margin-top: 16px;
			}
		}
		
		> .button {
			margin-top: 16px;
		}
	}
}
</style>
