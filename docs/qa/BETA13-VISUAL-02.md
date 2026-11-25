# BETA13-VISUAL-02

Base: `da90afbdb34abf20548ba87e86d0647b2a011b03`. Branch: `codex/beta13-visual-02`.

## Scope

- Screen placement Settings uses separated preset cards, labeled fields, a highlighted draft preview and a single action row at normal window widths.
- Palette Dock aligns with the right edge of the cards, keeping the existing bottom inset, hit-region handling and actions.
- Monthly dates and weekdays are distinct. Today has a rose outline and marker. The monthly cells use the local event title without repeating its type and time, and keep the existing full text tooltip. Other calendar summaries retain their original metadata.
- The QA harness populates the real local calendar store with a synthetic event and claims the calendar, meal and notification widgets in a disposable profile. Newsletter QA selects the Palette that owns the Dock.

## Comparison evidence

Local Playwright captures are in `artifacts/visual-before/` (integration build) and `artifacts/visual-final/` (visual branch). Compare `board-settings.png`, `palette-populated.png`, `monthly-calendar.png`, `palette-shared.png` and `palette-dedicated.png` under the test result directory. The Palette capture is the Electron app surface. Two physical 1920×1080 Windows displays were present, with 1920×1032 work areas.

The operational desktop was excluded from capture. Wallpaper contrast, Windows icon overlap, physical single-monitor behavior, physical mixed DPI, and hot unplug/reconnect remain separate QA. Lunch and notification cards were visible with empty or disconnected states.

## Results

| Area | Result | Observation |
| --- | --- | --- |
| Settings | PASS at captured size | Previously contiguous labels and buttons now have separate rows, a highlighted preview and aligned actions. |
| Dock and board | PASS for right-edge alignment | Dock shares the right card edge and stays within the work area. Larger gaps in the stored widget arrangement remain visible. |
| Monthly calendar | PASS for captured event | Before, the cell showed the event prefix and a scrollbar. After, days and today are distinct, and the real local-store QA title fits on two lines. Longer titles and compact widths remain follow-up cases. |
| Windows function | PASS | Baseline and final board E2E passed. The final run covered 25% shared inset, dedicated secondary target, Settings actions, unchanged profile at placement, exit and relaunch. Newsletter confirmation and PNG/PDF output passed on the final build. |
| Automated regression | PASS | Integrated 74 tests passed. Eight local-event tests passed after updating the month-only title expectation and checking the weekly label remains intact. Electron production build and final renderer and E2E TypeScript checks passed. |
| Desktop legibility | NOT RUN | App-surface screenshots exclude the operating desktop. |

Overall: CONDITIONAL for desktop visual approval outside the verified dual-monitor setup. Test images are local evidence and are excluded from the commit.
