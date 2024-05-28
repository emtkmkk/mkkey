<template>
	<div style="width:100%" :style="{ marginLeft: !isRoot ? '0.625rem' : undefined }">
		<div v-for="(value, key) in data" :key="key" style="width:100%">
			<div
				style="
					display: flex;
					align-items: flex-start;
					flex-flow: column;
					width: 100%
				"
			>
				<div style="display: flex; align-items: center; width: 100%">
					<MkInput
						:style="{ width: '100%' }"
						v-model="localKeys[key]"
						debounce
						@update:modelValue="emitUpdateKey(key, localKeys[key])"
					/>
					<span :style="{ margin: '0.625rem' }">:</span>
				</div>
				<div style="display: flex; align-items: center; width: 100%" v-if="typeof value === 'object' && value !== null">
					<MkKeyValueEditor :data="value" @update="updateProperty(key, $event)" />
					<button
						v-if="Object.keys(value).length <= 0"
						class="_button delete"
						@click="removeObject(key)"
					>
						<i class="ph-bold ph-lg ph-x"></i>
					</button>
				</div>
				<div v-else style="display: flex; align-items: center; width: 100%">
					<MkInput
						:style="{ width: '100%' }"
						v-model="data[key]"
						@update:modelValue="updateProperty(key,data[key])"
					/>
					<span v-if="value && (checkBackground(value) || isColor(value))">
						<MkColorInput
							shape="circle"
							no-style
							class="colorInput"
							v-model="data[key]"
							@update:modelValue="updateProperty(key,data[key])"
						></MkColorInput>
					</span>
					<span v-else-if="value && (getColor(value))">
						<MkColorInput
							format="rgb"
							shape="circle"
							no-style
							class="colorInput"
							:modelValue="getColor(value)?.toRgbString()"
							:disabled="true"
						></MkColorInput>
					</span>
					<button v-if="!value" class="_button add" @click="createObject(key)">
						<i class="ph-plus ph-bold ph-lg"></i>
					</button>
					<button
						v-if="!value"
						class="_button delete"
						@click="removeProperty(key)"
					>
						<i class="ph-bold ph-lg ph-x"></i>
					</button>
				</div>
			</div>
		</div>
		<br />
		<button class="_button add" @click="addProperty">
			<i class="ph-plus ph-bold ph-lg"></i>
		</button>
	</div>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits, reactive, toRefs, watch } from 'vue'
import MkInput from "@/components/form/input.vue";
import MkColorInput from "@/components/MkColorInput.vue";

const props = defineProps<{ data: Record<string, any>, isRoot?: boolean }>()
const emit = defineEmits<{ (e: 'update', value: Record<string, any>): void }>()

const localData = reactive({ ...props.data })
const localKeys = reactive<{ [key: string]: string }>(Object.fromEntries(Object.keys(localData).map(key => [key, key])))

watch(() => props.data, (newData) => {
	Object.assign(localData, newData)
	for (const key in newData) {
		localKeys[key] = key
	}
}, { deep: true })

const updateProperty = (key: string, value: any) => {
	localData[key] = value
	emitUpdate()
}
const emitUpdate = () => {
	const updatedData: Record<string, any> = {}
	for (const key in localData) {
		updatedData[localKeys[key]] = localData[key]
	}
	emit('update', updatedData)
}

const emitUpdateKey = (oldKey: string, newKey: string) => {
	if (oldKey !== newKey) {
		localKeys[newKey] = newKey
		localData[newKey] = localData[oldKey]
		delete localKeys[oldKey]
		delete localData[oldKey]
		emitUpdate()
	}
}

const addProperty = () => {
	const newKey = `newProperty${Object.keys(localData).length + 1}`
	localData[newKey] = ''
	localKeys[newKey] = newKey
	emitUpdate()
}

const createObject = (key: string) => {
	const newKey = `${key}-1`
	localData[key] = {}
	emitUpdate()
}

const removeProperty = (key: string) => {
	delete localData[key]
	delete localKeys[key]
	emitUpdate()
}

const removeObject = (key: string) => {
	localData[key] = ""
	emitUpdate()
}

const isColor = (value: any): boolean => {
  if (typeof value !== 'string') return false
  return /^rgba?\(/.test(value) || /^#([0-9A-F]{3}){1,2}$/i.test(value) || /^#([0-9A-F]{8})$/i.test(value)
}

function checkBackground(value) {
	const element = document.createElement('div');
  element.style.background = '';
  element.style.background = value;
  return element.style.background !== '';
}

function getColor(val: string): tinycolor.Instance | undefined {
		// ref (prop)
		if (val[0] === "@") {
			return getColor(localData[val.substr(1)]);
		}

		// ref (const)
		if (val[0] === "$") {
			return getColor(localData[val]);
		}

		// func
		try {
			if (val[0] === ":") {
				const parts = val.split("<");
				const func = parts.shift().substr(1);
				const arg = Number.parseFloat(parts.shift());
				const color = getColor(parts.join("<"));

				switch (func) {
					case "darken":
						return color?.darken(arg);
					case "lighten":
						return color?.lighten(arg);
					case "alpha":
						return color?.setAlpha(arg);
					case "hue":
						return color?.spin(arg);
					case "saturate":
						return color?.saturate(arg);
				}
			}
		} catch {
		}

		// other case
		return undefined;
	}
</script>

<style scoped>
label {
	font-weight: bold;
	margin-right: 0.625rem;
}

button {
	margin-left: 0.3125rem;
}

.colorInput {
	height: 100%;
	aspect-ratio: 1 / 1;
}

.add .delete {
	height: 100%;
	aspect-ratio: 1 / 1;
	padding: 0.3125rem;
}
</style>
