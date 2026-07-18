#!/usr/bin/env python3
"""
Download Cricsheet JSON archives for T20I, IPL, and T20 matches.
Cricsheet provides free ball-by-ball cricket data in JSON format.
"""

import os
import sys
import zipfile
import requests

RAW_DIR = os.path.join(os.path.dirname(__file__), "raw")

# Cricsheet JSON download URLs
ARCHIVES = {
    "t20i": "https://cricsheet.org/downloads/t20s_json.zip",  # All T20Is (men's + women's)
    "ipl": "https://cricsheet.org/downloads/ipl_json.zip",    # IPL matches
    "odi": "https://cricsheet.org/downloads/odis_json.zip",   # All ODIs (men's + women's)
    "lpl": "https://cricsheet.org/downloads/lpl_json.zip",    # Lanka Premier League
    "wpl": "https://cricsheet.org/downloads/wpl_json.zip",    # Women's Premier League
    "mlc": "https://cricsheet.org/downloads/mlc_json.zip",    # Major League Cricket (USA)
    "hundred": "https://cricsheet.org/downloads/hnd_json.zip",# The Hundred (men's + women's)
    # Marquee T20 franchise leagues — bucketed by folder in etl_cricsheet.py (FOLDER_FORMAT),
    # so they feed the "quality" recency blend (last-15) for T20 tours like The Hundred.
    "bbl": "https://cricsheet.org/downloads/bbl_json.zip",    # Big Bash League
    "wbbl": "https://cricsheet.org/downloads/wbb_json.zip",   # Women's Big Bash League
    "blast": "https://cricsheet.org/downloads/ntb_json.zip",  # Vitality Blast (English domestic T20)
    "psl": "https://cricsheet.org/downloads/psl_json.zip",    # Pakistan Super League
    "sa20": "https://cricsheet.org/downloads/sat_json.zip",   # SA20
    "ilt20": "https://cricsheet.org/downloads/ilt_json.zip",  # International League T20 (UAE)
    "cpl": "https://cricsheet.org/downloads/cpl_json.zip",    # Caribbean Premier League
}

def download_file(url: str, dest: str):
    """Download a file with progress indication."""
    print(f"  Downloading {url}...")
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))
    downloaded = 0
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = downloaded * 100 // total
                print(f"\r  {pct}% ({downloaded // 1024 // 1024}MB / {total // 1024 // 1024}MB)", end="", flush=True)
    print()


def extract_zip(zip_path: str, extract_to: str):
    """Extract a ZIP file."""
    print(f"  Extracting {zip_path}...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_to)
    json_count = len([f for f in os.listdir(extract_to) if f.endswith(".json")])
    print(f"  Found {json_count} JSON files in {extract_to}")


def main():
    os.makedirs(RAW_DIR, exist_ok=True)

    for name, url in ARCHIVES.items():
        extract_dir = os.path.join(RAW_DIR, name)
        zip_path = os.path.join(RAW_DIR, f"{name}.zip")

        # Skip if already extracted
        if os.path.isdir(extract_dir) and len(os.listdir(extract_dir)) > 10:
            print(f"[{name}] Already downloaded and extracted ({len(os.listdir(extract_dir))} files). Skipping.")
            continue

        print(f"[{name}] Downloading archive...")
        download_file(url, zip_path)

        os.makedirs(extract_dir, exist_ok=True)
        extract_zip(zip_path, extract_dir)

        # Clean up zip
        os.remove(zip_path)
        print(f"[{name}] Done.\n")

    print("All archives downloaded and extracted.")


if __name__ == "__main__":
    main()
