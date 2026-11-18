"""Reads the mods folder of a person for the window of a Python app (pywebview or any other).

It gives back exactly what `runtime/node.js` gives: one `{ id, manifest, files }` per sub-folder,
or an `error` that says why. Only the standard library.

With pywebview, expose it and pass it to the plugin:

    window.expose(lambda: read_mods_folder(mods_dir))        # Python, as `read_mods`
    startMods({ contract, mods: () => pywebview.api.read_mods() })   // the window

Run as a script it prints the folder as JSON: `python read_mods.py <mods folder>`.
"""
import json
import os
import sys

MAX_MANIFEST_BYTES = 64 * 1024
MAX_FILE_BYTES = 256 * 1024
FILE_FOR_TYPE = {"mood": "mood.json", "style": "style.css", "structure": "structure.json"}
MISSING = "is missing"


def read_mods_folder(folder):
    """Every mod inside `folder`, sorted by folder name. Never raises: a folder that is not there
    is an empty list, and a mod that cannot be read comes back with its `error`. Links are not
    followed, so a mod cannot point outside its own folder."""
    try:
        with os.scandir(folder) as entries:
            names = sorted(
                entry.name for entry in entries
                if entry.is_dir(follow_symlinks=False) and not entry.name.startswith(".")
            )
    except OSError:
        return []
    return [_read_mod(os.path.join(folder, name), name) for name in names]


def _read_mod(folder, mod_id):
    manifest, why = _read_small(os.path.join(folder, "mod.json"), MAX_MANIFEST_BYTES)
    if manifest is None:
        return {"id": mod_id, "error": f"mod.json {why}"}
    try:
        data = json.loads(manifest)
    except ValueError:
        return {"id": mod_id, "manifest": manifest}
    said = data.get("id") if isinstance(data, dict) else None
    if isinstance(said, str) and said != mod_id:
        return {"id": mod_id, "manifest": manifest,
                "error": f"the folder is called {mod_id} but mod.json says the id is {said}"}
    kind = data.get("type") if isinstance(data, dict) else None
    file_name = FILE_FOR_TYPE.get(kind) if isinstance(kind, str) else None
    if not file_name:
        return {"id": mod_id, "manifest": manifest}
    text, why = _read_small(os.path.join(folder, file_name), MAX_FILE_BYTES)
    if text is None and why == MISSING:
        return {"id": mod_id, "manifest": manifest, "files": {}}
    if text is None:
        return {"id": mod_id, "manifest": manifest, "error": f"{file_name} {why}"}
    return {"id": mod_id, "manifest": manifest, "files": {file_name: text}}


def _read_small(file, limit):
    """The text of a small file, or None and the reason."""
    try:
        if os.path.islink(file) or not os.path.isfile(file):
            return None, MISSING
        size = os.path.getsize(file)
        if size > limit:
            return None, f"is {_kb(size)} KB, the limit is {_kb(limit)} KB"
        with open(file, encoding="utf-8", newline="") as handle:
            return handle.read(), ""
    except (OSError, UnicodeDecodeError):
        return None, MISSING


def _kb(size):
    # Rounds like JavaScript does, half up, so the three readers say the same number.
    return int(size / 1024 + 0.5)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_mods_folder(sys.argv[1] if len(sys.argv) > 1 else "."), ensure_ascii=False))
