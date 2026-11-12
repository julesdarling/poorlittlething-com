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
MAX_ARCHIVE_BYTES = 0
TAG_SOURCES = REPOSITORY / "download-sources/tags"


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
            "name": f"{FOLDER}/assemblies/{source.name}",
            "bytes": len(data),
            "sha256": digest(data),
            "crc32": zlib.crc32(data),
            "triangles": triangles,
        })
    if not entries:
        raise ValueError("The product manifest has no STL files")
    return sorted(entries, key=lambda entry: entry["name"])


def collect_tags() -> list[dict]:
    manifest = json.loads((TAG_SOURCES / "manifest.json").read_text(encoding="utf-8"))
    entries = []
    for tag in manifest["tags"]:
        source = (TAG_SOURCES / tag["file"]).resolve()
        if source.parent != TAG_SOURCES.resolve() or source.suffix != ".stl":
            raise ValueError("Invalid tag source path")
        data = source.read_bytes()
        triangles = struct.unpack("<I", data[80:84])[0]
        if len(data) != 84 + 50 * triangles or digest(data) != tag["sha256"]:
            raise ValueError(f"Tag source does not match manifest: {source.name}")
        entries.append({"source": source, "name": f"{FOLDER}/tags/{source.name}",
                        "bytes": len(data), "sha256": digest(data),
                        "crc32": zlib.crc32(data), "triangles": triangles})
    if len(entries) != manifest["tag_count"]:
        raise ValueError("Tag manifest count mismatch")
    return sorted(entries, key=lambda entry: entry["name"])


def readme(assembly_count: int, tag_count: int, tags_only: bool = False) -> bytes:
    title = "TAG STL COLLECTION" if tags_only else "FULL STL COLLECTION"
    counts = f"{tag_count} individual tag STL files." if tags_only else (
        f"{assembly_count} assembly STL files and {tag_count} individual tag STL files.")
    details = ("Individual tag files retain body/front alignment.\n" if tags_only else
               "Assembly files contain the displayed printed geometry rather than laid-out\n"
               "production parts. Individual tag files retain body/front alignment.\n"
               "Nonprinted display elements such as cord, candles and hardware references\n"
               "are not included in the printed assemblies.\n")
    text = ("POOR LITTLE THING\n" + title + "\n\n" + counts
            + " Units: millimeters.\n\n" + details
            + "Import as millimeters and prepare layout and slicing for your printer\n"
              "and workflow.\n")
    return text.encode("utf-8")


def content_digest(entries: list[dict], readme_data: bytes, folder: str) -> str:
    members = [{"name": e["name"], "bytes": e["bytes"], "sha256": e["sha256"]}
               for e in entries]
    members.append({"name": f"{folder}/README.txt", "bytes": len(readme_data),
                    "sha256": digest(readme_data)})
    canonical = json.dumps({"schema": 2, "members": sorted(members, key=lambda m: m["name"])},
                           sort_keys=True, separators=(",", ":")).encode("utf-8")
    return digest(canonical)


def member_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_TIMESTAMP)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.internal_attr = 0
    info.extra = b""
    info.comment = b""
    return info


def write_archive(path: Path, entries: list[dict], readme_data: bytes, folder: str = FOLDER) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9, allowZip64=False) as archive:
        archive.comment = b""
        members = [(f"{folder}/README.txt", None)]
        members.extend((entry["name"], entry["source"]) for entry in entries)
        for name, source in sorted(members):
            data = readme_data if source is None else source.read_bytes()
            archive.writestr(member_info(name), data, compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=9)


def verify_archive(path: Path, entries: list[dict], readme_data: bytes, folder: str = FOLDER) -> list[dict]:
    expected = {entry["name"]: entry for entry in entries}
    expected[f"{folder}/README.txt"] = {
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
    parser.add_argument("--audit", type=Path, help="Optional private audit receipt")
    parser.add_argument("--verify-rebuild", action="store_true")
    parser.add_argument("--max-archive-bytes", type=int, default=MAX_ARCHIVE_BYTES,
                        help="Optional limit; default0 permits build-generated large ZIPs")
    args = parser.parse_args()
    assemblies = collect_stls()
    tags = collect_tags()
    tag_folder = "poor-little-thing-tags"
    tag_members = [{**entry, "name": f"{tag_folder}/{entry['source'].name}"} for entry in tags]
    jobs = [
        ("full", ARCHIVE.name, FOLDER, assemblies + tags, len(assemblies), len(tags)),
        ("tags", "poor-little-thing-tags.zip", tag_folder, tag_members, 0, len(tags)),
    ]
    public_manifest = {"schema": 1}
    audits = {}
    with tempfile.TemporaryDirectory(prefix="poor-little-thing-stls-") as temporary:
        for key, filename, folder, entries, assembly_count, tag_count in jobs:
            readme_data = readme(assembly_count, tag_count, key == "tags")
            path = Path(temporary) / filename
            write_archive(path, entries, readme_data, folder)
            members = verify_archive(path, entries, readme_data, folder)
            archive_data = path.read_bytes()
            if args.max_archive_bytes and len(archive_data) >= args.max_archive_bytes:
                raise ValueError(f"{key} archive exceeds configured limit")
            rebuilt_verified = False
            if args.verify_rebuild:
                rebuilt = Path(temporary) / ("rebuild-" + filename)
                write_archive(rebuilt, entries, readme_data, folder)
                if rebuilt.read_bytes() != archive_data:
                    raise ValueError(f"{key} archive rebuild differs")
                rebuilt_verified = True
            for entry in entries:
                if digest(entry["source"].read_bytes()) != entry["sha256"]:
                    raise ValueError("Source changed during packaging")
            destination = PUBLIC / "downloads" / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            pending = destination.with_name("." + filename + ".tmp")
            try:
                shutil.copyfile(path, pending)
                os.replace(pending, destination)
            finally:
                pending.unlink(missing_ok=True)
            info = {"url": "/downloads/" + filename, "bytes": len(archive_data),
                    "sha256": digest(archive_data),
                    "contentDigest": content_digest(entries, readme_data, folder),
                    "assemblyCount": assembly_count, "tagCount": tag_count,
                    "memberCount": len(members), "units": "mm"}
            public_manifest[key] = info
            audits[key] = {**info, "crc_verified": True,
                           "all_stls_match_sources_exactly": True,
                           "source_stls_unchanged": True,
                           "byte_identical_rebuild_verified": rebuilt_verified,
                           "fixed_timestamp": list(FIXED_TIMESTAMP),
                           "metadata_private_paths_and_names_absent": True,
                           "source_stl_bytes": sum(e["bytes"] for e in entries),
                           "readme": readme_data.decode("utf-8"), "members": members}
            print(json.dumps({"bundle": key, **info}), flush=True)
    (PUBLIC / "bundles-manifest.json").write_text(
        json.dumps(public_manifest, indent=2) + "\n", encoding="utf-8")
    if args.audit:
        args.audit.parent.mkdir(parents=True, exist_ok=True)
        args.audit.write_text(json.dumps({"zlib_version": zlib.ZLIB_RUNTIME_VERSION,
                                         "bundles": audits}, indent=2) + "\n",
                              encoding="utf-8")


if __name__ == "__main__":
    main()
