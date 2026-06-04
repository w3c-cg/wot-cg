#!/usr/bin/env python3
"""Generate static/data/videos.json from all Meetups/*/video.yaml files.

Also validates each file before including it; any invalid file causes a
non-zero exit so the CI build fails early.

Usage:
  python scripts/generate-video-archive.py
"""

import json
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is required. Install it with: pip install pyyaml")
    sys.exit(1)

YOUTUBE_ID_PATTERNS = [
    re.compile(r"youtube\.com/watch\?v=([\w-]+)"),
    re.compile(r"youtu\.be/([\w-]+)"),
]


def extract_youtube_id(url):
    for pattern in YOUTUBE_ID_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def process(path):
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    youtube_id = extract_youtube_id(data["youtube_url"])
    thumbnail = data.get("thumbnail") or (
        f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"
        if youtube_id
        else None
    )

    return {
        "meetup": data["meetup"],
        "title": data["title"],
        "date": str(data["date"]),
        "youtube_url": data["youtube_url"],
        "youtube_id": youtube_id,
        "thumbnail": thumbnail,
        "speakers": data.get("speakers", []),
        "description": data.get("description", ""),
    }


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    meetups_dir = os.path.join(repo_root, "Meetups")
    output_path = os.path.join(
        repo_root,
        "Tutorials", "whatiswot", "website", "static", "data", "videos.json",
    )

    # First validate all files (reuse validate script logic inline to keep this self-contained)
    validate_script = os.path.join(script_dir, "validate-video-yaml.py")
    if os.path.exists(validate_script):
        import subprocess
        result = subprocess.run(
            [sys.executable, validate_script],
            capture_output=False,
        )
        if result.returncode != 0:
            print("\nAborting generation due to validation errors.")
            sys.exit(1)
    else:
        print("Warning: validate-video-yaml.py not found; skipping pre-validation.")

    videos = []
    for entry in sorted(os.scandir(meetups_dir), key=lambda e: e.name):
        if not entry.is_dir():
            continue
        yaml_path = os.path.join(entry.path, "metadata.yaml")
        if not os.path.exists(yaml_path):
            continue
        try:
            video = process(yaml_path)
            videos.append(video)
            print(f"Included  {yaml_path}")
        except Exception as exc:
            print(f"ERROR processing {yaml_path}: {exc}", file=sys.stderr)
            sys.exit(1)

    # Newest meetup first
    videos.sort(key=lambda v: v["meetup"], reverse=True)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {len(videos)} video(s) to {output_path}")


if __name__ == "__main__":
    main()
