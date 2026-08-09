<template>
  <AppConfirmDialog
    :is-open="confirmationState.isOpen"
    :title="confirmationState.title"
    :message="confirmationState.message"
    :confirm-text="confirmationState.confirmText"
    :danger="confirmationState.danger"
    @cancel="settleConfirmation(false)"
    @confirm="settleConfirmation(true)"
  />
</template>

<script setup lang="ts">
import AppConfirmDialog from './AppConfirmDialog.vue';
import { confirmationState, settleConfirmation } from '../../utils/confirm';
</script>
