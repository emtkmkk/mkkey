<template>
	<div>
		<div v-for="(value, key) in data" :key="key" style="margin-left: 20px;">
			<div style="display: flex; align-items: center;">
				<MkInput inline v-model="localKeys[key]" @update:modelValue="emitUpdateKey(key, localKeys[key])" />
				<span>:</span>
				<div v-if="typeof value === 'object' && value !== null">
					<JSONEditor :data="value" @update="updateProperty(key, $event)" />
				</div>
				<template v-else>
					<MkInput inline v-model="data[key]" @update:modelValue="emitUpdate" />
					<span v-if="isColor(value)" style="margin-left: 5px;">
						<ColorPicker :color="value" @change="updateColor(key, $event)" />
					</span>
				</template>
				<button v-if="!value || (typeof value === 'object' && Object.keys(value).length <= 0) || (typeof value !== 'object' && value.length <= 0)" @click="removeProperty(key)">削除</button>
			</div>
		</div>
		<button @click="addProperty">プロパティ追加</button>
	</div>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits, reactive, toRefs, watch } from 'vue'
import MkInput from "@/components/form/input.vue";
import { ColorPicker } from 'vue3-colorpicker';

const props = defineProps<{ data: Record<string, any> }>()
const emit = defineEmits<{ (e: 'update', value: Record<string, any>): void }>()

const localData = reactive({ ...props.data })
const localKeys = reactive<{ [key: string]: string }>({})

for (const key in localData) {
	localKeys[key] = key
}

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

const removeProperty = (key: string) => {
	delete localData[key]
	delete localKeys[key]
	emitUpdate()
}
const isColor = (value: any): boolean => {
  if (typeof value !== 'string') return false
  return /^rgba?\(/.test(value) || /^#([0-9A-F]{3}){1,2}$/i.test(value)
}

const updateColor = (color: any, key: string) => {
  const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
  updateProperty(key, rgba);
}
</script>

<style scoped>
label {
	font-weight: bold;
	margin-right: 10px;
}

button {
	margin-left: 5px;
}
</style>
