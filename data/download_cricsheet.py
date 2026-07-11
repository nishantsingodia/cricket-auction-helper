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
