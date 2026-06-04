#!/usr/bin/env python3
"""Validate video.yaml files found in Meetups sub-folders.

Usage:
  python scripts/validate-video-yaml.py               # validate all Meetups/*/video.yaml
  python scripts/validate-video-yaml.py path/to/file  # validate specific file(s)

Exits with code 0 if all files are valid, 1 if any are invalid.
"""

import os
import re
import sys

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is required. Install it with: pip install pyyaml")
    sys.exit(1)

REQUIRED_FIELDS = ["meetup", "title", "date", "youtube_url", "speakers"]
YOUTUBE_PATTERN = re.compile(
    r"^https?://(www\.)?youtube\.com/watch\?v=[\w-]+"
    r"|^https?://youtu\.be/[\w-]+"
)
DATE_PATTERN = re.compile(r"^\d{2}-\d{2}-\d{4}$")


def validate(path):
    errors = []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return [f"YAML parse error: {e}"]
    except OSError as e:
        return [f"Cannot read file: {e}"]

    if not isinstance(data, dict):
        return ["File must contain a YAML mapping (key-value pairs)"]

    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Missing required field: '{field}'")

    if "meetup" in data and not isinstance(data["meetup"], int):
        errors.append(f"'meetup' must be an integer, got: {type(data['meetup']).__name__}")

    if "title" in data and not isinstance(data["title"], str):
        errors.append("'title' must be a string")
    elif "title" in data and not data["title"].strip():
        errors.append("'title' must not be empty")

    if "date" in data:
        date_str = str(data["date"])
        if not DATE_PATTERN.match(date_str):
            errors.append(f"'date' must be in DD-MM-YYYY format, got: '{date_str}'")

    if "youtube_url" in data:
        if not isinstance(data["youtube_url"], str):
            errors.append("'youtube_url' must be a string")
        elif not YOUTUBE_PATTERN.match(data["youtube_url"]):
            errors.append(
                f"'youtube_url' must be a valid YouTube URL "
                f"(youtube.com/watch?v=... or youtu.be/...), got: '{data['youtube_url']}'"
            )

    if "speakers" in data:
        if not isinstance(data["speakers"], list) or len(data["speakers"]) == 0:
            errors.append("'speakers' must be a non-empty list")
        else:
            for i, speaker in enumerate(data["speakers"]):
                if not isinstance(speaker, dict):
                    errors.append(f"speakers[{i}] must be a mapping with at least a 'name' key")
                elif "name" not in speaker or not str(speaker["name"]).strip():
                    errors.append(f"speakers[{i}] is missing required field 'name'")

    if "thumbnail" in data and not isinstance(data["thumbnail"], str):
        errors.append("'thumbnail' must be a string URL")

    if "description" in data and not isinstance(data["description"], str):
        errors.append("'description' must be a string")

    return errors


def find_yaml_files():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    meetups_dir = os.path.join(repo_root, "Meetups")

    files = []
    for entry in sorted(os.scandir(meetups_dir), key=lambda e: e.name):
        if entry.is_dir():
            yaml_path = os.path.join(entry.path, "metadata.yaml")
            if os.path.exists(yaml_path):
                files.append(yaml_path)
    return files


def main():
    files = sys.argv[1:] if len(sys.argv) > 1 else find_yaml_files()

    if not files:
        print("No video.yaml files found — nothing to validate.")
        sys.exit(0)

    all_valid = True
    for path in files:
        errors = validate(path)
        if errors:
            print(f"FAIL  {path}")
            for msg in errors:
                print(f"      - {msg}")
            all_valid = False
        else:
            print(f"OK    {path}")

    if not all_valid:
        print("\nValidation failed.")
        sys.exit(1)

    print(f"\nAll {len(files)} file(s) valid.")


if __name__ == "__main__":
    main()
