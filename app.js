(() => {
  const DATA = window.CALIBOTS_CONTENT;
  const STORE_KEY = 'calibots2-home-studio-v6';
  const app = document.getElementById('app');
  let toastTimer = null;
  let burstTimer = null;

  const state = loadState();
  warmVoices();
  render();

  if ('serviceWorker' in navigator && /^https?:$/i.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function baseProgress() {
    const progress = {};
    DATA.units.forEach((unit) => {
      progress[unit.id] = { stars: 0, badge: '' };
    });
    return progress;
  }

  function defaultState() {
    return {
      screen: 'home',
      mode: 'explore',
      focusedUnitId: 'u1',
      selectedUnitIds: ['u1'],
      exploreDeck: [],
      exploreIndex: 0,
      listenDeck: [],
      listenIndex: 0,
      listenChoices: [],
      matchLeft: [],
      matchRight: [],
      solvedIds: [],
      selectedAudioId: null,
      feedback: { type: '', text: '' },
      childName: 'Explorer',
      readerMode: 'pre',
      showSpanish: true,
      showEnglish: false,
      autoPrompt: true,
      speechRate: 0.72,
      sessionMinutes: 10,
      progress: baseProgress(),
      toast: null,
      burst: []
    };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw) return defaultState();
      const next = { ...defaultState(), ...raw };
      next.progress = { ...baseProgress(), ...(raw.progress || {}) };
      if (!Array.isArray(next.selectedUnitIds) || next.selectedUnitIds.length === 0) next.selectedUnitIds = ['u1'];
      return next;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      screen: state.screen,
      mode: state.mode,
      focusedUnitId: state.focusedUnitId,
      selectedUnitIds: state.selectedUnitIds,
      childName: state.childName,
      readerMode: state.readerMode,
      showSpanish: state.showSpanish,
      showEnglish: state.showEnglish,
      autoPrompt: state.autoPrompt,
      speechRate: state.speechRate,
      sessionMinutes: state.sessionMinutes,
      progress: state.progress
    }));
  }

  function focusedUnit() {
    return DATA.units.find((u) => u.id === state.focusedUnitId) || DATA.units[0];
  }

  function unitById(id) {
    return DATA.units.find((u) => u.id === id) || null;
  }

  function selectedUnits() {
    return state.selectedUnitIds.map(unitById).filter(Boolean);
  }

  function progressFor(unitId = state.focusedUnitId) {
    return state.progress[unitId];
  }

  function totalStars() {
    return Object.values(state.progress).reduce((sum, row) => sum + (row.stars || 0), 0);
  }

  function itemFromTuple(tuple, unit) {
    return {
      id: tuple[0],
      label: tuple[1],
      spanish: tuple[2],
      kind: tuple[3],
      value: tuple[4],
      category: tuple[5],
      unitId: unit.id,
      unitTitle: unit.title,
      accent: unit.accent
    };
  }

  function buildPool() {
    const pool = [];
    selectedUnits().forEach((unit) => {
      unit.items.forEach((item) => pool.push(itemFromTuple(item, unit)));
    });
    return pool.length ? pool : focusedUnit().items.map((item) => itemFromTuple(item, focusedUnit()));
  }

  function render() {
    const unit = focusedUnit();
    document.documentElement.style.setProperty('--accent', unit.accent);
    app.innerHTML = `
      <div class="shell">
        ${renderTopbar(unit)}
        <div class="layout">
          ${renderSidebar(unit)}
          <main class="main">${renderScreen(unit)}</main>
        </div>
        ${renderBottomNav()}
      </div>
      <div class="toast ${state.toast ? 'show' : ''}">${state.toast ? `<strong>${state.toast.title}</strong><span>${state.toast.message}</span>` : ''}</div>
      ${renderBurst()}
    `;
    bind();
    saveState();
  }

  function renderTopbar(unit) {
    return `
      <div class="topbar">
        <div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
        <div class="robot-icon">🤖</div>
        <div class="titlebox">
          <h1>${escapeHTML(DATA.title)}</h1>
          <p>${escapeHTML(unit.title)} · ${state.selectedUnitIds.length} ${state.selectedUnitIds.length === 1 ? 'unit' : 'units'} selected</p>
        </div>
        <div class="pill">⭐ ${totalStars()}</div>
      </div>
    `;
  }

  function renderSidebar(unit) {
    return `
      <aside class="sidebar">
        <section class="panel-dark">
          <h2 style="margin:0">Home Studio</h2>
          <p style="margin:6px 0 0">Audio-first English practice for a 5-year-old child.</p>
        </section>
        <section class="unit-list">
          ${DATA.units.map((entry, index) => `
            <button class="unit-button ${entry.id === unit.id ? 'active' : ''}" data-focus-unit="${entry.id}">
              <strong>Unit ${index + 1} · ${escapeHTML(entry.title)}</strong>
              <small>${escapeHTML(entry.theme)}</small>
              <small>${state.selectedUnitIds.includes(entry.id) ? '✓ In study plan' : '○ Not selected'} · ⭐ ${progressFor(entry.id).stars}</small>
            </button>
          `).join('')}
        </section>
        <section class="panel-dark">
          <h3 style="margin:0">Parent tips</h3>
          <ul>${DATA.tips.map((tip) => `<li>${escapeHTML(tip)}</li>`).join('')}</ul>
        </section>
      </aside>
    `;
  }

  function renderBottomNav() {
    const items = [
      ['home', '🏠', 'Home'],
      ['explore', '🧭', 'Explore'],
      ['listen', '🎧', 'Listen'],
      ['settings', '🛠️', 'Parent']
    ];
    return `
      <nav class="bottom-nav">
        ${items.map(([key, icon, label]) => `
          <button class="nav-button ${navActive(key) ? 'active' : ''}" data-nav="${key}">
            <span>${icon}</span>
            <span>${label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  }

  function navActive(key) {
    return (state.screen === 'home' && key === 'home') ||
      (state.screen === 'settings' && key === 'settings') ||
      (state.screen === 'activity' && state.mode === key);
  }

  function renderScreen(unit) {
    if (state.screen === 'settings') return renderSettings();
    if (state.screen === 'activity') {
      if (state.mode === 'explore') return renderExplore();
      if (state.mode === 'listen') return renderListen();
      return renderMatch();
    }
    return renderHome(unit);
  }

  function renderHome(unit) {
    return `
      <section class="hero">
        <div class="hero-bg" style="background:${escapeHTML(unit.gradient)}"></div>
        <div class="hero-inner">
          <div>
            <div class="eyebrow">Calibots 2 · Responsive study app</div>
            <h2>${escapeHTML(unit.title)}</h2>
            <p class="muted">${escapeHTML(unit.description)} The activities below now separate learning, listening and matching much more clearly.</p>
            <div class="chips" style="margin-top:14px">${unit.prompts.map((prompt) => `<span class="chip">${escapeHTML(prompt)}</span>`).join('')}</div>
            <div class="actions" style="margin-top:16px">
              <button class="button primary" data-mode="explore">🧭 Start explorer</button>
              <button class="button secondary" data-mode="listen">🎧 Listen & tap</button>
              <button class="button secondary" data-mode="match">🧩 Sound match</button>
            </div>
          </div>
          <div class="mascot">
            <div>
              <div class="mascot-bubble">🤖</div>
              <h3>Hello, ${escapeHTML(state.childName)}!</h3>
              <p class="muted">${state.readerMode === 'pre' ? 'Pre-reader mode is active.' : 'Reader support is active.'}</p>
              <div class="actions" style="justify-content:center;margin-top:12px">
                <button class="button soft" data-action="intro">🔊 Hear intro</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid-stats">
        ${[
          ['⭐', progressFor().stars, 'Stars in the focused unit'],
          ['📚', state.selectedUnitIds.length, 'Units selected for practice'],
          ['🧠', buildPool().length, 'Vocabulary cards in the study pool'],
          ['⏱️', `${state.sessionMinutes} min`, 'Target session length']
        ].map(([icon, value, text]) => `
          <article class="stat">
            <div class="iconbox">${icon}</div>
            <h3 style="margin:10px 0 4px">${value}</h3>
            <p class="muted" style="margin:0">${text}</p>
          </article>
        `).join('')}
      </section>

      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Study plan</div>
            <h2 style="margin:6px 0 0">Select one or many units</h2>
            <p class="muted" style="margin:6px 0 0">All activity modes use only the units you activate here.</p>
          </div>
          <div class="actions">
            <button class="button secondary" data-action="select-all-units">Select all</button>
            <button class="button secondary" data-action="only-focused-unit">Only focused</button>
          </div>
        </div>
        <div class="study-grid" style="margin-top:14px">
          ${DATA.units.map((entry, index) => `
            <article class="study-card">
              <div class="row">
                <strong>Unit ${index + 1}</strong>
                <button class="toggle-chip ${state.selectedUnitIds.includes(entry.id) ? 'on' : ''}" data-toggle-unit="${entry.id}">${state.selectedUnitIds.includes(entry.id) ? 'Selected' : 'Select'}</button>
              </div>
              <div><strong>${escapeHTML(entry.title)}</strong><p class="muted" style="margin:6px 0 0">${escapeHTML(entry.theme)}</p></div>
              <div class="muted">⭐ ${progressFor(entry.id).stars} · ${entry.items.length} cards</div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Play modes</div>
            <h2 style="margin:6px 0 0">Choose how to practice</h2>
            <p class="muted" style="margin:6px 0 0">Three clearer modes: explore, listen and sound match.</p>
          </div>
          <button class="button secondary" data-nav="settings">🛠️ Parent settings</button>
        </div>
        <div class="mode-grid" style="margin-top:14px">
          ${DATA.modes.map(([id, icon, title, desc]) => `
            <button class="mode-card" data-mode="${id}">
              <div class="iconbox">${icon}</div>
              <h3 style="margin:10px 0 4px">${escapeHTML(title)}</h3>
              <p class="muted" style="margin:0">${escapeHTML(desc)}</p>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderExplore() {
    const deck = state.exploreDeck.length ? state.exploreDeck : buildPool();
    const item = deck[state.exploreIndex] || deck[0];
    const percent = ((state.exploreIndex + 1) / Math.max(1, deck.length)) * 100;

    return `
      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Explorer mode</div>
            <h2 style="margin:6px 0 0">Explore the selected units</h2>
            <p class="muted" style="margin:6px 0 0">Big cards and calmer audio. Best for first contact.</p>
          </div>
          <button class="button secondary" data-action="go-home">🏠 Home</button>
        </div>
        <div class="activity-grid">
          <div class="stage">${renderVisual(item)}</div>
          <div>
            <h3 style="margin:0 0 6px;font-size:clamp(28px,4vw,44px)">${displayTitle(item)}</h3>
            <p class="muted">${escapeHTML(item.unitTitle)} · ${escapeHTML(item.category)}. Tap the speaker, listen and say it together.</p>
            <div class="labels"><span class="label">${escapeHTML(item.category)}</span><span class="label">${escapeHTML(item.unitTitle)}</span></div>
            <div class="actions" style="margin-top:14px">
              <button class="button primary" data-action="speak-current">🔊 Listen</button>
              <button class="button secondary" data-action="prev-item">⬅️ Previous</button>
              <button class="button secondary" data-action="next-item">Next ➡️</button>
            </div>
            <div class="progress"><span style="width:${percent}%"></span></div>
          </div>
        </div>
      </section>
    `;
  }

  function renderListen() {
    const current = state.listenDeck[state.listenIndex];
    const percent = (state.listenIndex / Math.max(1, state.listenDeck.length)) * 100;
    return `
      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Listen & Tap</div>
            <h2 style="margin:6px 0 0">Use your ears first</h2>
            <p class="muted" style="margin:6px 0 0">The answer is hidden. The child must hear the word and choose one of four pictures.</p>
          </div>
          <button class="button secondary" data-action="go-home">🏠 Home</button>
        </div>
        <div class="stage listener-stage">
          <div class="ear">🎧</div>
          <h3 style="margin:0 0 6px">Listen</h3>
          <p class="muted" style="margin:0">Tap the speaker and choose the correct picture.</p>
          <div class="actions" style="justify-content:center;margin-top:14px"><button class="button primary" data-action="repeat-prompt">🔊 Hear again</button></div>
          <div class="labels" style="justify-content:center;margin-top:12px"><span class="label">${escapeHTML(current.unitTitle)}</span></div>
        </div>
        <div class="choice-grid">${state.listenChoices.map((item) => `
          <button class="choice" data-choice="${item.id}">
            ${renderVisual(item, true)}
            <div class="name">${displayChoiceLabel(item)}</div>
          </button>
        `).join('')}</div>
        <div class="feedback ${state.feedback.type}">${state.feedback.text || ''}</div>
        <div class="progress"><span style="width:${percent}%"></span></div>
      </section>
    `;
  }

  function renderMatch() {
    return `
      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Sound Match</div>
            <h2 style="margin:6px 0 0">Hear a word, then match it</h2>
            <p class="muted" style="margin:6px 0 0">Tap a sound card on the left. Then choose the matching picture on the right.</p>
          </div>
          <button class="button secondary" data-action="go-home">🏠 Home</button>
        </div>
        <div class="match-grid">
          <div class="audio-list">
            ${state.matchLeft.map((item, index) => `
              <button class="audio-card ${state.selectedAudioId === item.id ? 'selected' : ''}" data-match-audio="${item.id}" ${state.solvedIds.includes(item.id) ? 'disabled' : ''}>
                <span class="audio-pill">🔊 ${showText() ? escapeHTML(item.label) : `Sound ${index + 1}`}</span>
                <span>${state.solvedIds.includes(item.id) ? '✓' : ''}</span>
              </button>
            `).join('')}
          </div>
          <div class="choice-grid">
            ${state.matchRight.map((item) => `
              <button class="match-card" data-match-visual="${item.id}" ${state.solvedIds.includes(item.id) ? 'disabled' : ''}>
                ${renderVisual(item, true)}
                <div class="name">${displayChoiceLabel(item)}</div>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="feedback ${state.feedback.type}">${state.feedback.text || ''}</div>
      </section>
    `;
  }

  function renderSettings() {
    return `
      <section class="card">
        <div class="header-row">
          <div>
            <div class="eyebrow">Parent controls</div>
            <h2 style="margin:6px 0 0">Settings</h2>
            <p class="muted" style="margin:6px 0 0">Adapt the experience for pre-readers and emergent readers.</p>
          </div>
          <button class="button secondary" data-action="go-home">🏠 Home</button>
        </div>
        <div class="settings-grid">
          <article class="setting-card">
            <h3 style="margin:0 0 8px">Child name</h3>
            <p class="muted" style="margin:0 0 12px">Used in greetings and feedback.</p>
            <input class="input" id="childName" maxlength="18" value="${escapeAttr(state.childName)}" placeholder="Explorer" />
          </article>
          <article class="setting-card">
            <h3 style="margin:0 0 8px">Session length</h3>
            <p class="muted" style="margin:0 0 12px">Choose the target duration for each practice block.</p>
            <select class="select" id="sessionMinutes">
              ${[8, 10, 12, 15].map((value) => `<option value="${value}" ${state.sessionMinutes === value ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </article>
          <article class="setting-card">
            <h3 style="margin:0 0 8px">Reading support</h3>
            <div class="toggle-row"><span>Pre-reader mode</span><button class="button ${state.readerMode === 'pre' ? 'primary' : 'secondary'}" data-action="toggle-reader">${state.readerMode === 'pre' ? 'Active' : 'Activate'}</button></div>
            <div class="toggle-row"><span>Show Spanish hints</span><button class="button ${state.showSpanish ? 'primary' : 'secondary'}" data-action="toggle-spanish">${state.showSpanish ? 'On' : 'Off'}</button></div>
            <div class="toggle-row"><span>Show English text</span><button class="button ${state.showEnglish ? 'primary' : 'secondary'}" data-action="toggle-english">${state.showEnglish ? 'On' : 'Off'}</button></div>
          </article>
          <article class="setting-card">
            <h3 style="margin:0 0 8px">Audio and progress</h3>
            <div class="toggle-row"><span>Auto-speak prompts</span><button class="button ${state.autoPrompt ? 'primary' : 'secondary'}" data-action="toggle-auto-prompt">${state.autoPrompt ? 'On' : 'Off'}</button></div>
            <div class="toggle-row"><span>Speech speed</span><select class="select" id="speechRate"><option value="0.62" ${state.speechRate === 0.62 ? 'selected' : ''}>Very slow</option><option value="0.72" ${state.speechRate === 0.72 ? 'selected' : ''}>Slow</option><option value="0.82" ${state.speechRate === 0.82 ? 'selected' : ''}>Normal</option></select></div>
            <div class="toggle-row"><span>Reset saved progress</span><button class="button warn" data-action="reset-progress">Reset</button></div>
          </article>
        </div>
      </section>
    `;
  }

  function renderBurst() {
    if (!state.burst.length) return '';
    return `<div class="burst">${state.burst.map((star) => `<span class="star" style="left:${star.left}%; bottom:${star.bottom}px; animation-delay:${star.delay}s">⭐</span>`).join('')}</div>`;
  }

  function bind() {
    app.querySelectorAll('[data-focus-unit]').forEach((button) => {
      button.onclick = () => {
        state.focusedUnitId = button.dataset.focusUnit;
        state.screen = 'home';
        clearFeedback();
        render();
      };
    });

    app.querySelectorAll('[data-toggle-unit]').forEach((button) => {
      button.onclick = () => toggleUnit(button.dataset.toggleUnit);
    });

    app.querySelectorAll('[data-mode]').forEach((button) => {
      button.onclick = () => startMode(button.dataset.mode);
    });

    app.querySelectorAll('[data-nav]').forEach((button) => {
      button.onclick = () => navigate(button.dataset.nav);
    });

    app.querySelectorAll('[data-action]').forEach((button) => {
      button.onclick = () => handleAction(button.dataset.action);
    });

    app.querySelectorAll('[data-choice]').forEach((button) => {
      button.onclick = () => chooseOption(button.dataset.choice);
    });

    app.querySelectorAll('[data-match-audio]').forEach((button) => {
      button.onclick = () => chooseAudio(button.dataset.matchAudio);
    });

    app.querySelectorAll('[data-match-visual]').forEach((button) => {
      button.onclick = () => chooseVisual(button.dataset.matchVisual);
    });

    const childName = document.getElementById('childName');
    if (childName) childName.oninput = (event) => { state.childName = sanitize(event.target.value) || 'Explorer'; saveState(); };

    const sessionMinutes = document.getElementById('sessionMinutes');
    if (sessionMinutes) sessionMinutes.onchange = (event) => { state.sessionMinutes = Number(event.target.value); toast('Session updated', `${state.sessionMinutes} minute sessions selected.`); render(); };

    const speechRate = document.getElementById('speechRate');
    if (speechRate) speechRate.onchange = (event) => { state.speechRate = Number(event.target.value); toast('Speech speed updated', 'New audio speed saved.'); render(); };
  }

  function navigate(key) {
    if (key === 'home') {
      state.screen = 'home';
      render();
      return;
    }
    if (key === 'settings') {
      state.screen = 'settings';
      render();
      return;
    }
    startMode(key);
  }

  function handleAction(action) {
    if (action === 'go-home') {
      state.screen = 'home';
      clearFeedback();
      render();
      return;
    }
    if (action === 'intro') {
      const unitTitles = selectedUnits().map((unit) => unit.title).join(', ');
      speak(`Hello ${state.childName}. Today we study ${unitTitles}.`, Math.min(state.speechRate, 0.72));
      return;
    }
    if (action === 'speak-current') {
      const item = state.exploreDeck[state.exploreIndex];
      if (item) speak(item.label);
      return;
    }
    if (action === 'prev-item') {
      const deck = state.exploreDeck.length ? state.exploreDeck : buildPool();
      state.exploreIndex = (state.exploreIndex - 1 + deck.length) % deck.length;
      render();
      if (state.autoPrompt) speak(deck[state.exploreIndex].label);
      return;
    }
    if (action === 'next-item') {
      const deck = state.exploreDeck.length ? state.exploreDeck : buildPool();
      const current = deck[state.exploreIndex];
      if (current) progressFor(current.unitId).stars += 1;
      state.exploreIndex = (state.exploreIndex + 1) % deck.length;
      reward();
      render();
      if (state.autoPrompt) speak(deck[state.exploreIndex].label);
      return;
    }
    if (action === 'repeat-prompt') {
      const current = state.listenDeck[state.listenIndex];
      if (current) speak(current.label);
      return;
    }
    if (action === 'toggle-reader') {
      state.readerMode = state.readerMode === 'pre' ? 'reader' : 'pre';
      if (state.readerMode === 'pre') state.showEnglish = false;
      render();
      return;
    }
    if (action === 'toggle-spanish') {
      state.showSpanish = !state.showSpanish;
      render();
      return;
    }
    if (action === 'toggle-english') {
      state.showEnglish = !state.showEnglish;
      if (state.showEnglish) state.readerMode = 'reader';
      render();
      return;
    }
    if (action === 'toggle-auto-prompt') {
      state.autoPrompt = !state.autoPrompt;
      render();
      return;
    }
    if (action === 'reset-progress') {
      if (confirm('Reset all stars and badges?')) {
        state.progress = baseProgress();
        toast('Progress reset', 'All saved progress was cleared.');
        render();
      }
      return;
    }
    if (action === 'select-all-units') {
      state.selectedUnitIds = DATA.units.map((unit) => unit.id);
      toast('Study plan updated', 'All units are selected.');
      render();
      return;
    }
    if (action === 'only-focused-unit') {
      state.selectedUnitIds = [state.focusedUnitId];
      toast('Study plan reset', 'Only the focused unit is selected.');
      render();
      return;
    }
  }

  function toggleUnit(unitId) {
    if (state.selectedUnitIds.includes(unitId)) {
      if (state.selectedUnitIds.length === 1) {
        toast('At least one unit', 'You need one active study unit.');
        return;
      }
      state.selectedUnitIds = state.selectedUnitIds.filter((id) => id !== unitId);
    } else {
      state.selectedUnitIds = [...state.selectedUnitIds, unitId];
    }
    toast('Study plan updated', `${state.selectedUnitIds.length} units selected.`);
    render();
  }

  function startMode(mode) {
    state.screen = 'activity';
    state.mode = mode;
    clearFeedback();
    const pool = shuffle(buildPool());

    if (mode === 'explore') {
      state.exploreDeck = pool;
      state.exploreIndex = 0;
      render();
      if (state.autoPrompt && pool[0]) setTimeout(() => speak(pool[0].label), 250);
      return;
    }

    if (mode === 'match') {
      state.matchLeft = pool.slice(0, Math.min(4, pool.length));
      state.matchRight = shuffle([...state.matchLeft]);
      state.solvedIds = [];
      state.selectedAudioId = null;
      render();
      return;
    }

    state.listenDeck = pool.slice(0, Math.min(8, pool.length));
    state.listenIndex = 0;
    state.listenChoices = buildChoices(state.listenDeck[0], pool);
    render();
    if (state.autoPrompt && state.listenDeck[0]) setTimeout(() => speak(state.listenDeck[0].label), 250);
  }

  function buildChoices(current, pool) {
    const wrong = shuffle(pool.filter((item) => item.id !== current.id)).slice(0, 3);
    return shuffle([current, ...wrong]);
  }

  function chooseOption(itemId) {
    const current = state.listenDeck[state.listenIndex];
    if (!current) return;

    if (itemId === current.id) {
      state.feedback = { type: 'ok', text: state.showSpanish ? '¡Muy bien!' : 'Great job!' };
      progressFor(current.unitId).stars += 1;
      reward();
      speak(`Great job. ${current.label}.`, Math.max(state.speechRate, 0.78));
      render();
      setTimeout(nextListenRound, 760);
    } else {
      state.feedback = { type: 'bad', text: state.showSpanish ? 'Intenta de nuevo' : 'Try again' };
      render();
      speak(`Try again. ${current.label}.`, Math.max(state.speechRate, 0.78));
    }
  }

  function nextListenRound() {
    state.listenIndex += 1;
    clearFeedback();
    const current = state.listenDeck[state.listenIndex];
    if (!current) {
      finishListenMode();
      return;
    }
    state.listenChoices = buildChoices(current, buildPool());
    render();
    if (state.autoPrompt) speak(current.label);
  }

  function finishListenMode() {
    const total = state.listenDeck.length || 1;
    const score = state.listenIndex;
    if (score >= Math.max(4, Math.ceil(total * 0.7))) {
      const badge = DATA.badges[(score + total) % DATA.badges.length];
      state.selectedUnitIds.forEach((id) => { state.progress[id].badge = badge; });
    }
    toast('Listen mode finished', `Correct items: ${score} / ${total}`);
    state.screen = 'home';
    render();
  }

  function chooseAudio(itemId) {
    if (state.solvedIds.includes(itemId)) return;
    state.selectedAudioId = itemId;
    render();
    const item = state.matchLeft.find((row) => row.id === itemId);
    if (item) speak(item.label);
  }

  function chooseVisual(itemId) {
    if (state.solvedIds.includes(itemId) || !state.selectedAudioId) return;

    if (itemId === state.selectedAudioId) {
      state.solvedIds.push(itemId);
      const match = state.matchRight.find((item) => item.id === itemId);
      if (match) progressFor(match.unitId).stars += 1;
      state.feedback = { type: 'ok', text: state.showSpanish ? '¡Pareja correcta!' : 'Perfect match!' };
      reward();
      state.selectedAudioId = null;
      render();
      speak('Perfect match.', Math.max(state.speechRate, 0.78));
      if (state.solvedIds.length >= state.matchLeft.length) {
        const badge = DATA.badges[(state.solvedIds.length + totalStars()) % DATA.badges.length];
        state.selectedUnitIds.forEach((id) => { state.progress[id].badge = badge; });
        toast('Match complete', 'All sound matches solved.');
        setTimeout(() => {
          state.screen = 'home';
          render();
        }, 600);
      }
    } else {
      state.feedback = { type: 'bad', text: state.showSpanish ? 'No coincide' : 'Not a match' };
      render();
      speak('Not a match. Try again.', Math.max(state.speechRate, 0.78));
    }
  }

  function renderVisual(item, small = false) {
    const cls = `visual${small ? ' small' : ''}`;
    if (!item) return '';
    if (item.kind === 'color') return `<div class="${cls}"><div class="swatch" style="background:${item.value}"></div></div>`;
    if (item.kind === 'number') return `<div class="${cls}"><div class="number">${item.value}</div></div>`;
    if (item.kind === 'shape') {
      const shape = item.value === 'triangle' ? '<div class="shape-triangle"></div>' : item.value === 'square' ? '<div class="shape-square"></div>' : '<div class="shape-circle"></div>';
      return `<div class="${cls}"><div class="shape-wrap">${shape}</div></div>`;
    }
    if (item.kind === 'size') {
      const px = item.value === 'big' ? (small ? 90 : 150) : (small ? 54 : 86);
      return `<div class="${cls}"><div class="size-dot" style="width:${px}px;height:${px}px"></div></div>`;
    }
    if (item.kind === 'icon') {
      return `<div class="${cls} svg-box">${iconSVG(item.value)}</div>`;
    }
    if (item.kind === 'body') {
      return `<div class="${cls} svg-box body-box">${bodySVG(item.value)}</div>`;
    }
    return `<div class="${cls}"><div class="emoji">${item.value}</div></div>`;
  }

  function iconSVG(name) {
    const c = {
      stroke: '#24314a',
      fill: '#ffffff',
      accent: '#6d5efc',
      accent2: '#38bdf8',
      warm: '#f59e0b',
      green: '#10b981',
      red: '#ef4444',
      gray: '#94a3b8'
    };
    const wrap = (inner, bg = '#f8fbff') => `
      <svg viewBox="0 0 120 120" class="icon-svg" aria-hidden="true">
        <rect x="6" y="6" width="108" height="108" rx="28" fill="${bg}"/>
        ${inner}
      </svg>`;
    switch (name) {
      case 'eraser': return wrap(`<rect x="28" y="44" width="52" height="26" rx="8" fill="#fda4af" stroke="${c.stroke}" stroke-width="4"/><path d="M80 44l12 12-12 14H64l16-26Z" fill="#fecdd3" stroke="${c.stroke}" stroke-width="4"/><path d="M34 73h52" stroke="${c.gray}" stroke-width="4" stroke-linecap="round"/>`);
      case 'pencil': return wrap(`<path d="M28 78 72 34l14 14-44 44H28z" fill="#fde68a" stroke="${c.stroke}" stroke-width="4"/><path d="M76 30l8-8 14 14-8 8z" fill="#fca5a5" stroke="${c.stroke}" stroke-width="4"/><path d="M28 78l10 10" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/>`);
      case 'book': return wrap(`<rect x="24" y="28" width="72" height="64" rx="10" fill="#60a5fa" stroke="${c.stroke}" stroke-width="4"/><path d="M60 28v64" stroke="#fff" stroke-width="4"/><path d="M34 44h16M34 56h22M34 68h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,'#eef6ff');
      case 'glue': return wrap(`<rect x="42" y="32" width="36" height="52" rx="10" fill="#bfdbfe" stroke="${c.stroke}" stroke-width="4"/><rect x="48" y="22" width="24" height="14" rx="5" fill="#60a5fa" stroke="${c.stroke}" stroke-width="4"/><path d="M50 54h20M50 64h20" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);
      case 'scissors': return wrap(`<circle cx="42" cy="76" r="12" fill="#fecaca" stroke="${c.stroke}" stroke-width="4"/><circle cx="78" cy="76" r="12" fill="#fecaca" stroke="${c.stroke}" stroke-width="4"/><path d="M48 68 78 38M72 68 42 38" stroke="${c.gray}" stroke-width="6" stroke-linecap="round"/>`);
      case 'backpack': return wrap(`<rect x="30" y="30" width="60" height="60" rx="16" fill="#f59e0b" stroke="${c.stroke}" stroke-width="4"/><path d="M44 32c0-10 8-16 16-16s16 6 16 16" stroke="${c.stroke}" stroke-width="4" fill="none"/><rect x="42" y="54" width="36" height="22" rx="8" fill="#fde68a" stroke="${c.stroke}" stroke-width="4"/>`);
      case 'chair': return wrap(`<rect x="34" y="28" width="34" height="26" rx="6" fill="#fcd34d" stroke="${c.stroke}" stroke-width="4"/><rect x="34" y="54" width="38" height="16" rx="5" fill="#fbbf24" stroke="${c.stroke}" stroke-width="4"/><path d="M38 70v20M66 70v20M34 34v30" stroke="${c.stroke}" stroke-width="4" stroke-linecap="round"/>`);
      case 'table': return wrap(`<rect x="24" y="36" width="72" height="16" rx="6" fill="#c08457" stroke="${c.stroke}" stroke-width="4"/><path d="M32 52v32M88 52v32" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/><path d="M44 52v24M76 52v24" stroke="#7c5a3c" stroke-width="4" stroke-linecap="round"/>`,'#fff7ed');
      case 'desk': return wrap(`<rect x="20" y="34" width="78" height="44" rx="8" fill="#bfdbfe" stroke="${c.stroke}" stroke-width="4"/><rect x="26" y="42" width="28" height="28" rx="4" fill="#e0f2fe" stroke="${c.stroke}" stroke-width="4"/><path d="M68 78v16M88 78v16" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="56" r="2" fill="${c.stroke}"/>`);
      case 'ruler': return wrap(`<rect x="20" y="48" width="80" height="18" rx="6" fill="#fde68a" stroke="${c.stroke}" stroke-width="4" transform="rotate(-12 60 57)"/><path d="M34 44v10M42 42v14M50 40v10M58 38v14M66 36v10M74 34v14M82 32v10" stroke="${c.stroke}" stroke-width="3" stroke-linecap="round"/>`);
      case 'ball': return wrap(`<circle cx="60" cy="60" r="28" fill="#ffffff" stroke="${c.stroke}" stroke-width="4"/><path d="M36 50c16 2 22 8 24 20M84 50c-10 6-16 10-18 22M44 38c10 10 24 10 32 0" stroke="#2563eb" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      case 'lamp': return wrap(`<path d="M44 34h32l-8 22H52z" fill="#fde68a" stroke="${c.stroke}" stroke-width="4"/><path d="M60 56v18" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/><rect x="46" y="74" width="28" height="8" rx="4" fill="#cbd5e1" stroke="${c.stroke}" stroke-width="4"/><path d="M60 28v-8M36 38l-8-6M84 38l8-6" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>`);
      case 'cup': return wrap(`<path d="M34 42h40v30a12 12 0 0 1-12 12H46a12 12 0 0 1-12-12z" fill="#fca5a5" stroke="${c.stroke}" stroke-width="4"/><path d="M74 48h10a10 10 0 0 1 0 20H74" fill="none" stroke="${c.stroke}" stroke-width="4"/><path d="M46 30c-4 6-4 10 0 14M60 28c-4 6-4 10 0 14" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>`);
      case 'board': return wrap(`<rect x="18" y="20" width="84" height="56" rx="8" fill="#14532d" stroke="${c.stroke}" stroke-width="4"/><path d="M28 34h40M28 46h52M28 58h32" stroke="#dcfce7" stroke-width="4" stroke-linecap="round"/><path d="M28 78h64" stroke="#92400e" stroke-width="5"/><path d="M34 78v18M86 78v18" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/>`);
      case 'door': return wrap(`<rect x="34" y="18" width="52" height="84" rx="8" fill="#c08457" stroke="${c.stroke}" stroke-width="4"/><circle cx="74" cy="60" r="4" fill="#fef3c7" stroke="${c.stroke}" stroke-width="3"/><path d="M42 32h36M42 48h36M42 64h36" stroke="#8b5e34" stroke-width="3"/>`,'#fff7ed');
      case 'window': return wrap(`<rect x="24" y="24" width="72" height="72" rx="10" fill="#e0f2fe" stroke="${c.stroke}" stroke-width="4"/><path d="M60 24v72M24 60h72" stroke="${c.stroke}" stroke-width="4"/><path d="M36 36h12M72 36h12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);
      case 'clock': return wrap(`<circle cx="60" cy="60" r="32" fill="#fff" stroke="${c.stroke}" stroke-width="4"/><path d="M60 60V42M60 60l14 10" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="60" r="4" fill="${c.red}"/><path d="M60 28v6M92 60h-6M28 60h6M60 92v-6" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>`);
      case 'computer': return wrap(`<rect x="24" y="24" width="72" height="46" rx="8" fill="#bfdbfe" stroke="${c.stroke}" stroke-width="4"/><rect x="32" y="32" width="56" height="30" rx="4" fill="#eff6ff"/><path d="M52 72h16M44 86h32" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round"/>`);
      case 'bottle': return wrap(`<rect x="46" y="20" width="28" height="14" rx="5" fill="#93c5fd" stroke="${c.stroke}" stroke-width="4"/><path d="M42 34h36v12c0 8 10 12 10 24 0 14-10 24-28 24S32 84 32 70c0-12 10-16 10-24z" fill="#bfdbfe" stroke="${c.stroke}" stroke-width="4"/><path d="M44 58h32" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);
      default: return wrap(`<circle cx="60" cy="60" r="28" fill="#e2e8f0" stroke="${c.stroke}" stroke-width="4"/>`);
    }
  }

  function bodySVG(part) {
    const stroke = '#24314a';
    const skin = '#f7c8a8';
    const skin2 = '#f5b995';
    const hair = '#2f2f39';
    const blush = '#f59e9e';

    const wrap = (inner, bg = '#fffaf5') => `
      <svg viewBox="0 0 120 120" class="icon-svg body-svg" aria-hidden="true">
        <rect x="6" y="6" width="108" height="108" rx="28" fill="${bg}"/>
        <circle cx="60" cy="60" r="39" fill="#ffffff" stroke="${stroke}" stroke-width="4"/>
        ${inner}
      </svg>`;

    switch (part) {
      case 'head':
        return wrap(`
          <circle cx="60" cy="60" r="22" fill="${skin}" stroke="${stroke}" stroke-width="3"/>
          <path d="M41 55c0-18 10-26 19-26 10 0 20 8 20 22v6H41Z" fill="${hair}"/>
          <circle cx="52" cy="60" r="2.6" fill="${stroke}"/>
          <circle cx="68" cy="60" r="2.6" fill="${stroke}"/>
          <path d="M54 70q6 5 12 0" stroke="${stroke}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle cx="46" cy="68" r="3" fill="${blush}" opacity="0.65"/>
          <circle cx="74" cy="68" r="3" fill="${blush}" opacity="0.65"/>
        `);
      case 'eyes':
        return wrap(`
          <ellipse cx="47" cy="60" rx="12" ry="9" fill="#fff" stroke="${stroke}" stroke-width="3"/>
          <ellipse cx="73" cy="60" rx="12" ry="9" fill="#fff" stroke="${stroke}" stroke-width="3"/>
          <circle cx="47" cy="60" r="5.5" fill="#1f2937"/>
          <circle cx="73" cy="60" r="5.5" fill="#1f2937"/>
          <circle cx="49" cy="58" r="1.8" fill="#fff"/>
          <circle cx="75" cy="58" r="1.8" fill="#fff"/>
          <path d="M35 48q12-8 24 0M61 48q12-8 24 0" stroke="${stroke}" stroke-width="3" fill="none" stroke-linecap="round"/>
        `);
      case 'nose':
        return wrap(`
          <path d="M60 36c10 0 18 7 18 17 0 7-5 10-8 13-1 1-2 2-2 3 0 3 3 5 7 5-3 6-10 10-17 10-11 0-20-8-20-18 0-7 5-11 11-15 4-3 7-7 11-15Z" fill="${skin}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="54" cy="78" r="2.4" fill="${skin2}"/>
          <circle cx="66" cy="78" r="2.4" fill="${skin2}"/>
        `);
      case 'mouth':
        return wrap(`
          <path d="M35 58q25 22 50 0v14c0 10-11 18-25 18S35 82 35 72Z" fill="#c24141" stroke="${stroke}" stroke-width="3"/>
          <path d="M37 58q23 14 46 0" stroke="${stroke}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M42 61h36" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
          <path d="M60 61v11" stroke="#ef9aa9" stroke-width="4" stroke-linecap="round"/>
        `);
      case 'ear':
        return wrap(`
          <path d="M60 34c13 0 24 10 24 23 0 7-3 12-7 16-5 5-7 8-7 12 0 5-4 9-10 9-6 0-10-4-10-10 0-7 5-11 9-15 4-4 7-7 7-12 0-5-3-8-7-8-5 0-8 4-8 9" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
          <path d="M56 58c6 2 10 8 10 14" fill="none" stroke="${skin2}" stroke-width="4" stroke-linecap="round"/>
        `);
      case 'hair':
        return wrap(`
          <path d="M30 72c0-28 14-44 30-44 17 0 30 16 30 41v8H30Z" fill="${hair}"/>
          <path d="M31 62c8-1 10-12 18-12 5 0 8 6 14 6 5 0 8-4 12-8 4-4 8-4 15-1" fill="none" stroke="#4b5563" stroke-width="4" stroke-linecap="round"/>
          <path d="M35 76h50" stroke="#1f2937" stroke-width="4" stroke-linecap="round" opacity="0.25"/>
        `,'#f7f3ff');
      case 'arm':
        return wrap(`
          <path d="M40 76c-7 0-12-5-12-12 0-5 3-10 8-12l22-10c7-3 15 0 18 7 3 7 0 15-7 18L52 74c-3 1-8 2-12 2Z" fill="${skin}" stroke="${stroke}" stroke-width="3"/>
          <path d="M69 49c4 0 8 3 9 7" fill="none" stroke="${skin2}" stroke-width="4" stroke-linecap="round"/>
        `);
      case 'hand':
        return wrap(`
          <path d="M48 82c-8 0-14-7-14-15V53c0-3 2-5 5-5s5 2 5 5v-12c0-3 2-5 5-5s5 2 5 5v11-15c0-3 2-5 5-5s5 2 5 5v15-10c0-3 2-5 5-5s5 2 5 5v15-7c0-3 2-5 5-5s5 2 5 5v21c0 10-8 18-18 18H48Z" fill="${skin}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
        `);
      case 'torso':
        return wrap(`
          <path d="M46 30c2 7 8 11 14 11s12-4 14-11c7 2 12 8 12 16v24c0 12-10 22-22 22h-8c-12 0-22-10-22-22V46c0-8 5-14 12-16Z" fill="${skin}" stroke="${stroke}" stroke-width="3"/>
          <circle cx="60" cy="56" r="2" fill="${skin2}"/>
          <circle cx="60" cy="66" r="2" fill="${skin2}"/>
          <path d="M51 45q9 6 18 0" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
        `);
      case 'leg':
        return wrap(`
          <path d="M48 34h24v18c0 7-3 13-7 18l-6 8v12c0 5-4 8-8 8h-2c-5 0-9-4-9-9V76c0-3 1-6 3-9l5-8V34Z" fill="${skin}" stroke="${stroke}" stroke-width="3"/>
          <path d="M60 34v40" stroke="${skin2}" stroke-width="4" stroke-linecap="round"/>
        `);
      case 'foot':
        return wrap(`
          <path d="M42 54c0-9 6-16 14-18l6 28c2 8 10 14 18 14h6c0 9-8 16-17 16H55c-7 0-13-5-13-12Z" fill="${skin}" stroke="${stroke}" stroke-width="3"/>
          <circle cx="73" cy="78" r="2" fill="${skin2}"/><circle cx="67" cy="80" r="2" fill="${skin2}"/><circle cx="61" cy="81" r="2" fill="${skin2}"/>
        `);
      default:
        return wrap(`<circle cx="60" cy="60" r="20" fill="${skin}" stroke="${stroke}" stroke-width="3"/>`);
    }
  }

  function displayTitle(item) {
    if (!item) return '';
    if (showText()) return state.showSpanish ? `${item.label} · ${item.spanish}` : item.label;
    return item.spanish;
  }

  function displayChoiceLabel(item) {
    if (showText()) return state.showSpanish ? `${item.label} · ${item.spanish}` : item.label;
    return '';
  }

  function showText() {
    return state.showEnglish || state.readerMode === 'reader';
  }

  function clearFeedback() {
    state.feedback = { type: '', text: '' };
  }

  function toast(title, message) {
    state.toast = { title, message };
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      render();
    }, 1800);
  }

  function reward() {
    state.burst = Array.from({ length: 8 }, (_, index) => ({
      left: 18 + Math.random() * 64,
      bottom: 80 + Math.random() * 120,
      delay: (index * 0.03).toFixed(2)
    }));
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      state.burst = [];
      render();
    }, 1000);
  }

  function speak(text, rate = state.speechRate) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.04;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((row) => /^en(-|_)/i.test(row.lang));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function warmVoices() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function sanitize(value) {
    return String(value || '').replace(/[<>]/g, '').trim().slice(0, 18);
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }
})();
