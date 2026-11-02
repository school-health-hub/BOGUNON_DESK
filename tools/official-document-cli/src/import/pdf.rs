use super::{normalize, ImportError, MAX_PDF_PAGES, MAX_TEXT_BYTES};
use pdf_extract::{Document, MediaBox, OutputDev, OutputError, Transform};
use std::path::Path;

const MIN_MEANINGFUL_CHARACTERS: usize = 8;

#[derive(Default)]
struct LimitedOutput {
    text: String,
    last_end: f64,
    last_y: f64,
    first_in_word: bool,
    page_number: u32,
    exceeded_limit: bool,
}

impl LimitedOutput {
    fn push(&mut self, value: &str) -> Result<(), OutputError> {
        if self.text.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
            self.exceeded_limit = true;
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "PDF text limit exceeded",
            )
            .into());
        }
        self.text.push_str(value);
        Ok(())
    }
}

impl OutputDev for LimitedOutput {
    fn begin_page(
        &mut self,
        page: u32,
        _: &MediaBox,
        _: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), OutputError> {
        if self.page_number > 0 {
            self.push("\n\n")?;
        }
        self.page_number = page;
        self.last_end = f64::MAX;
        self.last_y = 0.0;
        self.first_in_word = false;
        Ok(())
    }
    fn end_page(&mut self) -> Result<(), OutputError> {
        Ok(())
    }
    fn output_character(
        &mut self,
        transform: &Transform,
        width: f64,
        _: f64,
        font_size: f64,
        character: &str,
    ) -> Result<(), OutputError> {
        let size = (transform.m11.powi(2) + transform.m12.powi(2)).sqrt() * font_size;
        let (x, y) = (transform.m31, transform.m32);
        if self.first_in_word {
            if (y - self.last_y).abs() > size * 1.5
                || (x < self.last_end && (y - self.last_y).abs() > size * 0.5)
            {
                self.push("\n")?;
            } else if x > self.last_end + size * 0.1 {
                self.push(" ")?;
            }
        }
        self.push(character)?;
        self.first_in_word = false;
        self.last_y = y;
        self.last_end = x + width * size;
        Ok(())
    }
    fn begin_word(&mut self) -> Result<(), OutputError> {
        self.first_in_word = true;
        Ok(())
    }
    fn end_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }
    fn end_line(&mut self) -> Result<(), OutputError> {
        Ok(())
    }
}

pub(super) fn extract(path: &Path) -> Result<String, ImportError> {
    let document = Document::load(path).map_err(|_| ImportError::PdfUnreadable)?;
    if document.get_pages().len() > MAX_PDF_PAGES {
        return Err(ImportError::PdfPageLimit);
    }
    let mut output = LimitedOutput::default();
    if pdf_extract::output_doc(&document, &mut output).is_err() {
        return Err(if output.exceeded_limit {
            ImportError::PdfTextLimit
        } else {
            ImportError::PdfUnreadable
        });
    }
    let text = normalize(&output.text);
    if text.len() > MAX_TEXT_BYTES {
        return Err(ImportError::PdfTextLimit);
    }
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        < MIN_MEANINGFUL_CHARACTERS
    {
        return Err(ImportError::PdfWithoutText);
    }
    Ok(text)
}
