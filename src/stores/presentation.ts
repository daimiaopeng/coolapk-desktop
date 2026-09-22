import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { detectRuntimePlatform, type RuntimePlatform } from '../utils/platform';
import {
  getMobileLayoutForWidth,
  isMobileRuntimePlatform,
  resolveInitialPresentation,
  resolvePresentationForWidth,
  type MobileLayout,
  type Presentation,
  type PresentationMode,
} from '../utils/presentationPolicy';

export type { MobileLayout, Presentation, PresentationMode } from '../utils/presentationPolicy';
export type { RuntimePlatform } from '../utils/platform';

const PRESENTATION_MODE_KEY = 'coolapk_presentation_mode';

function isPresentationMode(value: unknown): value is PresentationMode {
  return value === 'auto' || value === 'force-desktop' || value === 'force-mobile';
}

function readPresentationMode(): PresentationMode {
  if (typeof window === 'undefined') return 'auto';

  const queryValues = [window.location.search, window.location.hash.split('?')[1] ? `?${window.location.hash.split('?')[1]}` : ''];
  for (const query of queryValues) {
    const requested = new URLSearchParams(query).get('presentation');
    if (isPresentationMode(requested)) return requested;
  }

  try {
    const stored = localStorage.getItem(PRESENTATION_MODE_KEY);
    return isPresentationMode(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function getViewportWidth(): number {
  if (typeof document !== 'undefined' && document.documentElement.clientWidth > 0) {
    return document.documentElement.clientWidth;
  }
  if (typeof window !== 'undefined' && window.innerWidth > 0) return window.innerWidth;
  return 1280;
}

export const usePresentationStore = defineStore('presentation', () => {
  const runtimePlatform = ref<RuntimePlatform>(detectRuntimePlatform());
  const mode = ref<PresentationMode>(readPresentationMode());
  const viewportWidth = ref(getViewportWidth());
  const presentation = ref<Presentation>(resolveInitialPresentation(mode.value, runtimePlatform.value, viewportWidth.value));
  const started = ref(false);

  let stopViewportListeners: (() => void) | null = null;

  const isMobileRuntime = computed(() => isMobileRuntimePlatform(runtimePlatform.value));
  const isMobile = computed(() => presentation.value === 'mobile');
  const mobileLayout = computed<MobileLayout>(() => getMobileLayoutForWidth(viewportWidth.value));

  function persistMode(nextMode: PresentationMode) {
    try {
      if (nextMode === 'auto') localStorage.removeItem(PRESENTATION_MODE_KEY);
      else localStorage.setItem(PRESENTATION_MODE_KEY, nextMode);
    } catch {
      // Private browsing and restricted WebViews may reject localStorage.
    }
  }

  function updatePresentation(width = getViewportWidth()) {
    viewportWidth.value = width;
    presentation.value = resolvePresentationForWidth(
      presentation.value,
      mode.value,
      runtimePlatform.value,
      width,
    );
  }

  function setMode(nextMode: PresentationMode) {
    mode.value = nextMode;
    persistMode(nextMode);
    updatePresentation();
  }

  function start() {
    if (started.value || typeof window === 'undefined') return;
    started.value = true;
    updatePresentation();

    const handleViewportChange = () => updatePresentation();
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
    stopViewportListeners = () => {
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      stopViewportListeners = null;
      started.value = false;
    };
  }

  function stop() {
    stopViewportListeners?.();
  }

  return {
    runtimePlatform,
    mode,
    viewportWidth,
    presentation,
    isMobileRuntime,
    isMobile,
    mobileLayout,
    start,
    stop,
    setMode,
    updatePresentation,
  };
});
