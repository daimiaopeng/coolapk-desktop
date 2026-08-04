<template>
  <label :class="['app-switch', { 'is-checked': modelValue, 'is-disabled': disabled }]">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="switch-input"
      @change="onToggle"
    />
    <span class="switch-slider"></span>
  </label>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
  }>(),
  {
    disabled: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function onToggle(e: Event) {
  if (props.disabled) return;
  emit('update:modelValue', (e.target as HTMLInputElement).checked);
}
</script>

<style scoped>
.app-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.switch-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border);
  transition: .2s ease-out;
  border-radius: 24px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .2s ease-out;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.app-switch.is-checked .switch-slider {
  background-color: var(--brand-primary);
}

.app-switch.is-checked .switch-slider:before {
  transform: translateX(20px);
}

.app-switch.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
