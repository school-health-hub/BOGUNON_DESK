"""Create deterministic BRAND-01 assets from the user-approved raster source."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


EXPECTED_SHA256 = "73f26c85b6a5b463828a28afe668c7e5e4ecf493a2da8b6cd2912edc70720537"
EXPECTED_SIZE = (2172, 724)
SYMBOL_BOX = (120, 190, 480, 550)
WORDMARK_BOX = (80, 150, 2110, 590)
ICON_SIZES = (16, 24, 32, 48, 64, 128, 256)
WINDOWS_ASSETS = {
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def save_png(image: Image.Image, path: Path, size: int | None = None) -> None:
    output = image if size is None else image.resize((size, size), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    output.save(path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    source = args.source.resolve()
    root = args.root.resolve()

    if sha256(source) != EXPECTED_SHA256:
        raise SystemExit("The source SHA-256 does not match the approved BRAND-01 image.")

    with Image.open(source) as opened:
        if opened.size != EXPECTED_SIZE or opened.mode != "RGB":
            raise SystemExit(f"Unexpected source properties: {opened.size=} {opened.mode=}")
        original = opened.copy()

    brand_dir = root / "src" / "branding" / "assets"
    icon_dir = brand_dir / "icons"
    tauri_dir = root / "src-tauri" / "icons"
    brand_dir.mkdir(parents=True, exist_ok=True)
    icon_dir.mkdir(parents=True, exist_ok=True)

    preserved = brand_dir / "bogunon-desk-logo-original.png"
    shutil.copyfile(source, preserved)
    symbol = original.crop(SYMBOL_BOX)
    wordmark = original.crop(WORDMARK_BOX)
    save_png(symbol, brand_dir / "bogunon-desk-symbol.png")
    wordmark.save(brand_dir / "bogunon-desk-wordmark.png", format="PNG", optimize=True)

    for size in ICON_SIZES:
        save_png(symbol, icon_dir / f"bogunon-desk-symbol-{size}.png", size)

    save_png(symbol, tauri_dir / "32x32.png", 32)
    save_png(symbol, tauri_dir / "128x128.png", 128)
    save_png(symbol, tauri_dir / "128x128@2x.png", 256)
    save_png(symbol, tauri_dir / "icon.png", 512)
    for name, size in WINDOWS_ASSETS.items():
        save_png(symbol, tauri_dir / name, size)
    symbol.save(
        tauri_dir / "icon.ico",
        format="ICO",
        sizes=[(size, size) for size in ICON_SIZES],
    )
    symbol.resize((1024, 1024), Image.Resampling.LANCZOS).save(
        tauri_dir / "icon.icns",
        format="ICNS",
    )

    generated = [preserved, brand_dir / "bogunon-desk-symbol.png", brand_dir / "bogunon-desk-wordmark.png"]
    generated.extend(sorted(icon_dir.glob("*.png")))
    generated.extend(sorted(tauri_dir.glob("*")))
    manifest = {
        "source": {
            "file": preserved.relative_to(root).as_posix(),
            "sha256": sha256(preserved),
            "dimensions": list(EXPECTED_SIZE),
            "mode": "RGB",
            "transparent": False,
        },
        "derivation": {
            "symbolCrop": list(SYMBOL_BOX),
            "wordmarkCrop": list(WORDMARK_BOX),
            "resampling": "Pillow LANCZOS",
        },
        "files": [
            {"file": path.relative_to(root).as_posix(), "sha256": sha256(path), "bytes": path.stat().st_size}
            for path in generated
        ],
    }
    (brand_dir / "brand01-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


if __name__ == "__main__":
    main()
