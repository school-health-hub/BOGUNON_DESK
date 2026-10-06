use std::path::Path;

use pdf_extract::{Document, MediaBox, OutputDev, OutputError, Transform};

use super::util::{ensure_has_text, normalize_extracted_text, ImportError, MAX_TEXT_BYTES};

const MAX_PDF_PAGES: usize = 50;
const MIN_PDF_MEANINGFUL_CHARACTERS: usize = 8;

#[derive(Default)]
struct LimitedPdfTextOutput {
    text: String,
    last_end: f64,
    last_y: f64,
    first_character_in_word: bool,
    page_number: u32,
    exceeded_limit: bool,
}

impl LimitedPdfTextOutput {
    fn push(&mut self, value: &str) -> Result<(), OutputError> {
        if self.text.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
            self.exceeded_limit = true;
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "text limit").into());
        }
        self.text.push_str(value);
        Ok(())
    }
}

impl OutputDev for LimitedPdfTextOutput {
    fn begin_page(
        &mut self,
        page_number: u32,
        _: &MediaBox,
        _: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), OutputError> {
        if self.page_number > 0 {
            self.push("\n\n")?;
        }
        self.page_number = page_number;
        self.last_end = f64::MAX;
        self.last_y = 0.0;
        self.first_character_in_word = false;
        Ok(())
    }

    fn end_page(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn begin_word(&mut self) -> Result<(), OutputError> {
        self.first_character_in_word = true;
        Ok(())
    }

    fn end_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn end_line(&mut self) -> Result<(), OutputError> {
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
        let rendered_font_size = (transform.m11.powi(2) + transform.m12.powi(2)).sqrt() * font_size;
        let x = transform.m31;
        let y = transform.m32;
        if self.first_character_in_word {
            if (y - self.last_y).abs() > rendered_font_size * 1.5
                || (x < self.last_end && (y - self.last_y).abs() > rendered_font_size * 0.5)
            {
                self.push("\n")?;
            } else if x > self.last_end + rendered_font_size * 0.1 {
                self.push(" ")?;
            }
        }
        self.push(character)?;
        self.first_character_in_word = false;
        self.last_y = y;
        self.last_end = x + width * rendered_font_size;
        Ok(())
    }
}

pub fn extract_pdf_text(path: &Path) -> Result<String, ImportError> {
    let document = Document::load(path).map_err(|_| ImportError::Unreadable)?;
    if document.get_pages().len() > MAX_PDF_PAGES {
        return Err(ImportError::PdfPageLimit);
    }
    let mut output = LimitedPdfTextOutput::default();
    if pdf_extract::output_doc(&document, &mut output).is_err() {
        return Err(if output.exceeded_limit {
            ImportError::TextLimit
        } else {
            ImportError::Unreadable
        });
    }
    let text = normalize_extracted_text(&output.text);
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        < MIN_PDF_MEANINGFUL_CHARACTERS
    {
        return Err(ImportError::PdfWithoutText);
    }
    ensure_has_text(text)
}
