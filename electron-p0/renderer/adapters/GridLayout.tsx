import { GridLayout as ExistingGridLayout } from 'react-grid-layout';
import type { ComponentProps } from 'react';
/** Preserve the existing layout and controls; only the drag-handle button must
 * escape the original blanket `button` cancel selector. PoC build only. */
export function GridLayout(props: ComponentProps<typeof ExistingGridLayout>) {
  const cancel=props.dragConfig?.cancel?.replace(/\bbutton\b/g,'button:not(.widget-frame__drag)');
  return <ExistingGridLayout {...props} dragConfig={{...props.dragConfig,cancel}}/>;
}
