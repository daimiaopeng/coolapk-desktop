export interface MobileSurfaceTab {
  key: string;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}

export type MobileSurfaceFilter = MobileSurfaceTab;
