// Studio S — demo seed (vanilla, no build step). Loaded after store.js.
// Exposes window.Seed. Builds a realistic, fully-governed US Bank workspace so
// the app demos as an "us" tool immediately (plan §9.5 ⑧). It ONLY calls the
// public Store API — it adds no store functions and mutates no schema.
//
// Idempotent + non-destructive: guarded on a client named "US Bank" already
// existing, so loadDemo() is safe to re-run and never duplicates or clobbers
// real user data.
//
// Real US Bank × NFL BTS context (not invented) is drawn from
// docs/workflow-case-study.md and the production reels: vertical BTS hype reel,
// Christian McCaffrey (#23, SF 49ers) at the LA Coliseum + a US Bank branded
// set, DNA-style dark-trap bed with a mid-reel beat switch, 15s hard cap, and
// the "the power of us" / "Official Bank of the NFL" end-card lockup.
(function () {
  var CLIENT_NAME = 'US Bank';

  function S() {
    if (!window.Store) throw new Error('Seed requires Store (load store.js first)');
    return window.Store;
  }

  function hasDemo() {
    return S().listClients().some(function (c) { return c.name === CLIENT_NAME; });
  }

  function counts() {
    var Store = S();
    return {
      clients: Store.listClients().length,
      projects: Store.listProjects().length,
      deliverables: Store.listDeliverables().length,
      versions: Store.listVersions().length,
      assets: Store.listAssets().length,
      people: Store.listPeople().length
    };
  }

  // One action → a client (brand kit + personas + phrasing + whitelists), a
  // Rotation project under it, two deliverables, three review rounds on the
  // hero cut, plus reference + generated assets. Returns a summary graph.
  function loadDemo() {
    var Store = S();

    // ── idempotency guard (B) ──
    if (hasDemo()) {
      var existing = Store.listClients().filter(function (c) { return c.name === CLIENT_NAME; })[0];
      return { seeded: false, skipped: true, reason: 'US Bank client already exists',
               clientId: existing && existing.id, counts: counts() };
    }

    // ── client: the governed source of truth (brand is read live, never snapshotted) ──
    var client = Store.createClient({
      name: CLIENT_NAME,
      brand: {
        styleLook: 'Warm field/stadium light, cinematic 35mm with documentary handheld energy; ' +
                   'fast-cut vertical BTS; dark "DNA."-style trap bed with a mid-reel beat switch; broadcast-hype pacing.',
        palette: ['#0C2074', '#E4002B', '#FFFFFF'], // US Bank navy, red, white
        logo: 'US Bank shield — white/reversed for dark footage; bottom-right bug.',
        mandatories: 'US Bank shield logo bug, bottom-right, full duration. Say "US Bank" (never "USB"). ' +
                     'End-card lockup: "the power of us" + "Official Bank of the NFL". ' +
                     'No competitor bank or non-sponsor logos in frame.',
        legal: 'NFL game/BTS footage requires league clearance before publish. Talent release on file for ' +
               'C. McCaffrey (#23). Music must be rights-clean (AI-generated/licensed) — no commercial tracks or ' +
               'real-artist references. On-field branding must not imply NFL endorsement beyond "Official Bank of the NFL".',
        personas: [
          { name: 'Season-ticket superfan', note: '49ers faithful; follows players off-field; values authenticity over polish' },
          { name: 'Casual NFL viewer', note: 'watches nationally-televised games; recognizes CMC; not yet a banking customer' },
          { name: 'US Bank cardholder', note: 'existing customer; responds to "the power of us" community framing' }
        ],
        phrasingRules: [
          'Official Bank of the NFL',
          'the power of us',
          'US Bank (never "USB" or "U.S. Bank" in supers)'
        ],
        whitelists: [
          { name: 'Approved talent', values: ['Christian McCaffrey (#23, SF 49ers)', 'Brock Purdy'] },
          { name: 'Teams', values: ['San Francisco 49ers'] },
          { name: 'Approved jersey numbers', values: ['23'] },
          'LA Memorial Coliseum (approved location)'
        ]
      }
    });

    // ── people (maker + client reviewer) ──
    var maker = Store.createPerson({ name: 'Sofia Gonzalez', role: 'maker', email: 'sofia@gosupergood.com' });
    var reviewer = Store.createPerson({ name: 'US Bank Brand Team', role: 'reviewer', email: '' });

    // ── project: the real Rotation work, under the governed client ──
    var project = Store.createProject({
      name: 'Rotation 4 social — USB',
      clientId: client.id,
      status: 'active',
      brief: 'Vertical BTS hype reel from the US Bank × NFL shoot with Christian McCaffrey at the LA Memorial ' +
             'Coliseum and a US Bank-branded set. Fast-cut, broadcast-energy; DNA-style dark trap bed with a ' +
             'mid-reel beat switch (~0:06.7). Hard 15s cap. End-card lockup: "the power of us" / "Official Bank ' +
             'of the NFL". Deliver 9:16 for Meta/Reels; :06 cutdown for paid.',
      timeline: { start: '2026-07-01', end: '2026-07-15' },
      team: [
        { personId: maker.id, name: maker.name, role: 'maker' },
        { personId: reviewer.id, name: reviewer.name, role: 'reviewer' }
      ]
    });

    // Copy-once pre-fill of deliverable legal from the LIVE brand — exactly what
    // the new-deliverable modal does (proves ⑦: governed at create, overridable after).
    var brandLegal = (Store.getProjectBrand(project.id) || {}).legal || '';

    // ── deliverables ──
    var hero = Store.createDeliverable(project.id, {
      name: 'BTS Hype Reel — :15 · 9:16',
      status: 'in-review',
      specs: { ratio: '9:16', runtime: '0:15', platform: 'Meta / Instagram Reels', legal: brandLegal }
    });
    var cutdown = Store.createDeliverable(project.id, {
      name: 'BTS Cutdown — :06 · 9:16',
      status: 'not-started',
      specs: { ratio: '9:16', runtime: '0:06', platform: 'Paid social (Meta / TikTok)', legal: brandLegal }
    });

    // ── review rounds on the hero cut (registerCut → cut asset + version row) ──
    // Real R1→R3 history: gives Finish and the hub live state, current = R3 needs-review.
    Store.registerCut(hero.id, {
      name: 'R1 string-out', cutType: 'rough', round: 1, reviewer: reviewer.name,
      status: 'changes', frameioUrl: 'https://f.io/usbank-bts-r1',
      note: 'Killed monthly-statement soundbite; wants a new song + fresh footage.'
    });
    Store.registerCut(hero.id, {
      name: 'R2 rough', cutType: 'rough', round: 2, reviewer: reviewer.name,
      status: 'changes', frameioUrl: 'https://f.io/usbank-bts-r2',
      note: 'Different footage; still landscape — flip to true 9:16, add the beat switch.'
    });
    var r3 = Store.registerCut(hero.id, {
      name: 'R3 v1 fine cut', cutType: 'fine', round: 3, reviewer: reviewer.name,
      status: 'needs-review', frameioUrl: 'https://f.io/usbank-bts-r3',
      note: 'DNA-style track, beat switch @0:06.7, 15s hard cap; power-of-us end card.'
    });

    // ── assets: references (Brands & Assets) + one generated still (Generate surface) ──
    Store.createAsset({ type: 'reference', projectId: project.id, kind: 'character',
      name: 'Christian McCaffrey — talent reference',
      note: '#23 SF 49ers; approved talent, release on file.' });
    Store.createAsset({ type: 'reference', projectId: project.id, kind: 'location',
      name: 'US Bank set + LA Coliseum — location',
      note: 'Branded office/branch set + stadium; set-dressing continuity.' });
    Store.createAsset({ type: 'reference', projectId: project.id, kind: 'style',
      name: 'Look & sound board — DNA-style dark trap',
      note: 'Cinematic 35mm, warm field light; rights-clean ~140-BPM trap bed with a beat switch.' });
    Store.createAsset({ type: 'generated', projectId: project.id, deliverableId: hero.id,
      name: 'End-card lockup — key still',
      recipe: { model: 'gpt-image', cost: 0.04,
        prompt: 'US Bank shield lockup "the power of us" over warm stadium bokeh, vertical 9:16, cinematic 35mm.' } });

    return {
      seeded: true,
      clientId: client.id,
      projectId: project.id,
      deliverableIds: [hero.id, cutdown.id],
      currentVersionId: r3 && r3.version && r3.version.id,
      counts: counts()
    };
  }

  window.Seed = { loadDemo: loadDemo, hasDemo: hasDemo, CLIENT_NAME: CLIENT_NAME };
})();
