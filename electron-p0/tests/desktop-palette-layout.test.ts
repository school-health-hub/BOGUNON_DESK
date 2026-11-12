import { describe, expect, it } from 'vitest';
import { createDefaultDashboardLayout, deskWidgetLayouts } from '../../src/dashboard/layouts';
import { WIDGET_LAYOUT_VERSION } from '../../src/dashboard/types';

describe('Desktop palette TD2 projection contract', () => {
  it('projects the existing version 1 layout and all 13 stable widget IDs without rewriting geometry', () => {
    const source = createDefaultDashboardLayout();
    expect(source.version).toBe(WIDGET_LAYOUT_VERSION);
    expect(source.version).toBe(1);
    expect(source.widgets).toHaveLength(13);
    expect(source.widgets.map(({ id }) => id)).toEqual(deskWidgetLayouts.map(({ id }) => id));
    expect(source.widgets).toEqual(deskWidgetLayouts);
  });
});
