<template>
	<MkContainer
		:show-header="widgetProps.showHeader"
		:naked="widgetProps.transparent"
	>
		<template #header
			><i class="ph-database ph-bold ph-lg"></i
			>{{ i18n.ts._widgets.dbServerMetric }}</template
		>
		<template #func
			><button class="_button" @click="toggleView()">
				<i class="ph-sort-ascending ph-bold ph-lg"></i></button
		></template>

		<div v-if="meta" class="mkw-dbServerMetric">
			<XCpuMemory
				v-if="widgetProps.view === 0"
				:connection="connection"
				:meta="meta"
			/>
			<XNet
				v-else-if="widgetProps.view === 1"
				:connection="connection"
				:meta="meta"
			/>
			<XCpu
				v-else-if="widgetProps.view === 2"
				:connection="connection"
				:meta="meta"
			/>
			<XMemory
				v-else-if="widgetProps.view === 3"
				:connection="connection"
				:meta="meta"
			/>
			<XDisk
				v-else-if="widgetProps.view === 4"
				:connection="connection"
				:meta="meta"
			/>
			<div v-if="extra" class="extra">
				<span
					>{{ i18n.ts._widgets._dbServerMetric.swap }}:
					{{ bytes(extra.swap.used, 1) }} /
					{{ bytes(extra.swap.total, 1) }}</span
				>
				<span v-if="extra.load"
					>{{ i18n.ts._widgets._dbServerMetric.load }}:
					{{ extra.load["1"].toFixed(2) }}</span
				>
			</div>
		</div>
		<div v-else class="unavailable">
			{{ i18n.ts._widgets._dbServerMetric.unavailable }}
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * DB サーバのメトリクス（CPU・メモリ・ネットワーク・ディスク）を表示するウィジェット。
 *
 * @remarks
 * - 値は `dbServerStats` チャンネルから受け取る。形は `serverStats` と同じなので、
 *   表示部品は {@link ./server-metric/index.vue | サーバーメトリクス} のものをそのまま使う。
 * - グラフの上限値（総メモリなど）は `db-server-info` から取る。
 * - DB サーバ用に増えている swap と load average は、どの表示でも下に 1 行で出す。
 *   DB サーバはメモリ不足で swap が増えることがあるため、常に見えるようにしている。
 * - `db-server-info` が `null`（未設定・まだ取得できていない・取得失敗）のときは「取得できません」と表示する。
 *   その後に統計が届いたら、取得できるようになったとみなして 1 回だけ取り直す（定期的には問い合わせない）。
 * - チャンネルも API もログイン必須。未ログインの画面にはウィジェットが無いので、その場合は考えない。
 *
 * @public
 */
import { onUnmounted, ref } from "vue";
import { useWidgetPropsManager, Widget, WidgetComponentExpose } from "./widget";
import XCpuMemory from "./server-metric/cpu-mem.vue";
import XNet from "./server-metric/net.vue";
import XCpu from "./server-metric/cpu.vue";
import XMemory from "./server-metric/mem.vue";
import XDisk from "./server-metric/disk.vue";
import MkContainer from "@/components/MkContainer.vue";
import { GetFormResultType } from "@/scripts/form";
import bytes from "@/filters/bytes";
import * as os from "@/os";
import { stream } from "@/stream";
import { i18n } from "@/i18n";

const name = "dbServerMetric";

/** 表示の種類の数（cpu-mem / net / cpu / mem / disk） */
const viewCount = 5;

const widgetPropsDef = {
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
	transparent: {
		type: "boolean" as const,
		default: false,
	},
	view: {
		type: "number" as const,
		default: 0,
		hidden: true,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

/** `db-server-info` の応答。`server-info` と同じ形 */
type DbServerInfo = {
	cpu: { model: string; cores: number };
	mem: { total: number };
	fs: { total: number; used: number };
	net: { interface: string | null };
};

/** 統計のうち、DB サーバ用に増えている項目 */
type DbServerExtra = {
	swap: { total: number; used: number };
	load: { "1": number; "5": number; "15": number } | null;
};

const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps): void }>();

const { widgetProps, configure, save } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

const meta = ref<DbServerInfo | null>(null);
const extra = ref<DbServerExtra | null>(null);
/** `db-server-info` の取得中か。統計が続けて届いても問い合わせを重ねないため */
let isFetchingMeta = false;

/** 静的な情報を取得する。失敗しても表示は「取得できません」のまま */
function fetchMeta(): void {
	if (isFetchingMeta) return;
	isFetchingMeta = true;
	os.api("db-server-info", {})
		.then((res) => {
			meta.value = res ?? null;
		})
		.catch(() => {
			meta.value = null;
		})
		.finally(() => {
			isFetchingMeta = false;
		});
}

/** 表示の種類を順に切り替える */
const toggleView = () => {
	widgetProps.view = (widgetProps.view + 1) % viewCount;
	save();
};

const connection = stream.useChannel("dbServerStats");

/** swap と load を反映し、まだ静的な情報が無ければ取り直す */
function onStats(stats: DbServerExtra): void {
	extra.value = { swap: stats.swap, load: stats.load };
	if (meta.value == null) fetchMeta();
}

connection.on("stats", onStats);
fetchMeta();

onUnmounted(() => {
	connection.off("stats", onStats);
	connection.dispose();
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.extra {
	display: flex;
	flex-wrap: wrap;
	gap: 0 1em;
	padding: 6px 12px;
	font-size: 0.85em;
	opacity: 0.8;
	border-top: solid 0.5px var(--divider);
}

.unavailable {
	padding: 16px;
	text-align: center;
	font-size: 0.9em;
	opacity: 0.7;
}
</style>
