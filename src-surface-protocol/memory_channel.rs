use std::io::{self, Read, Write};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MemoryChannelError {
    #[error("inherited channel I/O failed")]
    Io(#[from] io::Error),
    #[error("inherited channel frame is invalid")]
    InvalidFrame,
}

pub fn write_frame(
    writer: &mut impl Write,
    payload: &[u8],
    maximum: usize,
) -> Result<(), MemoryChannelError> {
    if payload.is_empty() || payload.len() > maximum || payload.len() > u32::MAX as usize {
        return Err(MemoryChannelError::InvalidFrame);
    }
    writer.write_all(&(payload.len() as u32).to_le_bytes())?;
    writer.write_all(payload)?;
    writer.flush()?;
    Ok(())
}

pub fn read_frame(reader: &mut impl Read, maximum: usize) -> Result<Vec<u8>, MemoryChannelError> {
    let mut length = [0_u8; 4];
    reader.read_exact(&mut length)?;
    let length = u32::from_le_bytes(length) as usize;
    if length == 0 || length > maximum {
        return Err(MemoryChannelError::InvalidFrame);
    }
    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload)?;
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_one_bounded_memory_frame() {
        let mut bytes = Vec::new();
        write_frame(&mut bytes, b"fixed-message", 64)
            .unwrap_or_else(|error| panic!("fixture frame must write: {error}"));
        let mut input = bytes.as_slice();
        assert_eq!(
            read_frame(&mut input, 64)
                .unwrap_or_else(|error| panic!("fixture frame must read: {error}")),
            b"fixed-message"
        );
    }

    #[test]
    fn rejects_empty_oversized_and_truncated_frames() {
        assert!(matches!(
            write_frame(&mut Vec::new(), b"", 8),
            Err(MemoryChannelError::InvalidFrame)
        ));
        assert!(matches!(
            write_frame(&mut Vec::new(), b"123456789", 8),
            Err(MemoryChannelError::InvalidFrame)
        ));
        let mut truncated = [4_u8, 0, 0, 0, 1, 2].as_slice();
        assert!(matches!(
            read_frame(&mut truncated, 8),
            Err(MemoryChannelError::Io(_))
        ));
    }
}
