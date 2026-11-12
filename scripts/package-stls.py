#!/usr/bin/env python3
"""Package the website's current assembly STLs with reproducible ZIP metadata."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import struct
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile
import zlib

REPOSITORY = Path(__file__).resolve().parents[1]
PUBLIC = REPOSITORY / "public"
ARCHIVE = PUBLIC / "downloads/poor-little-thing-full-stl-collection.zip"
FOLDER = "poor-little-thing-stl-collection"
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
MAX_ARCHIVE_BYTES = 100_000_000


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def collect_stls() -> list[dict]:
    products = json.loads((PUBLIC / "products.json").read_text(encoding="utf-8"))
    entries = []
    names = set()
    for product in products:
        source_url = unquote(urlsplit(product["stl"]).path)
        source = (PUBLIC / source_url.lstrip("/")).resolve()
        if source.parent != (PUBLIC / "downloads").resolve():
            raise ValueError(f"STL must be in public/downloads: {product['id']}")
        if not source.name.endswith("-assembly-mm.stl") or source.name in names:
            raise ValueError(f"Invalid or repeated STL filename: {source.name}")
        data = source.read_bytes()
        triangles = struct.unpack("<I", data[80:84])[0]
        if len(data) != 84 + 50 * triangles:
            raise ValueError(f"Invalid binary STL: {source.name}")
        names.add(source.name)
        entries.append({
            "source": source,
            "source_url": source_url,
            "name": f"{FOLDER}/{source.name}",
            "bytes": len(data),
            "sha256": digest(data),
            "crc32": zlib.crc32(data),
            "triangles": triangles,
        })
    if not entries:
        raise ValueError("The product manifest has no STL files")
    return sorted(entries, key=lambda entry: entry["name"])


def readme(entries: list[dict]) -> bytes:
    text = (
        "POOR LITTLE THING\n"
        "STL COLLECTION\n\n"
        f"{len(entries)} assembly STL files. Units: millimeters.\n\n"
        "Each file contains the complete assembly displayed on the website.\n"
        "These are displayed assemblies rather than laid-out production parts.\n"
        "Import the files as millimeters and prepare the layout and slicing\n"
        "for your own printer and workflow.\n\n"
        "CONTENTS\n"
        + "".join(f"- {PurePosixPath(entry['name']).name}\n" for entry in entries)
    )
    return text.encode("utf-8")


def member_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_TIMESTAMP)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.internal_attr = 0
    info.extra = b""
    info.comment = b""
    return info


def write_archive(path: Path, entries: list[dict], readme_data: bytes) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9, allowZip64=False) as archive:
        archive.comment = b""
        members = [(f"{FOLDER}/README.txt", readme_data)]
        members.extend((entry["name"], entry["source"].read_bytes()) for entry in entries)
        for name, data in sorted(members):
            archive.writestr(member_info(name), data, compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=9)


def verify_archive(path: Path, entries: list[dict], readme_data: bytes) -> list[dict]:
    expected = {entry["name"]: entry for entry in entries}
    expected[f"{FOLDER}/README.txt"] = {
        "bytes": len(readme_data), "sha256": digest(readme_data),
        "crc32": zlib.crc32(readme_data),
    }
    records = []
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC verification failed")
        if set(archive.namelist()) != set(expected):
            raise ValueError("ZIP members do not match the collection")
        if len(archive.namelist()) != len(expected) or archive.comment:
            raise ValueError("Duplicate members or unexpected archive metadata")
        for info in archive.infolist():
            name = PurePosixPath(info.filename)
            if name.is_absolute() or ".." in name.parts:
                raise ValueError("Nonportable ZIP member path")
            if info.date_time != FIXED_TIMESTAMP or info.extra or info.comment:
                raise ValueError("Unexpected ZIP member metadata")
            if info.external_attr != (stat.S_IFREG | 0o644) << 16:
                raise ValueError("Unexpected ZIP member permissions")
            data = archive.read(info)
            reference = expected[info.filename]
            if (len(data) != reference["bytes"] or digest(data) != reference["sha256"]
                    or info.CRC != reference["crc32"]):
                raise ValueError(f"ZIP member differs from source: {info.filename}")
            records.append({
                "name": info.filename,
                "bytes": info.file_size,
                "compressed_bytes": info.compress_size,
                "sha256": digest(data),
                "crc32": f"{info.CRC:08x}",
                "timestamp": list(info.date_time),
                "source_matches_exactly": True,
            })
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", type=Path, help="Optional audit receipt outside the website")
    parser.add_argument("--verify-rebuild", action="store_true",
                        help="Confirm two independently generated archives are byte-identical")
    args = parser.parse_args()
    entries = collect_stls()
    readme_data = readme(entries)
    with tempfile.TemporaryDirectory(prefix="poor-little-thing-stls-") as temporary:
        path = Path(temporary) / ARCHIVE.name
        write_archive(path, entries, readme_data)
        members = verify_archive(path, entries, readme_data)
        archive_data = path.read_bytes()
        if len(archive_data) >= MAX_ARCHIVE_BYTES:
            raise ValueError("Compressed collection exceeds the 100 MB archive limit")
        rebuild_verified = False
        if args.verify_rebuild:
            rebuilt = Path(temporary) / "rebuild.zip"
            write_archive(rebuilt, entries, readme_data)
            if rebuilt.read_bytes() != archive_data:
                raise ValueError("Independent rebuild was not byte-identical")
            rebuild_verified = True
        for entry in entries:
            if digest(entry["source"].read_bytes()) != entry["sha256"]:
                raise ValueError("A source STL changed while packaging")
        ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
        pending = ARCHIVE.with_name(f".{ARCHIVE.name}.tmp")
        try:
            shutil.copyfile(path, pending)
            os.replace(pending, ARCHIVE)
        finally:
            pending.unlink(missing_ok=True)
    result = {
        "archive": "/downloads/" + ARCHIVE.name,
        "archive_bytes": len(archive_data),
        "archive_sha256": digest(archive_data),
        "stl_count": len(entries),
        "member_count": len(members),
        "source_stl_bytes": sum(entry["bytes"] for entry in entries),
        "source_triangles": sum(entry["triangles"] for entry in entries),
        "crc_verified": True,
        "all_member_stls_match_sources_exactly": True,
        "source_stls_unchanged": True,
        "fixed_zip_timestamp": list(FIXED_TIMESTAMP),
        "fixed_member_permissions": "0644",
        "archive_and_member_comments_empty": True,
        "extra_metadata_empty": True,
        "names_contain_only_brand_folder_and_public_filenames": True,
        "byte_identical_rebuild_verified": rebuild_verified,
        "compression": "DEFLATE level 9",
        "zlib_version": zlib.ZLIB_RUNTIME_VERSION,
        "readme": readme_data.decode("utf-8"),
        "members": members,
    }
    if args.audit:
        args.audit.parent.mkdir(parents=True, exist_ok=True)
        args.audit.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items()
                      if key not in {"members", "readme"}}, indent=2))


if __name__ == "__main__":
    main()
