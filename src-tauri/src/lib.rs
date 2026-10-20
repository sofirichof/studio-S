// Thin, stable proxy to the Anthropic Messages API.
// The API key stays in the Rust process (never exposed to the webview / page content),
// and there is no browser CORS to fight. All prompt/model/schema logic lives in the
// frontend and is passed in as `body`, so we can iterate on it without recompiling Rust.
#[tauri::command]
async fn anthropic_messages(api_key: String, body: serde_json::Value, betas: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body);
    if let Some(b) = betas.filter(|b| !b.is_empty()) {
        req = req.header("anthropic-beta", b);
    }
    let resp = req
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

// Streaming variant for long outputs (the in-app breakdown: a plan can run
// 25k+ tokens, which a single buffered response would time out on and leave
// the page silent for minutes). Reads the SSE stream, collects the text
// deltas, emits "anthropic-stream" {chars} every ~400 chars so the page can
// show progress, and returns {text, stop_reason, usage}. Same key handling
// as anthropic_messages; the request shape is the frontend's.
#[tauri::command]
async fn anthropic_messages_stream(
    app: tauri::AppHandle,
    api_key: String,
    mut body: serde_json::Value,
    betas: Option<String>,
) -> Result<serde_json::Value, String> {
    use futures_util::StreamExt;
    use tauri::Emitter;
    body["stream"] = serde_json::Value::Bool(true);
    let client = reqwest::Client::new();
    let mut req = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body);
    if let Some(b) = betas.filter(|b| !b.is_empty()) {
        req = req.header("anthropic-beta", b);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error reaching Anthropic: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error {}: {}", status.as_u16(), text));
    }
    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    let mut text = String::new();
    let mut stop_reason = String::new();
    let mut usage = serde_json::Value::Null;
    let mut emitted_at = 0usize;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&chunk));
        // SSE events are blank-line separated; each carries "data: {json}".
        while let Some(pos) = buf.find("\n\n") {
            let event = buf[..pos].to_string();
            buf.drain(..pos + 2);
            for line in event.lines() {
                let Some(data) = line.strip_prefix("data: ") else { continue };
                let v: serde_json::Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                match v["type"].as_str().unwrap_or("") {
                    "content_block_delta" => {
                        if v["delta"]["type"] == "text_delta" {
                            if let Some(t) = v["delta"]["text"].as_str() {
                                text.push_str(t);
                            }
                        }
                    }
                    "message_delta" => {
                        if let Some(s) = v["delta"]["stop_reason"].as_str() {
                            stop_reason = s.to_string();
                        }
                        if !v["usage"].is_null() {
                            usage = v["usage"].clone();
                        }
                    }
                    "error" => return Err(format!("Anthropic stream error: {}", v["error"])),
                    _ => {}
                }
            }
            if text.len() >= emitted_at + 400 {
                emitted_at = text.len();
                let _ = app.emit("anthropic-stream", serde_json::json!({ "chars": text.len() }));
            }
        }
    }
    Ok(serde_json::json!({ "text": text, "stop_reason": stop_reason, "usage": usage }))
}

// What the New-project page needs from a dropped or chosen path: the folder
// to attach, and any script-like text files in it so the breakdown can start
// without pasting. A dropped FILE counts too — its parent becomes the folder
// and, if it is text, it is the script.
#[derive(serde::Serialize)]
struct ScriptFile {
    name: String,
    content: String,
}
#[derive(serde::Serialize)]
struct FolderIntake {
    dir: String,
    files: Vec<ScriptFile>,
}
const SCRIPT_EXTS: [&str; 4] = ["txt", "md", "fountain", "markdown"];
const SCRIPT_MAX_BYTES: u64 = 400_000;

#[tauri::command]
fn read_script_files(path: String) -> Result<FolderIntake, String> {
    let p = std::path::Path::new(&path);
    let meta = std::fs::metadata(p).map_err(|e| format!("Can't read that path: {e}"))?;
    let is_script = |q: &std::path::Path| {
        q.extension()
            .and_then(|e| e.to_str())
            .map(|e| SCRIPT_EXTS.contains(&e.to_ascii_lowercase().as_str()))
            .unwrap_or(false)
    };
    let read = |q: &std::path::Path| -> Option<ScriptFile> {
        let m = std::fs::metadata(q).ok()?;
        if m.len() > SCRIPT_MAX_BYTES {
            return None;
        }
        let content = std::fs::read_to_string(q).ok()?;
        Some(ScriptFile { name: q.file_name()?.to_str()?.to_string(), content })
    };
    if meta.is_file() {
        let dir = p.parent().map(|d| d.display().to_string()).unwrap_or_default();
        let files = if is_script(p) { read(p).into_iter().collect() } else { Vec::new() };
        return Ok(FolderIntake { dir, files });
    }
    let mut files: Vec<ScriptFile> = Vec::new();
    for entry in std::fs::read_dir(p).map_err(|e| format!("Can't read that folder: {e}"))?.flatten() {
        let q = entry.path();
        if q.is_file() && is_script(&q) {
            if let Some(f) = read(&q) {
                files.push(f);
            }
        }
    }
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(FolderIntake { dir: p.display().to_string(), files })
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

// Scan a folder's top-level *.json files for a project plan and return the
// most-recently-modified match, if any.
//
// The recognised container key is "scenes" (current), with "concepts"/"tasks"
// still accepted for plans written by older handoffs. This gate MUST stay in
// step with scaffoldFromPlan() in src/store.js — 0.3.93 shipped a template
// emitting "scenes" while this function still only looked for "concepts", so
// every new plan was skipped here and the UI reported "no plan file found"
// before the importer ever saw it.
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
        if !(content.contains("\"scenes\"")
            || content.contains("\"concepts\"")
            || content.contains("\"tasks\""))
        {
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

// ── Studio S connector bridge ────────────────────────────────────────────────
// The app's data lives in the webview's localStorage, which nothing outside the
// window can read. So the store mirrors itself to one JSON file on every save,
// and the connector (connector/studio-s-mcp.cjs — an MCP server Claude runs)
// reads and writes that same file. Envelope: { rev, writer, at, doc }.
// The frontend owns the merge rule (store.js syncFromConnector); this side only
// moves bytes.
fn connector_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data folder: {e}"))?
        .join("connector");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Can't create {}: {e}", dir.display()))?;
    Ok(dir.join("store.json"))
}

#[tauri::command]
fn mirror_store(app: tauri::AppHandle, envelope: String) -> Result<(), String> {
    let path = connector_file(&app)?;
    // Write-then-rename so the connector never reads a half-written file.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, envelope).map_err(|e| format!("Can't write mirror: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("Can't replace mirror: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_connector_store(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = connector_file(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Can't read mirror: {e}")),
    }
}

// The connector packaged as a Claude Desktop extension (.mcpb), built by
// connector/build-mcpb.sh and bundled as a resource. Claude Desktop owns the
// file type, so `open` on it shows its install dialog — that is the whole
// "Set up the connector" flow, no manual JSON.
fn connector_installer_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .resolve("resources/studio-s.mcpb", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("No bundled connector package: {e}"))
}

#[tauri::command]
fn open_connector_installer(app: tauri::AppHandle) -> Result<String, String> {
    let p = connector_installer_path(&app)?;
    if !p.exists() {
        return Err(format!("Connector package missing at {}", p.display()));
    }
    std::process::Command::new("open")
        .arg(&p)
        .status()
        .map_err(|e| format!("Couldn't open the connector package: {e}"))?;
    Ok(p.display().to_string())
}

// The connector writes heartbeat.json next to the mirror file each time Claude
// launches it. Its presence is what the app calls "Connected to Claude".
#[tauri::command]
fn read_connector_heartbeat(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = connector_file(&app)?.with_file_name("heartbeat.json");
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Can't read heartbeat: {e}")),
    }
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
        .invoke_handler(tauri::generate_handler![anthropic_messages, anthropic_messages_stream, read_script_files, scan_plan_folder, open_claude_app, mirror_store, read_connector_store, open_connector_installer, read_connector_heartbeat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
