use crate::{
    evidence_record::{Check, Record},
    observation::topology_evidence::{EnumerationScope, FollowingSearch, HostKind, Trace},
    observation_reader::evidence::{Evidence, Failure},
};
use serde::{de::Error, Deserialize, Deserializer};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyRecord {
    #[serde(deserialize_with = "version::<_, 1>")]
    pub schema_version: u8,
    #[serde(deserialize_with = "required")]
    pub collection: Option<Evidence>,
    pub post_collection_check: Check,
    pub own_window_check: Check,
    #[serde(deserialize_with = "required")]
    pub final_query_error: Option<Failure>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Decoded {
    V2(Record),
    V1(LegacyRecord),
}

pub fn decode(bytes: &[u8]) -> serde_json::Result<Decoded> {
    serde_json::from_slice(bytes)
}

pub fn version<'de, D: Deserializer<'de>, const V: u8>(d: D) -> Result<u8, D::Error> {
    let actual = u8::deserialize(d)?;
    if actual != V {
        return Err(D::Error::custom("unsupported evidence schema version"));
    }
    Ok(actual)
}

pub fn required<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(d)
}

pub fn topology<'de, D: Deserializer<'de>>(d: D) -> Result<Trace, D::Error> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct WireTrace {
        host_kind: HostKind,
        following_search: FollowingSearch,
        #[serde(deserialize_with = "required")]
        following_tail_count: Option<usize>,
        enumeration_scope: EnumerationScope,
    }
    let wire = WireTrace::deserialize(d)?;
    match (wire.following_search, wire.following_tail_count) {
        (FollowingSearch::Found, Some(0)) => {
            return Err(D::Error::custom(
                "found worker requires a nonempty inclusive tail",
            ));
        }
        (FollowingSearch::Found, None | Some(1..)) | (FollowingSearch::None, None | Some(0)) => {}
        (FollowingSearch::None, Some(_)) => {
            return Err(D::Error::custom(
                "absent following worker requires an empty tail",
            ));
        }
        (FollowingSearch::Error | FollowingSearch::NotObserved, None) => {}
        (FollowingSearch::Error | FollowingSearch::NotObserved, Some(_)) => {
            return Err(D::Error::custom(
                "tail count requires a completed following search",
            ));
        }
    }
    Ok(Trace {
        host_kind: wire.host_kind,
        following_search: wire.following_search,
        following_tail_count: wire.following_tail_count,
        enumeration_scope: wire.enumeration_scope,
    })
}
