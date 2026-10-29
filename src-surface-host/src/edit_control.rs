use bogunon_main_restore_protocol::{
    edit_control::{
        AdmittedEditCommand, EditAdmission, EditBinding, EditControlError, MAX_EDIT_MESSAGE_BYTES,
    },
    memory_channel::{read_frame, MemoryChannelError},
};
use std::sync::mpsc::{self, Receiver};

pub type EditControlResult = Result<AdmittedEditCommand, EditControlError>;

pub fn start_reader(binding: EditBinding) -> std::io::Result<Receiver<EditControlResult>> {
    let (sender, receiver) = mpsc::channel();
    std::thread::Builder::new()
        .name("surface-edit-control".to_owned())
        .spawn(move || {
            let mut admission = EditAdmission::new(binding);
            let stdin = std::io::stdin();
            let mut input = stdin.lock();
            loop {
                let payload = match read_frame(&mut input, MAX_EDIT_MESSAGE_BYTES) {
                    Ok(payload) => payload,
                    Err(MemoryChannelError::InvalidFrame) => {
                        let _ = sender.send(Err(EditControlError::InvalidMessage));
                        return;
                    }
                    Err(MemoryChannelError::Io(_)) => return,
                };
                let result = admission.admit(&payload);
                let terminal = result.is_err();
                if sender.send(result).is_err() || terminal {
                    return;
                }
            }
        })?;
    Ok(receiver)
}
