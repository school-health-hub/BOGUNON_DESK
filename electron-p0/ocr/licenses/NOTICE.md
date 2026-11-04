# Offline OCR attribution

- Tesseract.js 6.0.1 and tesseract.js-core 6.1.2: Apache-2.0; the build copies each package's included license and metadata.
- kor / eng traineddata: @tesseract.js-data/kor@1.0.0 and @tesseract.js-data/eng@1.0.0, from their pinned `4.0.0_best_int` directories. npm wrapper packages declare MIT; upstream Tesseract language data is Apache-2.0. Preserve both package metadata and upstream license.
- Upstream data license: https://github.com/tesseract-ocr/tessdata_best/blob/main/LICENSE (retrieved 2026-11-04).
- Leptonica (Tesseract native image processing dependency): BSD-2-Clause, upstream license included from https://github.com/DanBloomberg/leptonica/blob/master/leptonica-license.txt.
- npm package wrapper provenance: https://github.com/naptha/tessdata (authors are retained in the copied package metadata).
- All transitive package versions and licenses are retained in staged package.json/license files. package-lock.json locks npm integrity; build manifest records the actual distributed file SHA-256 values.
- No approved mascot, production image, school document or user data is part of the OCR distribution.
