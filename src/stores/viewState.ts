import { defineStore } from 'pinia';
import { ref } from 'vue';

type DraftSnapshot = {
  key: string;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

function getFieldValue(element: HTMLElement): string | null {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.type === 'password' || element.type === 'file') return null;
    return element.value;
  }
  if (element.isContentEditable) return element.textContent || '';
  return null;
}

function setFieldValue(element: HTMLElement, value: string) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (element.isContentEditable) element.textContent = value;
}

function getFieldKey(element: HTMLElement, index: number): string {
  return element.dataset.draftKey
    || element.getAttribute('name')
    || element.id
    || `${element.tagName.toLowerCase()}:${index}`;
}

/** Shared, in-memory view state that survives a Presentation remount. */
export const useViewStateStore = defineStore('viewState', () => {
  const drafts = ref<Record<string, DraftSnapshot[]>>({});

  function captureRoute(routeKey: string) {
    const surface = document.querySelector<HTMLElement>('[data-route-surface]');
    if (!surface) return;

    const snapshots: DraftSnapshot[] = [];
    surface.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]').forEach((element, index) => {
      const value = getFieldValue(element);
      if (value === null) return;
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      snapshots.push({
        key: getFieldKey(element, index),
        value,
        selectionStart: 'selectionStart' in input ? input.selectionStart : null,
        selectionEnd: 'selectionEnd' in input ? input.selectionEnd : null,
      });
    });
    drafts.value[routeKey] = snapshots;
  }

  function restoreRoute(routeKey: string) {
    const snapshots = drafts.value[routeKey];
    const surface = document.querySelector<HTMLElement>('[data-route-surface]');
    if (!snapshots || !surface) return;

    const fields = Array.from(surface.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]'));
    const byKey = new Map(fields.map((element, index) => [getFieldKey(element, index), element]));
    snapshots.forEach((snapshot) => {
      const element = byKey.get(snapshot.key);
      if (!element) return;
      setFieldValue(element, snapshot.value);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
          element.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
        }
      }
    });
  }

  return { drafts, captureRoute, restoreRoute };
});
