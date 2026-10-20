#!/usr/bin/env node
// Studio S connector — an MCP server (stdio) that lets Claude read and edit
// Studio S projects and compile shot prompts with the app's own compiler.
//
// How it reaches the data: the app mirrors its store to
//   ~/Library/Application Support/com.supergood.studios/connector/store.json
// on every save (see store.js "connector bridge"). This server loads that file
// into a fake localStorage, runs the REAL src/store.js and src/promptcompile.js
// against it, and writes changes back with writer:'connector'. The app adopts
// them when it next opens or regains focus.
//
// Rules carried over from the app:
//  - Studio S never generates. Generation happens in Claude through Higgsfield;
//    attach_output only records what was made.
//  - Prompts come from compileShot (or the shot's locked prompt), never from
//    the model.
//
// No dependencies. Run: node connector/studio-s-mcp.cjs

const fs = require('fs');
const path = require('path');
const os = require('os');

// Where the app's own store.js / promptcompile.js live. In the repo this file
// is connector/studio-s-mcp.cjs with them in ../src; inside the packaged
// Claude Desktop extension (see connector/build-mcpb.sh) it is server/index.js
// with them in ./src.
const SRC = [path.join(__dirname, '..', 'src'), path.join(__dirname, 'src')]
  .find((d) => fs.existsSync(path.join(d, 'store.js')));
if (!SRC) { process.stderr.write('studio-s connector: store.js not found next to ' + __dirname + '\n'); process.exit(1); }
const STORE_FILE = process.env.STUDIO_S_STORE ||
  path.join(os.homedir(), 'Library', 'Application Support', 'com.supergood.studios', 'connector', 'store.json');
const CONNECTOR_DIR = path.dirname(STORE_FILE);
const KEY = 'aifs.v1';
const VERSION = require('../package.json').version;

// The app can't see Claude Desktop's config, so the server leaves a note when
// Claude launches it: that is what "Connected to Claude" in the app means.
function heartbeat() {
  try {
    fs.mkdirSync(CONNECTOR_DIR, { recursive: true });
    fs.writeFileSync(path.join(CONNECTOR_DIR, 'heartbeat.json'), JSON.stringify({
      at: Date.now(), version: VERSION, pid: process.pid,
      from: path.basename(__dirname) === 'server' ? 'mcpb' : 'repo'
    }));
  } catch (e) { /* best effort */ }
}

// ── app code in a sandbox ──────────────────────────────────────────────────────
// A fresh context per call so every call sees the file as it is right now.
function withStore(fn, { write = false } = {}) {
  let env = null;
  if (fs.existsSync(STORE_FILE)) env = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  if (!env && write) throw new Error('No Studio S data found at ' + STORE_FILE + '. Open the Studio S app once (this connector needs the version with the connector bridge) so it publishes its projects.');
  const ls = {};
  if (env && env.doc) ls[KEY] = JSON.stringify(env.doc);
  const win = { localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } } };
  const run = new Function('window', 'console',
    fs.readFileSync(path.join(SRC, 'promptcompile.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(SRC, 'store.js'), 'utf8') + '\nreturn window;');
  // stdout is the MCP channel — app code must never print to it.
  const quiet = { log() {}, warn() {}, error: (...a) => process.stderr.write(a.join(' ') + '\n') };
  const w = run(win, quiet);
  const before = ls[KEY];
  const result = fn(w.Store, w.PromptCompile);
  if (write && ls[KEY] !== before) {
    const doc = JSON.parse(ls[KEY]);
    const fresh = fs.existsSync(STORE_FILE) ? JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) : null;
    if (fresh && env && fresh.rev !== env.rev) throw new Error('Studio S saved while this edit ran. Nothing was written; try again.');
    const rev = Math.max(doc._rev || 0, (env && env.rev) || 0) + 1;
    doc._rev = rev;
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ rev, writer: 'connector', at: Date.now(), doc }));
    fs.renameSync(tmp, STORE_FILE);
  }
  return result;
}

// ── shapes Claude sees ─────────────────────────────────────────────────────────
function shotView(Store, p, c, sc, sh) {
  const r = Store.resolveShotIn(p, sh) || { builder: sh.builder || {} };
  const b = r.builder || {};
  const fields = {};
  Store.shotFields().concat(['negative']).forEach((k) => { if (b[k]) fields[k] = b[k]; });
  return {
    ids: { projectId: p.id, conceptId: c.id, sceneId: sc.id, shotId: sh.id },
    label: sh.label || '', name: sh.name || '', status: sh.status || 'draft',
    purpose: b.purpose || '', duration: b.duration || '',
    stillModel: b.stillModel || '', videoModel: b.videoModel || '',
    fields, locked: !!sh.locked,
    reuseOf: r.reuse ? { concept: r.reuse.concept, label: r.reuse.label, ok: r.reuse.ok } : null,
    outputs: (sh.outputs || []).map((o) => ({ id: o.id, kind: o.kind, url: o.url, path: o.path, source: o.source, generationId: o.generationId, model: o.model,
      promptVersion: o.promptVersion || '', cost: o.cost || null, verdict: o.verdict || null, note: o.note || '', createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : '' }))
  };
}
function projectView(Store, p) {
  return {
    id: p.id, name: p.name, status: p.status, brief: p.brief || '',
    assetsFolder: p.assetsFolder || '', outputFolder: p.outputFolder || '',
    stylePrefix: Store.getStylePrefix ? Store.getStylePrefix(p.id) : '',
    references: (Store.listReferences(p.id) || []).map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
    concepts: (p.concepts || []).map((c) => ({
      id: c.id, name: c.name, kind: c.kind || '',
      scenes: (c.scenes || []).map((sc) => ({
        id: sc.id, name: sc.name,
        shots: (sc.shots || []).map((sh) => shotView(Store, p, c, sc, sh))
      }))
    }))
  };
}
function findShot(p, ids) {
  for (const c of p.concepts || []) for (const sc of c.scenes || []) for (const sh of sc.shots || []) {
    if (sh.id === ids.shotId) return { c, sc, sh };
  }
  return null;
}
function needProject(Store, id) {
  const p = Store.getProject(id);
  if (!p) throw new Error('No project with id ' + id + '. Use list_projects.');
  return p;
}

// Same starting state the Prompt Builder page uses before a shot's own builder
// is laid over it (promptbuilder.html `state` + seedFromActive).
const PAGE_DEFAULTS = { stillModel: 'gpt', videoModel: 'kling', density: 'few', lookMode: 'dp', camMode: 'specific', dp: 'deakins', comp: 'mc', shot: 'wide', angle: 'eye', lens: '24', move: 'push', depth: 'shallow', framing: [], charRefIds: [], propRefIds: [], locRefId: null, styleRefId: null, atTags: true, cameraIntent: '', offCamera: '', propState: '', purpose: '' };
const STILL_IDS = ['gpt', 'nano', 'seedream', 'imagen', 'ideogram', 'recraft', 'higgsfield'];
function compileFor(Store, PC, p, ids) {
  const hit = findShot(p, ids);
  if (!hit) throw new Error('No shot ' + ids.shotId + ' in project ' + p.id);
  const sh = hit.sh;
  const r = Store.resolveShotIn(p, sh);
  const b = (r && r.builder) || {};
  if (sh.locked && sh.locked.prompt) {
    return { source: 'locked', stills: sh.locked.prompt, video: sh.locked.video || '', stillModel: sh.locked.stillModel || b.stillModel || '', videoModel: sh.locked.videoModel || b.videoModel || '' };
  }
  const s = Object.assign({}, PAGE_DEFAULTS, b);
  const settings = Store.getSettings();
  if (settings.defaultVideoModel && b.videoModel === undefined) s.videoModel = settings.defaultVideoModel;
  s.videoModel = ({ sora: 'kling', runway: 'kling', seedance: 'higgsfield' })[s.videoModel] || s.videoModel;
  s.stillModel = ({ flux: 'gpt', mj: 'gpt' })[s.stillModel] || s.stillModel;
  const refIds = (s.charRefIds || []).concat(s.propRefIds || [], [s.locRefId, s.styleRefId]).filter(Boolean);
  const refs = refIds.map((id) => Store.getReference(id)).filter(Boolean);
  const stylePrefix = s.prefixOverride ? '' : (Store.getStylePrefix(p.id) || '');
  const out = PC.compileShot(s, { refs, stylePrefix });
  return Object.assign({ source: 'compiled', stillModel: s.stillModel, videoModel: s.videoModel,
    attachInOrder: refs.map((a) => a.name) }, out);
}

// ── tools ──────────────────────────────────────────────────────────────────────
const IDS = {
  type: 'object', required: ['projectId', 'conceptId', 'sceneId', 'shotId'],
  properties: { projectId: { type: 'string' }, conceptId: { type: 'string' }, sceneId: { type: 'string' }, shotId: { type: 'string' } }
};
const TOOLS = [
  {
    name: 'list_projects',
    description: 'List Studio S projects (id, name, status, shot count, last updated).',
    inputSchema: { type: 'object', properties: {} },
    run: () => withStore((Store) => Store.listProjects().map((p) => {
      let shots = 0; (p.concepts || []).forEach((c) => (c.scenes || []).forEach((s) => { shots += (s.shots || []).length; }));
      return { id: p.id, name: p.name, status: p.status, shots, updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : '' };
    }))
  },
  {
    name: 'get_project',
    description: 'Full Studio S project: concepts → scenes → shots with ids, labels (1A, 1B…), shot fields, purpose, models, lock state, references and any attached outputs. Use the ids from here for every shot tool.',
    inputSchema: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    run: (a) => withStore((Store) => projectView(Store, needProject(Store, a.projectId)))
  },
  {
    name: 'push_plan',
    description: 'Create a Studio S project from a plan (the same JSON the app imports from "Plan with Claude": scenes/concepts with shots and descriptive fields — facts only, never prompt text). Pass projectId to scaffold into an existing project instead of creating one.',
    inputSchema: { type: 'object', required: ['plan'], properties: {
      plan: { type: 'object', description: 'Plan object (same schema as a Studio S plan .json).' },
      projectName: { type: 'string' }, projectId: { type: 'string' }, brief: { type: 'string' } } },
    run: (a) => withStore((Store) => {
      let p = a.projectId ? needProject(Store, a.projectId) : Store.createProject({ name: a.projectName || a.plan.name || 'Untitled project', brief: a.brief || '' });
      Store.scaffoldFromPlan(p.id, JSON.stringify(a.plan));
      return projectView(Store, Store.getProject(p.id));
    }, { write: true })
  },
  {
    name: 'update_shot',
    description: 'Edit one shot: descriptive fields (subject, action, environment, cameraIntent, offCamera, propState, negative), purpose, or duration. Edits a locked shot only after it is unlocked in the app.',
    inputSchema: { type: 'object', required: ['ids'], properties: {
      ids: IDS, fields: { type: 'object', additionalProperties: { type: 'string' } },
      purpose: { type: 'string' }, duration: { type: 'string' } } },
    run: (a) => withStore((Store) => {
      const p = needProject(Store, a.ids.projectId);
      const hit = findShot(p, a.ids);
      if (!hit) throw new Error('No such shot.');
      if (hit.sh.locked) throw new Error('Shot ' + hit.sh.label + ' has a locked prompt. Unlock it in Studio S first.');
      // negative is a builder field outside SHOT_FIELDS ("Avoid:" tail on both stages).
      const valid = Store.shotFields().concat(['negative']);
      const bad = Object.keys(a.fields || {}).filter((k) => valid.indexOf(k) === -1);
      if (bad.length) throw new Error('Unknown fields: ' + bad.join(', ') + '. Valid: ' + valid.join(', '));
      const f = Object.assign({}, a.fields || {});
      if (f.negative !== undefined) { Store.updateShotBuilder(a.ids, { negative: String(f.negative) }); delete f.negative; }
      if (Object.keys(f).length) Store.updateShotFields(a.ids, f);
      if (a.purpose !== undefined && !Store.setShotPurpose(a.ids, a.purpose)) throw new Error('Invalid purpose. Valid: ' + Store.shotPurposes().map((x) => x.id || x).join(', '));
      if (a.duration !== undefined) Store.setShotDuration(a.ids, a.duration);
      const q = Store.getProject(p.id); const h = findShot(q, a.ids);
      return shotView(Store, q, h.c, h.sc, h.sh);
    }, { write: true })
  },
  {
    name: 'compile_prompts',
    description: 'The still and image-to-video prompts for one shot (or every shot in a project if only projectId is given), made by Studio S\'s own compiler — exactly what the app\'s Review step shows. Locked shots return their locked prompt. Use these verbatim for generation; do not rewrite them. attachInOrder lists reference images to attach, in order.',
    inputSchema: { type: 'object', properties: { ids: IDS, projectId: { type: 'string' } } },
    run: (a) => withStore((Store, PC) => {
      if (a.ids) return compileFor(Store, PC, needProject(Store, a.ids.projectId), a.ids);
      const p = needProject(Store, a.projectId);
      const out = [];
      (p.concepts || []).forEach((c) => (c.scenes || []).forEach((sc) => (sc.shots || []).forEach((sh) => {
        const ids = { projectId: p.id, conceptId: c.id, sceneId: sc.id, shotId: sh.id };
        out.push(Object.assign({ concept: c.name, label: sh.label, ids }, compileFor(Store, PC, p, ids)));
      })));
      return out;
    })
  },
  {
    name: 'attach_output',
    description: 'Record a generated still or clip on the shot it was made for (Higgsfield result URL or local file path, generation id, model, the prompt used, what it cost). Studio S does not generate — call this after generating elsewhere. Every generation should be logged this way.',
    inputSchema: { type: 'object', required: ['ids', 'kind'], properties: {
      ids: IDS, kind: { type: 'string', enum: ['still', 'video'] },
      url: { type: 'string' }, path: { type: 'string' }, source: { type: 'string', description: 'e.g. higgsfield' },
      generationId: { type: 'string' }, model: { type: 'string' }, prompt: { type: 'string', description: 'The exact prompt that was run (from compile_prompts). Versioned by hash.' },
      cost: { type: 'object', description: 'What it cost: { amount, unit: "credits"|"usd", estimated: true if a quote rather than a bill }.', properties: { amount: { type: 'number' }, unit: { type: 'string', enum: ['credits', 'usd'] }, estimated: { type: 'boolean' } } },
      note: { type: 'string' } } },
    run: (a) => withStore((Store) => {
      const rec = Store.attachShotOutput(a.ids, a);
      if (!rec) throw new Error('Could not attach: check the ids, and pass url or path.');
      return rec;
    }, { write: true })
  },
  {
    name: 'set_output_verdict',
    description: 'Mark a logged generation keep / mix / discard (or clear it with null) and optionally note what went wrong. outputId comes from get_project outputs[].id.',
    inputSchema: { type: 'object', required: ['ids', 'outputId'], properties: {
      ids: IDS, outputId: { type: 'string' }, verdict: { type: ['string', 'null'], enum: ['keep', 'mix', 'discard', null] }, note: { type: 'string' } } },
    run: (a) => withStore((Store) => {
      const r = Store.setOutputVerdict(a.ids, a.outputId, a.verdict === undefined ? null : a.verdict, a.note);
      if (!r) throw new Error('Could not set verdict: check ids/outputId, verdict must be keep, mix, discard or null.');
      return r;
    }, { write: true })
  }
];

// ── MCP over stdio (newline-delimited JSON-RPC) ────────────────────────────────
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    heartbeat();
    return send({ jsonrpc: '2.0', id, result: {
      protocolVersion: (params && params.protocolVersion) || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'studio-s', version: VERSION },
      instructions: 'Studio S holds the shot list. Flow per shot: compile_prompts → generate with Higgsfield using that prompt verbatim (only with the user\'s go — it spends credits) → attach_output → import into Premiere/After Effects via the Higgsfield bridge (name the project/bin first and wait for a go).'
    } });
  }
  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool ' + params.name } });
    try {
      const out = tool.run(params.arguments || {});
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } });
    } catch (e) {
      return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } });
    }
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { process.stderr.write('bad message: ' + e.message + '\n'); }
  }
});
