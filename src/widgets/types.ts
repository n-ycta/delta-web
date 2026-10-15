import type { MetricDescriptor, PluginEntry, TimeRangePreset, WidgetConfig, WidgetDisplay } from '@/core/contracts';

export interface WidgetContext {
  range: TimeRangePreset;
  refreshSec: number;
  plugin?: PluginEntry;
  metric?: MetricDescriptor;
  editing: boolean;
  /** persist display tweaks made directly in the widget (e.g. legend toggles) */
  onDisplayChange: (patch: Partial<WidgetDisplay>) => void;
}

export interface WidgetProps { config: WidgetConfig; ctx: WidgetContext }
