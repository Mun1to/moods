// Reads the mods folder of a person for the window of a Tauri app. It gives back exactly what
// `runtime/node.js` gives: one `{ id, manifest, files }` per sub-folder, or an `error` that says why.
//
// 1. Copy this file into `src-tauri/src/` and add `mod read_mods;` to `lib.rs` or `main.rs`.
// 2. Add the command (Tauri 2) and register it in `invoke_handler`:
//
//      #[tauri::command]
//      fn read_mods(app: tauri::AppHandle) -> Vec<read_mods::ModInput> {
//          use tauri::Manager;
//          match app.path().app_data_dir() {
//              Ok(dir) => read_mods::read_mods_folder(&dir.join("mods")),
//              Err(_) => Vec::new(),
//          }
//      }
//
// 3. In the window: `startMods({ contract, mods: () => invoke("read_mods") })`.
//
// It needs `serde` with the `derive` feature, which every Tauri app already has.
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_FILE_BYTES: u64 = 256 * 1024;

#[derive(Serialize, Debug, Default)]
pub struct ModInput {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<BTreeMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Every mod inside `dir`, sorted by folder name. Never fails: a folder that is not there is an
/// empty list, and a mod that cannot be read comes back with its `error`. Links are not followed,
/// so a mod cannot point outside its own folder.
pub fn read_mods_folder(dir: &Path) -> Vec<ModInput> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect();
    names.sort();
    names.iter().map(|name| read_mod(&dir.join(name), name)).collect()
}

fn read_mod(folder: &Path, id: &str) -> ModInput {
    let id = id.to_string();
    let manifest = match read_small(&folder.join("mod.json"), MAX_MANIFEST_BYTES) {
        Ok(text) => text,
        Err(why) => {
            return ModInput { id, error: Some(format!("mod.json {why}")), ..Default::default() };
        }
    };
    let Ok(data) = serde_json::from_str::<serde_json::Value>(&manifest) else {
        return ModInput { id, manifest: Some(manifest), ..Default::default() };
    };
    if let Some(said) = data.get("id").and_then(|value| value.as_str()) {
        if said != id {
            let error = format!("the folder is called {id} but mod.json says the id is {said}");
            return ModInput { id, manifest: Some(manifest), error: Some(error), ..Default::default() };
        }
    }
    let file_name = match data.get("type").and_then(|value| value.as_str()) {
        Some("mood") => "mood.json",
        Some("style") => "style.css",
        Some("structure") => "structure.json",
        _ => return ModInput { id, manifest: Some(manifest), ..Default::default() },
    };
    let mut files = BTreeMap::new();
    match read_small(&folder.join(file_name), MAX_FILE_BYTES) {
        Ok(text) => {
            files.insert(file_name.to_string(), text);
        }
        Err(why) if why == "is missing" => {}
        Err(why) => {
            let error = format!("{file_name} {why}");
            return ModInput { id, manifest: Some(manifest), error: Some(error), ..Default::default() };
        }
    }
    ModInput { id, manifest: Some(manifest), files: Some(files), error: None }
}

fn read_small(file: &Path, limit: u64) -> Result<String, String> {
    let missing = || "is missing".to_string();
    let info = fs::symlink_metadata(file).map_err(|_| missing())?;
    if !info.is_file() {
        return Err(missing());
    }
    if info.len() > limit {
        let kb = |bytes: u64| (bytes as f64 / 1024.0).round() as u64;
        return Err(format!("is {} KB, the limit is {} KB", kb(info.len()), kb(limit)));
    }
    fs::read_to_string(file).map_err(|_| missing())
}
