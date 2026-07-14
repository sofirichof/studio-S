// Thin, stable proxy to the Anthropic Messages API.
// The API key stays in the Rust process (never exposed to the webview / page content),
// and there is no browser CORS to fight. All prompt/model/schema logic lives in the
// frontend and is passed in as `body`, so we can iterate on it without recompiling Rust.
#[tauri::command]
async fn anthropic_messages(api_key: String, body: serde_json::Value) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error reaching Anthropic: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Could not read Anthropic response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Anthropic API error {}: {}", status.as_u16(), text));
    }
    // Return the raw response JSON; the frontend extracts the text block and parses it.
    Ok(text)
}

// A project plan file found in an assets folder. The frontend parses `content`
// (the same JSON schema produced by the "Plan with Claude" prompt) and scaffolds
// concepts, shots, and the to-do list from it.
#[derive(serde::Serialize)]
struct PlanFile {
    name: String,
    content: String,
    modified: u64,
}

// Scan a folder's top-level *.json files for a project plan (one containing
// "concepts" or "tasks") and return the most-recently-modified match, if any.
#[tauri::command]
fn scan_plan_folder(dir: String) -> Result<Option<PlanFile>, String> {
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Can't read that folder: {e}"))?;
    let mut best: Option<PlanFile> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !(content.contains("\"concepts\"") || content.contains("\"tasks\"")) {
            continue;
        }
        let modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("plan.json")
            .to_string();
        if best.as_ref().map_or(true, |b| modified > b.modified) {
            best = Some(PlanFile { name, content, modified });
        }
    }
    Ok(best)
}

// Launch the Claude desktop app (com.anthropic.claudefordesktop). The webview
// can't launch native apps; `open -a` does. Falls back are handled in the frontend.
#[tauri::command]
fn open_claude_app() -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-a", "Claude"])
        .status()
        .map_err(|e| format!("Couldn't open the Claude app: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    // The updater plugin is desktop-only.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![anthropic_messages, scan_plan_folder, open_claude_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
