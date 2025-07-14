<template>
  <MkModalWindow ref="dialog" @close="close" @closed="$emit('closed')">
    <MkSpacer :content-max="600" :margin-min="20">
      <template #header>{{ i18n.ts.wordMuteBuilder }}</template>
      <div class="_formRoot">
        <FormInput v-model="pname" class="_formBlock">
          <template #label>{{ i18n.ts._wordMuteBuilder.pname }}</template>
        </FormInput>
        <FormInput v-model="keyword" class="_formBlock">
          <template #label>{{ i18n.ts._wordMuteBuilder.keyword }}</template>
        </FormInput>
        <div class="_formBlock" v-for="(item, idx) in froms" :key="`from-${idx}`">
          <FormInput v-model="item.value" :small="true">
            <template #label>{{ i18n.ts._wordMuteBuilder.from }}</template>
          </FormInput>
          <FormCheckbox v-model="item.invert" small>
            {{ i18n.ts._wordMuteBuilder.invertField }}
          </FormCheckbox>
          <MkButton small @click="removeFrom(idx)">
            <i class="ph-minus ph-bold"></i>
            {{ i18n.ts._wordMuteBuilder.removeField }}
          </MkButton>
        </div>
        <MkButton small @click="addFrom" class="_formBlock">
          <i class="ph-plus ph-bold"></i>
          {{ i18n.ts._wordMuteBuilder.addField.replace('{field}', i18n.ts._wordMuteBuilder.from) }}
        </MkButton>

        <div class="_formBlock" v-for="(item, idx) in names" :key="`name-${idx}`">
          <FormInput v-model="item.value" :small="true">
            <template #label>{{ i18n.ts._wordMuteBuilder.name }}</template>
          </FormInput>
          <FormCheckbox v-model="item.invert" small>
            {{ i18n.ts._wordMuteBuilder.invertField }}
          </FormCheckbox>
          <MkButton small @click="removeName(idx)">
            <i class="ph-minus ph-bold"></i>
            {{ i18n.ts._wordMuteBuilder.removeField }}
          </MkButton>
        </div>
        <MkButton small @click="addName" class="_formBlock">
          <i class="ph-plus ph-bold"></i>
          {{ i18n.ts._wordMuteBuilder.addField.replace('{field}', i18n.ts._wordMuteBuilder.name) }}
        </MkButton>
        <FormSelect v-model="visibility.value" class="_formBlock">
          <template #label>{{ i18n.ts._wordMuteBuilder.visibility }}</template>
          <option value=""></option>
          <option value="public">public</option>
          <option value="home">home</option>
          <option value="hidden">hidden</option>
          <option value="followers">followers</option>
          <option value="specified">specified</option>
        </FormSelect>
        <FormCheckbox v-model="visibility.invert" class="_formBlock">
          {{ i18n.ts._wordMuteBuilder.invertField }}
        </FormCheckbox>
        <div class="_formBlock">
          <span class="label">{{ i18n.ts._wordMuteBuilder.filter }}</span>
          <div class="filters">
            <div v-for="opt in filterOptions" :key="opt.value" class="_filterItem">
              <FormCheckbox v-model="filters[opt.value].checked">
                {{ opt.label }}
              </FormCheckbox>
              <FormCheckbox v-model="filters[opt.value].invert" small>
                {{ i18n.ts._wordMuteBuilder.invertField }}
              </FormCheckbox>
            </div>
          </div>
        </div>
        <div class="_formBlock" v-for="(item, idx) in includes" :key="`include-${idx}`">
          <FormInput v-model="item.value" :small="true">
            <template #label>{{ i18n.ts._wordMuteBuilder.include }}</template>
          </FormInput>
          <FormCheckbox v-model="item.invert" small>
            {{ i18n.ts._wordMuteBuilder.invertField }}
          </FormCheckbox>
          <MkButton small @click="removeInclude(idx)">
            <i class="ph-minus ph-bold"></i>
            {{ i18n.ts._wordMuteBuilder.removeField }}
          </MkButton>
        </div>
        <MkButton small @click="addInclude" class="_formBlock">
          <i class="ph-plus ph-bold"></i>
          {{ i18n.ts._wordMuteBuilder.addField.replace('{field}', i18n.ts._wordMuteBuilder.include) }}
        </MkButton>

        <div class="_formBlock" v-for="(item, idx) in excludes" :key="`exclude-${idx}`">
          <FormInput v-model="item.value" :small="true">
            <template #label>{{ i18n.ts._wordMuteBuilder.exclude }}</template>
          </FormInput>
          <FormCheckbox v-model="item.invert" small>
            {{ i18n.ts._wordMuteBuilder.invertField }}
          </FormCheckbox>
          <MkButton small @click="removeExclude(idx)">
            <i class="ph-minus ph-bold"></i>
            {{ i18n.ts._wordMuteBuilder.removeField }}
          </MkButton>
        </div>
        <MkButton small @click="addExclude" class="_formBlock">
          <i class="ph-plus ph-bold"></i>
          {{ i18n.ts._wordMuteBuilder.addField.replace('{field}', i18n.ts._wordMuteBuilder.exclude) }}
        </MkButton>

        <FormCheckbox v-model="inverted" class="_formBlock">
          {{ i18n.ts._wordMuteBuilder.invert }}
        </FormCheckbox>

        <FormTextarea readonly v-model="command" class="_formBlock">
          <template #label>{{ i18n.ts.generatedCommand }}</template>
        </FormTextarea>
        <MkButton primary class="_formBlock" @click="submit">
          <i class="ph-plus ph-bold ph-lg"></i>
          {{ i18n.ts.add }}
        </MkButton>
      </div>
    </MkSpacer>
  </MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import FormInput from '@/components/form/input.vue';
import FormSelect from '@/components/form/select.vue';
import FormCheckbox from '@/components/form/checkbox.vue';
import FormTextarea from '@/components/form/textarea.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';

const emit = defineEmits<{(ev:'done', command:string): void; (ev:'closed'): void;}>();

interface Item { value: string; invert: boolean }

const keyword = ref('');
const froms = ref<Item[]>([{ value: '', invert: false }]);
const names = ref<Item[]>([{ value: '', invert: false }]);
const visibility = ref<{ value: string; invert: boolean }>({ value: '', invert: false });
const includes = ref<Item[]>([{ value: '', invert: false }]);
const excludes = ref<Item[]>([{ value: '', invert: false }]);
const pname = ref('');
const inverted = ref(false);
const filters = ref<Record<string, { checked: boolean; invert: boolean }>>({
  mention: { checked: false, invert: false },
  reply: { checked: false, invert: false },
  renote: { checked: false, invert: false },
  quote: { checked: false, invert: false },
  media: { checked: false, invert: false },
  poll: { checked: false, invert: false },
  channel: { checked: false, invert: false },
  cw: { checked: false, invert: false },
  nsfw: { checked: false, invert: false },
});

function addFrom() { froms.value.push({ value: '', invert: false }); }
function removeFrom(i: number) { froms.value.splice(i, 1); }
function addName() { names.value.push({ value: '', invert: false }); }
function removeName(i: number) { names.value.splice(i, 1); }
function addInclude() { includes.value.push({ value: '', invert: false }); }
function removeInclude(i: number) { includes.value.splice(i, 1); }
function addExclude() { excludes.value.push({ value: '', invert: false }); }
function removeExclude(i: number) { excludes.value.splice(i, 1); }

const filterOptions = [
  { value: 'mention', label: 'mention' },
  { value: 'reply', label: 'reply' },
  { value: 'renote', label: 'renote' },
  { value: 'quote', label: 'quote' },
  { value: 'media', label: 'media' },
  { value: 'poll', label: 'poll' },
  { value: 'channel', label: 'channel' },
  { value: 'cw', label: 'cw' },
  { value: 'nsfw', label: 'nsfw' },
];

const command = computed(() => {
  const parts: string[] = [];
  if (pname.value) parts.push(`pname:${pname.value}`);
  if (keyword.value) parts.push(keyword.value);
  for (const f of froms.value) {
    if (f.value) parts.push(`${f.invert ? '!' : ''}from:${f.value}`);
  }
  for (const n of names.value) {
    if (n.value) parts.push(`${n.invert ? '!' : ''}name:${n.value}`);
  }
  if (visibility.value.value) parts.push(`${visibility.value.invert ? '!' : ''}visibility:${visibility.value.value}`);
  for (const [k, v] of Object.entries(filters.value)) {
    if (v.checked) parts.push(`${v.invert ? '!' : ''}filter:${k}`);
  }
  for (const inc of includes.value) {
    if (inc.value) parts.push(`${inc.invert ? '!' : ''}include:${inc.value}`);
  }
  for (const exc of excludes.value) {
    if (exc.value) parts.push(`${exc.invert ? '!' : ''}exclude:${exc.value}`);
  }
  return (inverted.value ? '!' : '') + parts.join(' ');
});

function submit() {
  emit('done', command.value.trim());
  close();
}

function close() {
  emit('closed');
}
</script>

<style lang="scss" scoped>
.label {
  display: block;
  margin-bottom: 0.25rem;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.\_filterItem {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
