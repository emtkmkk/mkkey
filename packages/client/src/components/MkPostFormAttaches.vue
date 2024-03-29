<template>
	<div v-show="files.length != 0" class="skeikyzd">
		<XDraggable
			v-model="_files"
			class="files"
			item-key="id"
			animation="150"
			delay="100"
			delay-on-touch-only="true"
		>
			<template #item="{ element }">
				<div
					class="file"
					@click="showFileMenu(element, $event)"
					@contextmenu.prevent="showFileMenu(element, $event)"
				>
					<MkDriveFileThumbnail
						:data-id="element.id"
						class="thumbnail"
						:file="element"
						fit="cover"
					/>
					<div v-if="element.isSensitive" class="sensitive">
						<i class="ph-warning ph-bold ph-lg icon"></i>
					</div>
				</div>
			</template>
		</XDraggable>
		<p class="remain">{{ 16 - files.length }}/16</p>
	</div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from "vue";
import MkDriveFileThumbnail from "@/components/MkDriveFileThumbnail.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

export default defineComponent({
	components: {
		XDraggable: defineAsyncComponent(() =>
			import("vuedraggable").then((x) => x.default)
		),
		MkDriveFileThumbnail,
	},

	props: {
		files: {
			type: Array,
			required: true,
		},
		detachMediaFn: {
			type: Function,
			required: false,
		},
	},

	emits: ["updated", "detach", "changeSensitive", "changeName"],

	data() {
		return {
			menu: null as Promise<null> | null,
			i18n,
		};
	},

	computed: {
		_files: {
			get() {
				return this.files;
			},
			set(value) {
				this.$emit("updated", value);
			},
		},
	},

	methods: {
		detachMedia(id) {
			if (this.detachMediaFn) {
				this.detachMediaFn(id);
			} else {
				this.$emit("detach", id);
			}
		},
		toggleSensitive(file) {
			os.api("drive/files/update", {
				fileId: file.id,
				isSensitive: !file.isSensitive,
			}).then(() => {
				this.$emit("changeSensitive", file, !file.isSensitive);
			});
		},
		async rename(file) {
			const { canceled, result } = await os.inputText({
				title: i18n.ts.enterFileName,
				default: file.name,
				allowEmpty: false,
			});
			if (canceled) return;
			os.api("drive/files/update", {
				fileId: file.id,
				name: result,
			}).then(() => {
				this.$emit("changeName", file, result);
				file.name = result;
			});
		},

		async describe(file) {
			os.popup(
				defineAsyncComponent(
					() => import("@/components/MkMediaCaption.vue")
				),
				{
					title: i18n.ts.describeFile,
					input: {
						placeholder: i18n.ts.inputNewDescription,
						default: file.comment !== null ? file.comment : "",
					},
					image: file,
				},
				{
					done: (result) => {
						if (!result || result.canceled) return;
						let comment =
							result.result.length === 0 ? null : result.result;
						os.api("drive/files/update", {
							fileId: file.id,
							comment: comment,
						}).then(() => {
							file.comment = comment;
						});
					},
				},
				"closed"
			);
		},

		showFileMenu(file, ev: MouseEvent) {
			if (this.menu) return;
			this.menu = os
				.popupMenu(
					[
						{
							text: i18n.ts.describeFile,
							icon: "ph-subtitles ph-bold ph-lg",
							action: () => {
								this.describe(file);
							},
						},
						{
							text: file.isSensitive
								? i18n.ts.unmarkAsSensitive
								: i18n.ts.markAsSensitive,
							icon: file.isSensitive
								? "ph-eye ph-bold ph-lg"
								: "ph-eye-slash ph-bold ph-lg",
							action: () => {
								this.toggleSensitive(file);
							},
						},
						/*{
							text: i18n.ts.renameFile,
							icon: "ph-cursor-text ph-bold ph-lg",
							action: () => {
								this.rename(file);
							},
						},*/
						{
							text: i18n.ts.attachCancel,
							icon: "ph-x ph-bold ph-lg",
							action: () => {
								this.detachMedia(file.id);
							},
						},
					],
					ev.currentTarget ?? ev.target
				)
				.then(() => (this.menu = null));
		},
	},
});
</script>

<style lang="scss" scoped>
.skeikyzd {
	padding: 0.5rem 1rem;
	position: relative;

	> .files {
		display: flex;
		flex-wrap: wrap;

		> .file {
			position: relative;
			width: 4rem;
			height: 4rem;
			margin-right: 0.25rem;
			border-radius: 0.25rem;
			cursor: move;

			&:hover > .remove {
				display: block;
			}

			> .thumbnail {
				width: 100%;
				height: 100%;
				z-index: 1;
				color: var(--fg);
			}

			> .sensitive {
				display: flex;
				position: absolute;
				width: 4rem;
				height: 4rem;
				top: 0;
				left: 0;
				z-index: 2;
				background: rgba(17, 17, 17, 0.7);
				color: #fff;

				> .icon {
					margin: auto;
				}
			}
		}
	}

	> .remain {
		display: block;
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		margin: 0;
		padding: 0;
	}
}
</style>
