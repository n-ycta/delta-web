import { tr } from '@/i18n';
import type { WidgetProps } from '../types';

/** Free-form note — useful to annotate dashboards. Supports **bold**, `code` and line breaks. */
export function NoteWidget({ config, ctx }: WidgetProps) {
  const text = (config.display.text as string | undefined) ?? '';
  if (ctx.editing) {
    return <textarea className="textarea" style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12.5 }} value={text} placeholder={tr("widgets.system.NoteWidget.s_c0e8a73fc3")} onChange={(e) => ctx.onDisplayChange({ text: e.target.value })} onMouseDown={(e) => e.stopPropagation()} />;
  }
  const html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br/>');
  return <div className="ink2" style={{ fontSize: 12.5, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: html || tr("widgets.system.NoteWidget.s_0089d71841") }} />;
}
