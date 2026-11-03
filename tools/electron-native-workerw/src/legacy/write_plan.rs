use super::model::*;
// SDK values asserted against windows-rs constants by the compile-only adapter.
pub(super) const CHILD: u32 = 0x40000000;
pub(super) const POPUP: u32 = 0x80000000;
pub(super) const APP: u32 = 0x00040000;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ZOrder {
    Preserve,
    Top,
    After(u64),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Write {
    Show(bool),
    Styles(u32, u32),
    Parent(Option<u64>),
    Frame,
    Bounds(Rect, Option<u64>, ZOrder),
    Placement(Placement),
}
pub(super) fn plan(stage: Stage, s: &Snapshot, restore: bool) -> [Option<Write>; 4] {
    use Write::*;
    match (restore, stage) {
        (false, Stage::Hide) => [Some(Show(false)), None, None, None],
        (false, Stage::Styles) => [
            Some(Styles(
                (s.window.style | CHILD) & !POPUP,
                s.window.extended_style & !APP,
            )),
            None,
            None,
            None,
        ],
        (false, Stage::Parent) => [Some(Parent(Some(s.worker.handle))), None, None, None],
        (false, Stage::Frame) => [Some(Frame), None, None, None],
        (false, Stage::Placement) => [
            Some(Bounds(
                s.window.bounds,
                Some(s.worker.handle),
                ZOrder::Preserve,
            )),
            None,
            None,
            None,
        ],
        (false, Stage::Show) => [Some(Show(true)), None, None, None],
        (true, Stage::Show) => [Some(Show(false)), None, None, None],
        (true, Stage::Placement) => [None, None, None, None],
        (true, Stage::Frame) => [Some(Frame), None, None, None],
        (true, Stage::Parent) => [Some(Parent(None)), None, None, None],
        (true, Stage::Styles) => [
            Some(Styles(s.window.style, s.window.extended_style)),
            Some(Frame),
            Some(Placement(s.window.placement)),
            Some(Bounds(
                s.window.bounds,
                None,
                s.window
                    .z_order_anchor
                    .map(|a| ZOrder::After(a.handle))
                    .unwrap_or(ZOrder::Top),
            )),
        ],
        (true, Stage::Hide) => [Some(Show(s.window.visible)), None, None, None],
    }
}
pub(super) fn restore_plan(stage: Stage, s: &Snapshot, anchor_valid: bool) -> [Option<Write>; 4] {
    let mut result = plan(stage, s, true);
    if !anchor_valid {
        for operation in result.iter_mut().flatten() {
            if let Write::Bounds(_, _, z) = operation {
                *z = ZOrder::Preserve;
            }
        }
    }
    result
}
pub(super) fn execute<E>(
    plan: [Option<Write>; 4],
    mut call: impl FnMut(Write) -> Result<(), E>,
) -> Result<(), E> {
    for operation in plan.into_iter().flatten() {
        call(operation)?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::legacy::mock::snapshot;
    #[test]
    fn attach_never_uses_foreground_or_shell_target_write() {
        let s = snapshot();
        assert_eq!(
            plan(Stage::Parent, &s, false)[0],
            Some(Write::Parent(Some(s.worker.handle)))
        );
        assert_eq!(
            plan(Stage::Placement, &s, false)[0],
            Some(Write::Bounds(
                s.window.bounds,
                Some(s.worker.handle),
                ZOrder::Preserve
            ))
        );
        assert_eq!(plan(Stage::Show, &s, false)[0], Some(Write::Show(true)));
    }
    #[test]
    fn rollback_keeps_hidden_until_parent_styles_geometry_are_restored() {
        let mut s = snapshot();
        s.window.style = 0xc0000001;
        s.window.extended_style = 0x00040200;
        assert_eq!(plan(Stage::Show, &s, true)[0], Some(Write::Show(false)));
        assert_eq!(plan(Stage::Parent, &s, true)[0], Some(Write::Parent(None)));
        let ops = plan(Stage::Styles, &s, true);
        assert_eq!(ops[1], Some(Write::Frame));
        assert_eq!(ops[2], Some(Write::Placement(s.window.placement)));
    }
    #[test]
    fn partial_api_failure_stops_following_writes() {
        let s = snapshot();
        let mut count = 0;
        let result = execute(plan(Stage::Styles, &s, true), |_| {
            count += 1;
            if count == 2 {
                Err(())
            } else {
                Ok(())
            }
        });
        assert_eq!(result, Err(()));
        assert_eq!(count, 2);
    }
    #[test]
    fn flags_preserve_other_style_bits_and_clear_popup_appwindow() {
        let mut s = snapshot();
        s.window.style = 0xc0000001;
        s.window.extended_style = 0x00040200;
        assert_eq!(
            plan(Stage::Styles, &s, false)[0],
            Some(Write::Styles(0x40000001, 0x00000200))
        );
    }
    #[test]
    fn no_predecessor_means_top_not_preserve() {
        let mut s = snapshot();
        s.window.z_order_anchor = None;
        assert_eq!(
            restore_plan(Stage::Styles, &s, true)[3],
            Some(Write::Bounds(s.window.bounds, None, ZOrder::Top))
        );
    }
    #[test]
    fn stale_predecessor_still_restores_parent_styles_geometry_without_using_stale_hwnd() {
        let s = snapshot();
        assert_eq!(
            restore_plan(Stage::Parent, &s, false)[0],
            Some(Write::Parent(None))
        );
        let p = restore_plan(Stage::Styles, &s, false);
        assert_eq!(
            p[3],
            Some(Write::Bounds(s.window.bounds, None, ZOrder::Preserve))
        );
        let mut calls = Vec::new();
        execute(p, |w| {
            calls.push(w);
            Ok::<_, ()>(())
        })
        .unwrap();
        assert_eq!(calls.len(), 4);
    }
    #[test]
    fn every_partial_failure_position_stops_its_plan() {
        let s = snapshot();
        for restore in [false, true] {
            for stage in STAGES {
                let p = plan(stage, &s, restore);
                let len = p.iter().flatten().count();
                for fail in 0..len {
                    let mut count = 0;
                    let result = execute(p, |_| {
                        let index = count;
                        count += 1;
                        if index == fail {
                            Err(())
                        } else {
                            Ok(())
                        }
                    });
                    assert_eq!(result, Err(()));
                    assert_eq!(count, fail + 1);
                }
            }
        }
    }
}
