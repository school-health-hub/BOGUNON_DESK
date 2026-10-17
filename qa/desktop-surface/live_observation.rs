use crate::{
    diagnostic_output::{Code, Finding},
    evidence_record::{Check, Record},
    observation::*,
    observation_reader::Reader,
    outcome::Report,
    window_lifecycle::WindowError,
    window_observation::{relations, unchanged},
};

pub fn observe<Q: ReadQueries>(
    reader: &mut Reader<Q>,
    ids: &[WindowId],
    evidence: &mut Record,
) -> Finding {
    let before = ids
        .iter()
        .map(|id| reader.0.window(*id))
        .collect::<Result<Vec<_>, _>>();
    let Ok(before) = before else {
        evidence.own_window_check = Check::Failed;
        return Finding::failure(Code::Snapshot);
    };
    if relations(&before).is_err() {
        evidence.own_window_check = Check::Failed;
        return Finding::failure(Code::Snapshot);
    }
    let (collected, collection) = reader.collect_with_evidence(before[0].identity.id);
    evidence.topology = collection.topology.clone();
    evidence.collection = Some(collection);
    let capability = collected.and_then(|snapshot| {
        let result = unchanged(&reader.0, &before[0], &snapshot.main)
            .map_err(|_| QueryError::IdentityChanged)
            .and_then(|()| reader.topology_consistent(&snapshot));
        evidence.post_collection_check = if result.is_ok() {
            Check::Passed
        } else {
            Check::Failed
        };
        result
    });
    if let Err(error) = &capability {
        evidence.query_error(error);
    }
    let window = before.iter().try_for_each(|old| {
        let after = reader
            .0
            .window(old.identity.id)
            .map_err(|_| WindowError::Observation)?;
        unchanged(&reader.0, old, &after)
    });
    evidence.own_window_check = if window.is_ok() {
        Check::Passed
    } else {
        Check::Failed
    };
    let error = match &capability {
        Ok(()) | Err(QueryError::NoEligibleWorker) => None,
        Err(QueryError::ShellIdentity) => Some(Code::ShellIdentity),
        Err(QueryError::TopologyChanged | QueryError::AmbiguousWorker) => Some(Code::Topology),
        Err(
            QueryError::Api(..)
            | QueryError::Hresult(..)
            | QueryError::InvalidValue(..)
            | QueryError::IdentityChanged
            | QueryError::DpiMismatch,
        ) => Some(Code::Snapshot),
    };
    Finding {
        report: Report::finish(window, capability, Ok(())),
        error: if window.is_err() {
            Some(Code::Snapshot)
        } else {
            error
        },
    }
}
