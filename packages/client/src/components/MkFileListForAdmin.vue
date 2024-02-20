<template>
	<div>
		<MkPagination
			v-slot="{ items }"
			:pagination="pagination"
			class="urempief"
			:class="{ grid: viewMode === 'grid' }"
		>
			<MkA
				v-for="file in items"
				:key="file.id"
				v-tooltip.mfm="
					`${file.type}\n${bytes(file.size)}\n${new Date(
						file.createdAt
					).toLocaleString()}\nby ${
						file.user ? '@' + Acct.toString(file.user) : 'system'
					}`
				"
				:to="`/admin/file/${file.id}`"
				class="file _button"
			>
				<div v-if="file.isSensitive" class="sensitive-label">
					{{ i18n.ts.sensitive }}
				</div>
				<MkDriveFileThumbnail
					class="thumbnail"
					:file="file"
					fit="contain"
				/>
				<div v-if="viewMode === 'list'" class="body">
					<div>
						<small style="opacity: 0.7">{{ file.name }}</small>
					</div>
					<div>
						<MkAcct v-if="file.user" :user="file.user" />
						<div v-else>{{ i18n.ts.system }}</div>
					</div>
					<div>
						<span style="margin-right: 1em">{{ file.type }}</span>
						<span>{{ bytes(file.size) }}</span>
					</div>
					<div>
						<span
							>{{ i18n.ts.registeredDate }}:
							<MkTime :time="file.createdAt" mode="detail"
						/></span>
					</div>
				</div>
			</MkA>
		</MkPagination>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import * as Acct from "calckey-js/built/acct";
import MkSwitch from "@/components/ui/switch.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkDriveFileThumbnail from "@/components/MkDriveFileThumbnail.vue";
import bytes from "@/filters/bytes";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = defineProps<{
	pagination: any;
	viewMode: "grid" | "list";
}>();
</script>

<style lang="scss" scoped>
@keyframes sensitive-blink {
	0% {
		opacity: 1;
	}
	50% {
		opacity: 0;
	}
}

.urempief {
	margin-top: var(--margin);

	&.list {
		> .file {
			display: flex;
			width: 100%;
			box-sizing: border-box;
			text-align: left;
			align-items: center;

			&:hover {
				color: var(--accent);
			}

			> .thumbnail {
				width: 8rem;
				height: 8rem;
			}

			> .body {
				margin-left: 0.3em;
				padding: 0.5rem;
				flex: 1;

				@media (max-width: 31.25rem) {
					font-size: 0.875rem;
				}
			}
		}
	}

	&.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.125rem, 1fr));
		grid-gap: 0.75rem;
		margin: var(--margin) 0;

		> .file {
			position: relative;
			aspect-ratio: 1;

			> .thumbnail {
				width: 100%;
				height: 100%;
			}

			> .sensitive-label {
				position: absolute;
				z-index: 10;
				top: 0.5rem;
				left: 0.5rem;
				padding: 0.125rem 0.25rem;
				background: #ff0000bf;
				color: #fff;
				border-radius: 0.25rem;
				font-size: 85%;
				animation: sensitive-blink 1s infinite;
			}
		}
	}
}
</style>
