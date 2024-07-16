import { Directive } from "vue";

type Value = { max?: number[]; min?: number[] };

const mountings = new Map<
  Element,
  {
    value: Value;
    resize: ResizeObserver;
    intersection?: IntersectionObserver;
    previousWidth: number;
    classChangeTimestamps: number[]; // Track timestamps of class changes
  }
>();

type ClassOrder = {
  add: string[];
  remove: string[];
};

const cache = new Map<string, ClassOrder>();

function getClassOrder(width: number, queue: Value): ClassOrder {
  const getMaxClass = (v: number) => `max-width_${v}px`;
  const getMinClass = (v: number) => `min-width_${v}px`;

  let maxClassesToAdd: string[] = [];
  let minClassesToAdd: string[] = [];
  let maxClassesToRemove: string[] = [];
  let minClassesToRemove: string[] = [];

  if (queue.max) {
    const maxToAdd = queue.max.filter((v) => width <= v);
    const maxToRemove = queue.max.filter((v) => width > v);
    if (maxToAdd.length > 0) {
      const largestMaxToAdd = Math.min(...maxToAdd);
      maxClassesToAdd = [getMaxClass(largestMaxToAdd)];
    }
    maxClassesToRemove = maxToRemove.map(getMaxClass);
  }

  if (queue.min) {
    const minToAdd = queue.min.filter((v) => width >= v);
    const minToRemove = queue.min.filter((v) => width < v);
    if (minToAdd.length > 0) {
      const smallestMinToAdd = Math.max(...minToAdd);
      minClassesToAdd = [getMinClass(smallestMinToAdd)];
    }
    minClassesToRemove = minToRemove.map(getMinClass);
  }

  return {
    add: [...maxClassesToAdd, ...minClassesToAdd],
    remove: [...maxClassesToRemove, ...minClassesToRemove],
  };
}

function applyClassOrder(el: Element, order: ClassOrder) {
  el.classList.add(...order.add);
  el.classList.remove(...order.remove);
}

function getOrderName(width: number, queue: Value): string {
  return `${width}|${queue.max ? queue.max.join(",") : ""}|${
    queue.min ? queue.min.join(",") : ""
  }`;
}

function calc(el: Element) {
  const info = mountings.get(el);
  const width = el.clientWidth;

  if (!info || info.previousWidth === width) return;

  if (!width) {
    if (!info.intersection) {
      info.intersection = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) calc(el);
      });
    }
    info.intersection.observe(el);
    return;
  }
  if (info.intersection) {
    info.intersection.disconnect();
    info.intersection = undefined;
  }

  mountings.set(el, Object.assign(info, { previousWidth: width }));

  const now = Date.now();
  info.classChangeTimestamps = info.classChangeTimestamps.filter(
    (timestamp) => now - timestamp < 1000
  );
  if (info.classChangeTimestamps.length >= 5) {
    console.warn("Class changes are happening too frequently. Stopping further changes.");
    return;
  }
  info.classChangeTimestamps.push(now);

  const cached = cache.get(getOrderName(width, info.value));
  if (cached) {
    applyClassOrder(el, cached);
  } else {
    const order = getClassOrder(width, info.value);
    cache.set(getOrderName(width, info.value), order);
    applyClassOrder(el, order);
  }
}

export default {
  mounted(src, binding, vn) {
    const resize = new ResizeObserver((entries, observer) => {
      calc(src);
    });

    mountings.set(src, {
      value: binding.value,
      resize,
      previousWidth: 0,
      classChangeTimestamps: [], // Initialize class change timestamps
    });

    calc(src);
    resize.observe(src);
  },

  updated(src, binding, vn) {
    mountings.set(
      src,
      Object.assign({}, mountings.get(src), { value: binding.value }),
    );
    calc(src);
  },

  unmounted(src, binding, vn) {
    const info = mountings.get(src);
    if (!info) return;
    info.resize.disconnect();
    if (info.intersection) info.intersection.disconnect();
    mountings.delete(src);
  },
} as Directive<Element, Value>;
