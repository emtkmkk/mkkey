<template>
	<div class="mk-plugin-config-form _formRoot">
		<template
			v-for="key in visibleKeys"
			:key="key"
		>
			<FormInput
				v-if="form[key].type === 'number'"
				:model-value="modelValue[key]"
				type="number"
				:step="form[key].step || 1"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<template v-if="form[key].description" #caption>
					{{ form[key].description }}
				</template>
			</FormInput>

			<FormInput
				v-else-if="form[key].type === 'string' && !form[key].multiline"
				:model-value="modelValue[key]"
				type="text"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<template v-if="form[key].description" #caption>
					{{ form[key].description }}
				</template>
			</FormInput>

			<FormTextarea
				v-else-if="form[key].type === 'string' && form[key].multiline"
				:model-value="modelValue[key]"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<template v-if="form[key].description" #caption>
					{{ form[key].description }}
				</template>
			</FormTextarea>

			<FormSwitch
				v-else-if="form[key].type === 'boolean'"
				:model-value="modelValue[key]"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<span v-text="form[key].label || key"></span>
				<template v-if="form[key].description" #caption>
					{{ form[key].description }}
				</template>
			</FormSwitch>

			<FormSelect
				v-else-if="form[key].type === 'enum'"
				:model-value="modelValue[key]"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<option
					v-for="item in form[key].enum"
					:key="item.value"
					:value="item.value"
				>
					{{ item.label }}
				</option>
			</FormSelect>

			<FormRadios
				v-else-if="form[key].type === 'radio'"
				:model-value="modelValue[key]"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<option
					v-for="item in form[key].options"
					:key="item.value"
					:value="item.value"
				>
					{{ item.label }}
				</option>
			</FormRadios>

			<FormRange
				v-else-if="form[key].type === 'range'"
				:model-value="modelValue[key]"
				:min="form[key].min"
				:max="form[key].max"
				:step="form[key].step"
				:text-converter="form[key].textConverter"
				class="_formBlock"
				@update:model-value="update(key, $event)"
			>
				<template #label>
					<span v-text="form[key].label || key"></span>
					<span v-if="form[key].required === false">
						({{ i18n.ts.optional }})
					</span>
				</template>
				<template v-if="form[key].description" #caption>
					{{ form[key].description }}
				</template>
			</FormRange>

			<MkButton
				v-else-if="form[key].type === 'button'"
				class="_formBlock"
				@click="form[key].action($event, modelValue)"
			>
				<span v-text="form[key].content || key"></span>
			</MkButton>
		</template>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * プラグイン設定（config メタデータ）のインライン編集フォーム。
 *
 * @remarks
 * {@link MkFormDialog} と同じフィールド型をサポートし、管理画面カード内に埋め込む。
 *
 * @public
 */
import { computed } from "vue";
import FormInput from "@/components/form/input.vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import FormRange from "@/components/form/range.vue";
import FormRadios from "@/components/form/radios.vue";
import MkButton from "@/components/MkButton.vue";
import { i18n } from "@/i18n";

const props = defineProps<{
	form: Record<string, Record<string, unknown>>;
	modelValue: Record<string, unknown>;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: Record<string, unknown>];
}>();

const visibleKeys = computed(() =>
	Object.keys(props.form).filter((key) => !props.form[key].hidden),
);

function update(key: string, value: unknown): void {
	emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>
