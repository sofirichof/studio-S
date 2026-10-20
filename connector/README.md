# Studio S connector

An MCP server that gives Claude access to Studio S projects. It's local and stdio-only, with no dependencies.

| Tool | Does |
|---|---|
| `list_projects` | Projects with shot counts |
| `get_project` | Concepts → scenes → shots with ids, labels, fields, purpose, models, lock state, references, outputs |
| `push_plan` | Creates a project from a plan JSON (same schema as the app's plan import) |
| `update_shot` | Edits shot fields / purpose / duration (refuses locked shots) |
| `compile_prompts` | Still + image-to-video prompts from Studio S's own compiler (`PromptCompile.compileShot`), or the locked prompt |
| `attach_output` | Records a generated still/clip (URL or path, generation id, model) on its shot |

## How it reaches the data

The app keeps its store in the webview's localStorage. On every save it mirrors the store to
`~/Library/Application Support/com.supergood.studios/connector/store.json`, through the
`mirror_store` Tauri command. The connector runs the real `src/store.js` against that file and
writes edits back as `writer: "connector"`. The app picks them up when it opens or regains
focus. The copy with the higher `_rev` wins. If the app saves while the connector is
mid-edit, the connector refuses to write rather than overwrite.

This needs a Studio S build that includes the bridge. Older builds never write the file.

## Using it with Higgsfield → Premiere / After Effects

Claude connects the tools in order. Studio S itself still never generates:

1. `compile_prompts` returns the shot's prompt.
2. Higgsfield `generate_image` / `generate_video` runs with that prompt verbatim (it spends credits, so get a go first).
3. `attach_output` records the result on the shot.
4. The Higgsfield bridge's `pr_import_media` / `pr_add_to_timeline` (or `ae_import_image`) brings it into the edit.

## Install

Claude Code:

```bash
claude mcp add --scope user studio-s -- node /path/to/studio-S/connector/studio-s-mcp.cjs
```

Claude Desktop: add this to `~/Library/Application Support/Claude/claude_desktop_config.json` under `mcpServers`:

```json
"studio-s": { "command": "node", "args": ["/path/to/studio-S/connector/studio-s-mcp.cjs"] }
```

Set `STUDIO_S_STORE` to point at a different store file (useful for testing).

ChatGPT isn't supported yet. It only accepts remote HTTPS connectors.
