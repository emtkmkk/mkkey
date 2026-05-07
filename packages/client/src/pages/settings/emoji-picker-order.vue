<template>
  <div class="_formRoot">
    <FormSwitch v-model="enabled" class="_formBlock">{{ i18n.ts.enableEmojiPickerOrder }}</FormSwitch>
    <FormSlot>
      <template #label>{{ i18n.ts.emojiPickerOrder }}</template>
      <MkContainer :showHeader="false">
        <Sortable
          v-model="items"
          v-if="enabled"
          itemKey="id"
          :animation="150"
          :handle="'.' + $style.itemHandle"
          @start="(e) => e.item.classList.add('active')"
          @end="(e) => e.item.classList.remove('active')"
        >
          <template #item="{ element, index }">
            <div v-if="orderItemDef[element.type]" :class="$style.item">
              <button class="_button" :class="$style.itemHandle">
                <i class="ph-bold ph-list ph-lg"></i>
              </button>
              <span :class="$style.itemText">{{ getSectionLabel(element.type) }}</span>
              <button class="_button" :class="$style.itemRemove" @click="removeItem(index)">
                <i class="ph-bold ph-lg ph-x"></i>
              </button>
            </div>
          </template>
        </Sortable>
      </MkContainer>
    </FormSlot>
    <div class="_buttons" v-if="enabled">
      <FormButton @click="addItem"><i class="ph-bold ph-plus ph-lg"></i>{{ i18n.ts.addItem }}</FormButton>
      <FormButton primary class="save" @click="save"><i class="ph-bold ph-floppy-disk ph-lg"></i>{{ i18n.ts.save }}</FormButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineAsyncComponent, computed } from 'vue';
import FormSlot from '@/components/form/slot.vue';
import FormButton from '@/components/MkButton.vue';
import MkContainer from '@/components/MkContainer.vue';
import FormSwitch from '@/components/form/switch.vue';
import * as os from '@/os';
import { defaultStore } from '@/store';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const orderItemDef = {
  pinned1: {},
  pinned2: {},
  pinned3: {},
  pinned4: {},
  pinned5: {},
  recentlyUsed: {},
  recentlyAddEmojis: {},
  recentlyPopularReactions: {},
  random: {},
  followedCategories: {},
  customCategories: {},
  uncategorized: {},
  unicode: {},
};

const enabled = computed<boolean>({
  get: () => defaultStore.state.enableEmojiPickerOrder,
  set: (value) => {
    void defaultStore.set('enableEmojiPickerOrder', value);
  },
});
const enableAddedOrderCategory = computed<boolean>({
  get: () => defaultStore.state.enableEmojiPickerAddedOrderCategory,
  set: (value) => {
    void defaultStore.set('enableEmojiPickerAddedOrderCategory', value);
  },
});

function getSectionLabel(type: string): string {
  if (type === 'uncategorized' && enableAddedOrderCategory.value) {
    return i18n.ts.addedOrderCategory;
  }
  return i18n.ts._emojiPickerSections[type];
}

const items = ref(
  defaultStore.state.emojiPickerOrder
    .filter(x => x in orderItemDef)
    .map(x => ({ id: Math.random().toString(), type: x }))
);

async function addItem() {
  const remain = Object.keys(orderItemDef).filter(k => !items.value.some(i => i.type === k));
  const { canceled, result } = await os.select({
    title: i18n.ts.addItem,
    items: remain.map(k => ({ value: k, text: i18n.ts._emojiPickerSections[k] })),
  });
  if (canceled) return;
  items.value.push({ id: Math.random().toString(), type: result });
}

function removeItem(index: number) {
  items.value.splice(index, 1);
}

function save() {
  defaultStore.set('emojiPickerOrder', items.value.map(x => x.type));
}

definePageMetadata({
  title: i18n.ts.emojiPickerOrder,
  icon: 'ph-list-bullets ph-bold ph-lg',
});
</script>

<style lang="scss" module>
.item {
  position: relative;
  display: block;
  line-height: 2.85rem;
  overflow: hidden;
  white-space: nowrap;
  color: var(--navFg);
}
.itemText {
  position: relative;
  font-size: 0.9em;
}
.itemRemove {
  position: absolute;
  z-index: 10000;
  width: 2rem;
  height: 2rem;
  color: #ff2a2a;
  right: 0.5rem;
  opacity: 0.8;
}
.itemHandle {
  cursor: move;
  width: 2rem;
  height: 2rem;
  margin: 0 0.5rem;
  opacity: 0.5;
}
</style>
