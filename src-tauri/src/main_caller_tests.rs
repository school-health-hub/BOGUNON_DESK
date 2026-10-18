use super::*;

#[test]
fn resource_table_clones_preserve_private_identity() {
    let mut table = tauri::ResourceTable::default();
    let expected = Arc::new(Identity);
    let rid = table.add_arc(Arc::clone(&expected));
    assert!(Arc::ptr_eq(&expected, &table.get::<Identity>(rid).unwrap()));
}

#[test]
fn independent_resource_tables_do_not_share_identity() {
    let mut main = tauri::ResourceTable::default();
    let mut other = tauri::ResourceTable::default();
    let main_id = main.add(Identity);
    let other_id = other.add(Identity);
    assert!(!Arc::ptr_eq(
        &main.get::<Identity>(main_id).unwrap(),
        &other.get::<Identity>(other_id).unwrap()
    ));
}

#[test]
fn replaced_resource_at_same_id_does_not_match_pinned_identity() {
    let mut table = tauri::ResourceTable::default();
    let pinned = Arc::new(Identity);
    let rid = table.add_arc(Arc::clone(&pinned));
    table.replace(rid, Identity);
    assert!(!Arc::ptr_eq(&pinned, &table.get::<Identity>(rid).unwrap()));
}
