# Studio S connector

Lets Claude work inside your Studio S projects. It's an MCP server that runs on your Mac; nothing leaves the machine.

| Tool | Does |
|---|---|
| `list_projects` | Projects with shot counts |
| `get_project` | Concepts → scenes → shots with ids, labels, fields, purpose, models, lock state, references, logged outputs |
| `push_plan` | Creates a project from a plan JSON (same schema as the app's plan import) |
| `update_shot` | Edits shot fields / purpose / duration (refuses locked shots) |
| `compile_prompts` | Still + image-to-video prompts from Studio S's own compiler (`PromptCompile.compileShot`), or the locked prompt |
| `attach_output` | Logs a generated still/clip (URL or path, generation id, model, cost) on its shot |
| `set_output_verdict` | Marks a logged generation keep / mix / discard, with a note |

## Install

**From the app (easiest):** in Studio S click **Set up the connector** (sidebar, bottom). Claude Desktop opens with an install dialog; click Install. That's it.

**From a release:** download `studio-s.mcpb` from the [latest release](https://github.com/sofirichof/studio-S/releases) and double-click it. Claude Desktop installs it.

**From a checkout (developers):** either `bash connector/build-mcpb.sh` and open the resulting `src-tauri/resources/studio-s.mcpb`, or point Claude straight at the script:

```bash
claude mcp add --scope user studio-s -- node /path/to/studio-S/connector/studio-s-mcp.cjs
```

For Claude Desktop by hand, under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
"studio-s": { "command": "node", "args": ["/path/to/studio-S/connector/studio-s-mcp.cjs"] }
```

Set `STUDIO_S_STORE` to point at a different store file (useful for testing).

## How it reaches the data

The app keeps its store in the webview's localStorage. On every save it mirrors the store to
`~/Library/Application Support/com.supergood.studios/connector/store.json` through the
`mirror_store` Tauri command. The connector runs the real `store.js` against that file and
writes edits back as `writer: "connector"`. The app picks them up when it opens or regains
focus. The copy with the higher `_rev` wins. A store that has never been bridged publishes
itself and never adopts the file. If the app saves while the connector is mid-edit, the
connector refuses to write rather than overwrite.

Each time Claude Desktop launches the connector it writes `heartbeat.json` next to the mirror.
That is what the app's "Connected to Claude" indicator reads.

## Packaging

`connector/build-mcpb.sh` packs the connector plus the two app files it runs (`src/store.js`,
`src/promptcompile.js`) into `src-tauri/resources/studio-s.mcpb` using the manifest in
`connector/mcpb/manifest.json`. It runs before every `tauri dev` / `tauri build`, so the package
inside the app always matches the app's version, and `release.sh` publishes it with each release.

## Using it with Higgsfield → Premiere / After Effects

Claude connects the tools in order. Studio S itself still never generates:

1. `compile_prompts` returns the shot's prompt.
2. Higgsfield `generate_image` / `generate_video` runs with that prompt verbatim (it spends credits, so get a go first).
3. `attach_output` records the result and its cost on the shot.
4. The Higgsfield bridge's `pr_import_media` / `pr_add_to_timeline` (or `ae_import_image`) brings it into the edit.

ChatGPT isn't supported yet. It only accepts remote HTTPS connectors.
