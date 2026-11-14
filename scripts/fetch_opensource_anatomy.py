#!/usr/bin/env python3
"""
Fetch open-source CC-BY 4.0 anatomical reference organ .glb models from the
NIH / HuBMAP Human Reference Atlas (Visible Human Male dataset) into scripts/raw_organs/.
Falls back gracefully if any CDN endpoint is offline or versioned differently.
"""

from __future__ import annotations

import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw_organs"
RAW_DIR.mkdir(parents=True, exist_ok=True)

def hra_urls(ref_organ: str, filename: str) -> list[str]:
    """Generate ordered NIH / HuBMAP CDN URLs across latest and versioned releases."""
    versions = ("latest", "v1.4", "v1.3", "v1.2", "v1.1", "v1.0")
    return [
        f"https://cdn.humanatlas.io/digital-objects/ref-organ/{ref_organ}/{ver}/assets/{filename}"
        for ver in versions
    ]


# 25 NIH / HuBMAP Visible Human Male (CC-BY 4.0) 3D Reference Atlas objects
ORGAN_CANDIDATES: dict[str, list[str]] = {
    "skin": hra_urls("skin-male", "3d-vh-m-skin.glb"),
    "brain": hra_urls("brain-male", "3d-vh-m-allen-brain.glb"),
    "eye_l": hra_urls("eye-male-left", "3d-vh-m-eye-l.glb"),
    "eye_r": hra_urls("eye-male-right", "3d-vh-m-eye-r.glb"),
    "spinal_cord": hra_urls("spinal-cord-male", "3d-vh-m-spinal-cord.glb"),
    "heart": hra_urls("heart-male", "3d-vh-m-heart.glb"),
    "blood_vasculature": hra_urls("blood-vasculature-male", "3d-vh-m-blood-vasculature.glb"),
    "trachea": hra_urls("trachea-male", "3d-vh-m-trachea.glb"),
    "main_bronchus": hra_urls("main-bronchus-male", "3d-vh-m-main-bronchus.glb"),
    "lung": hra_urls("lung-male", "3d-vh-m-lung.glb"),
    "thymus": hra_urls("thymus-male", "3d-vh-m-thymus.glb"),
    "spleen": hra_urls("spleen-male", "3d-vh-m-spleen.glb"),
    "lymph_node": (
        hra_urls("lymph-vasculature-male", "3d-vh-m-lymph-vasculature.glb")
        + hra_urls("lymph-node-male-right", "3d-vh-m-lymph-node-r.glb")
        + hra_urls("lymph-node-male", "3d-vh-m-lymph-node.glb")
    ),
    "liver": hra_urls("liver-male", "3d-vh-m-liver.glb"),
    "pancreas": hra_urls("pancreas-male", "3d-vh-m-pancreas.glb"),
    "small_intestine": hra_urls("small-intestine-male", "3d-vh-m-small-intestine.glb"),
    "large_intestine": (
        hra_urls("large-intestine-male", "3d-sbu-m-large-intestine.glb")
        + hra_urls("large-intestine-male", "3d-vh-m-large-intestine.glb")
    ),
    "kidney_l": hra_urls("kidney-male-left", "3d-vh-m-kidney-l.glb"),
    "kidney_r": hra_urls("kidney-male-right", "3d-vh-m-kidney-r.glb"),
    "ureter_l": hra_urls("ureter-male-left", "3d-vh-m-ureter-l.glb"),
    "ureter_r": hra_urls("ureter-male-right", "3d-vh-m-ureter-r.glb"),
    "urinary_bladder": hra_urls("urinary-bladder-male", "3d-vh-m-urinary-bladder.glb"),
    "pelvis": hra_urls("pelvis-male", "3d-vh-m-pelvis.glb"),
    "knee_l": hra_urls("knee-male-left", "3d-vh-m-knee-l.glb"),
    "knee_r": hra_urls("knee-male-right", "3d-vh-m-knee-r.glb"),
}


def download_glb(url: str, timeout: float = 25.0) -> bytes | None:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ARES-MED-OS/1.0 (+https://github.com/nasa-space-apps)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            data = resp.read()
            if len(data) < 64 or data[:4] != b"glTF":
                return None
            return data
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def main() -> int:
    fetched = 0
    for organ_key, urls in ORGAN_CANDIDATES.items():
        target = RAW_DIR / f"{organ_key}.glb"
        if target.exists() and target.stat().st_size > 1024:
            print(f"[cached] {organ_key}: {target.name} ({target.stat().st_size} bytes)")
            fetched += 1
            continue

        saved = False
        for url in urls:
            data = download_glb(url)
            if data is not None:
                target.write_bytes(data)
                print(f"[ok]     {organ_key}: downloaded from {url} ({len(data)} bytes)")
                fetched += 1
                saved = True
                break
        if not saved:
            print(f"[fallback] {organ_key}: CDN unavailable or moved; Blender will synthesize high-detail anatomical mesh")

    print(f"Summary: {fetched}/{len(ORGAN_CANDIDATES)} NIH HRA reference organs available in {RAW_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
