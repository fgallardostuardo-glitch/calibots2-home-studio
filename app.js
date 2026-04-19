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
    if (item.kind === 'icon') return `<div class="${cls} svg-box">${objectSVG(item.value)}</div>`;
    if (item.kind === 'animal') return `<div class="${cls} svg-box">${animalSVG(item.value)}</div>`;
    if (item.kind === 'vehicle') return `<div class="${cls} svg-box">${vehicleSVG(item.value)}</div>`;
    if (item.kind === 'body') return `<div class="${cls} svg-box body-box">${bodySVG(item.value)}</div>`;
    return `<div class="${cls}"><div class="emoji">${item.value}</div></div>`;
  }

  function premiumSticker(inner, opts = {}) {
    const bg1 = opts.bg1 || '#f7fbff';
    const bg2 = opts.bg2 || '#eef6ff';
    const ring = opts.ring || '#b8cff5';
    const accent = opts.accent || '#d7e7ff';
    return `
      <svg viewBox="0 0 140 140" class="icon-svg" aria-hidden="true">
        <defs>
          <linearGradient id="cardGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${bg1}"/>
            <stop offset="100%" stop-color="${bg2}"/>
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#233862" flood-opacity="0.14"/>
          </filter>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.8" flood-color="#233862" flood-opacity="0.09"/>
          </filter>
        </defs>
        <rect x="8" y="8" width="124" height="124" rx="34" fill="url(#cardGrad)" stroke="${ring}" stroke-width="3.5"/>
        <circle cx="30" cy="24" r="10" fill="${accent}" opacity="0.72"/>
        <circle cx="116" cy="34" r="6" fill="${accent}" opacity="0.78"/>
        <circle cx="108" cy="112" r="7" fill="${accent}" opacity="0.45"/>
        <rect x="20" y="20" width="100" height="100" rx="28" fill="#ffffff" stroke="${ring}" stroke-width="3" filter="url(#shadow)"/>
        <g filter="url(#softShadow)">
          ${inner}
        </g>
      </svg>`;
  }

  function svgCard(inner, palette = {}) {
    return premiumSticker(inner, palette);
  }

  function objectSVG(name) {
    const s = '#25334d';
    switch (name) {
      case 'eraser':
        return svgCard(`
          <g transform="translate(20 26) rotate(-15 50 42)">
            <rect x="18" y="28" width="52" height="30" rx="10" fill="#f59eb2" stroke="${s}" stroke-width="4"/>
            <path d="M18 28h26v30H18z" fill="#ffd9e3" opacity="0.9"/>
            <path d="M28 24h42" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
            <path d="M22 60h46" stroke="#e7edf6" stroke-width="5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff8fb', bg2:'#fff1f6', ring:'#f5bfd1', accent:'#fee2ea'});
      case 'pencil':
        return svgCard(`
          <g transform="translate(18 16) rotate(-18 52 52)">
            <rect x="22" y="48" width="62" height="14" rx="7" fill="#ffd561" stroke="${s}" stroke-width="4"/>
            <rect x="68" y="48" width="16" height="14" rx="3" fill="#fb7185" stroke="${s}" stroke-width="4"/>
            <rect x="62" y="48" width="6" height="14" fill="#dbe1ea" stroke="${s}" stroke-width="4"/>
            <path d="M22 48 10 55l12 7z" fill="#e2b487" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M12 55l4 0" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
            <path d="M30 50h22" stroke="#fff6bf" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffdf2', bg2:'#fff7d9', ring:'#f3dc7f', accent:'#fff1a6'});
      case 'book':
        return svgCard(`
          <g transform="translate(18 24)">
            <path d="M18 24q8-10 24-10h30v56H44q-15 0-26 8z" fill="#5ba4f5" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M72 14q14 0 22 8v56q-10-8-26-8H44V24q8-10 28-10z" fill="#7ec0ff" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M56 20v50" stroke="#ffffff" stroke-width="4"/>
            <path d="M66 28h16M66 38h16M66 48h12" stroke="#eaf6ff" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef8ff', bg2:'#e6f1ff', ring:'#b8d6fa', accent:'#dbeafe'});
      case 'glue':
        return svgCard(`
          <g transform="translate(34 16)">
            <rect x="22" y="10" width="18" height="12" rx="5" fill="#5fa9ff" stroke="${s}" stroke-width="4"/>
            <path d="M18 22h26v10c0 7 10 11 10 26 0 18-12 30-28 30S-2 76-2 58c0-15 10-19 10-26V22z" fill="#8dc0ff" stroke="${s}" stroke-width="4"/>
            <rect x="8" y="36" width="46" height="18" rx="8" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <path d="M18 45h26" stroke="#7aaef1" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eff7ff', bg2:'#e6f1ff', ring:'#bfd8fb', accent:'#dbeafe'});
      case 'scissors':
        return svgCard(`
          <g transform="translate(18 18)">
            <circle cx="32" cy="70" r="12" fill="#ffc5d0" stroke="${s}" stroke-width="4"/>
            <circle cx="58" cy="70" r="12" fill="#ffc5d0" stroke="${s}" stroke-width="4"/>
            <path d="M38 64 82 18" stroke="#a7b5c9" stroke-width="7" stroke-linecap="round"/>
            <path d="M52 64 16 22" stroke="#a7b5c9" stroke-width="7" stroke-linecap="round"/>
            <circle cx="50" cy="52" r="4" fill="${s}"/>
          </g>
        `, {bg1:'#fbfcff', bg2:'#f2f6fb', ring:'#ced9e7', accent:'#e6edf6'});
      case 'backpack':
        return svgCard(`
          <g transform="translate(28 18)">
            <path d="M18 18c0-10 8-18 18-18s18 8 18 18" fill="none" stroke="${s}" stroke-width="4"/>
            <rect x="8" y="16" width="56" height="70" rx="18" fill="#ff9b54" stroke="${s}" stroke-width="4"/>
            <rect x="18" y="44" width="36" height="24" rx="8" fill="#ffd76b" stroke="${s}" stroke-width="4"/>
            <path d="M16 20c-8 8-10 18-10 34M56 20c8 8 10 18 10 34" fill="none" stroke="#d97838" stroke-width="4" stroke-linecap="round"/>
            <path d="M20 30h32" stroke="#ffcb94" stroke-width="5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff7ee', bg2:'#fff1e6', ring:'#f6c18a', accent:'#ffdcb4'});
      case 'chair':
        return svgCard(`
          <g transform="translate(30 22)">
            <rect x="6" y="4" width="40" height="26" rx="8" fill="#ffd767" stroke="${s}" stroke-width="4"/>
            <rect x="6" y="30" width="44" height="16" rx="6" fill="#f7bf3b" stroke="${s}" stroke-width="4"/>
            <path d="M10 46v28M42 46v28M6 12v34" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M14 12h22" stroke="#fff3c1" stroke-width="5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffdf2', bg2:'#fff6d8', ring:'#f0d778', accent:'#fff0ad'});
      case 'table':
        return svgCard(`
          <g transform="translate(18 28)">
            <rect x="10" y="10" width="76" height="14" rx="6" fill="#c9955d" stroke="${s}" stroke-width="4"/>
            <rect x="10" y="10" width="76" height="6" rx="4" fill="#ddb07d" opacity="0.9"/>
            <path d="M18 24v34M78 24v34M30 24v28M66 24v28" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff7ef', bg2:'#ffeedf', ring:'#efc89f', accent:'#ffe1be'});
      case 'desk':
        return svgCard(`
          <g transform="translate(18 22)">
            <rect x="14" y="12" width="74" height="12" rx="6" fill="#c8dbff" stroke="${s}" stroke-width="4"/>
            <rect x="16" y="24" width="34" height="34" rx="8" fill="#edf4ff" stroke="${s}" stroke-width="4"/>
            <rect x="50" y="24" width="38" height="20" rx="6" fill="#b9d0ff" stroke="${s}" stroke-width="4"/>
            <circle cx="43" cy="40" r="3" fill="${s}"/>
            <path d="M22 58v26M42 58v26M58 44v40M82 44v40" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eff7ff', bg2:'#e7f0ff', ring:'#bfd4fa', accent:'#dae8ff'});
      case 'ruler':
        return svgCard(`
          <g transform="translate(14 26) rotate(-12 56 44)">
            <rect x="8" y="34" width="96" height="20" rx="8" fill="#ffe272" stroke="${s}" stroke-width="4"/>
            <path d="M20 34v12M30 34v18M40 34v12M50 34v18M60 34v12M70 34v18M80 34v12M90 34v18" stroke="${s}" stroke-width="3" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffdf1', bg2:'#fff7d7', ring:'#efd878', accent:'#fff1ae'});
      case 'ball':
        return svgCard(`
          <g transform="translate(22 22)">
            <circle cx="48" cy="48" r="30" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <path d="M22 42c18 2 28 10 32 28M72 42c-12 6-18 12-20 28M30 24c8 9 34 9 40 0" stroke="#3b82f6" stroke-width="4" fill="none" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef7ff', bg2:'#e4f0ff', ring:'#bfd6fa', accent:'#dcebff'});
      case 'lamp':
        return svgCard(`
          <g transform="translate(20 14)">
            <path d="M24 22h42l-8 26H32z" fill="#ffe06d" stroke="${s}" stroke-width="4"/>
            <path d="M47 48v18" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
            <path d="M34 66h26l8 10H26z" fill="#b8c6d8" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M46 14V4M20 24l-8-6M70 24l8-6" stroke="#f2b63b" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffdf2', bg2:'#fff7d8', ring:'#f0d97c', accent:'#fff2b6'});
      case 'cup':
        return svgCard(`
          <g transform="translate(24 16)">
            <path d="M16 24h44v32c0 14-10 24-24 24h-4c-14 0-24-10-24-24z" fill="#ff9aa2" stroke="${s}" stroke-width="4"/>
            <path d="M60 34h12c8 0 14 6 14 14s-6 14-14 14H60" fill="none" stroke="${s}" stroke-width="4"/>
            <path d="M24 16c-4 8-4 12 0 16M40 12c-4 8-4 12 0 16" stroke="#b7c5d8" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff7fb', bg2:'#fff0f5', ring:'#f4bfd0', accent:'#ffddea'});
      case 'board':
        return svgCard(`
          <g transform="translate(14 12)">
            <rect x="10" y="10" width="92" height="58" rx="10" fill="#2f855a" stroke="${s}" stroke-width="4"/>
            <path d="M24 28h34M24 40h46M24 52h22" stroke="#d8f8e6" stroke-width="5" stroke-linecap="round"/>
            <path d="M16 68h80" stroke="#9a693a" stroke-width="5" stroke-linecap="round"/>
            <path d="M24 68v24M88 68v24" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#f0fbf4', bg2:'#e6f6ec', ring:'#bde5c9', accent:'#d8f3e1'});
      case 'door':
        return svgCard(`
          <g transform="translate(34 14)">
            <rect x="14" y="10" width="44" height="84" rx="10" fill="#cc9360" stroke="${s}" stroke-width="4"/>
            <path d="M24 28h24M24 44h24M24 60h24" stroke="#a76d3f" stroke-width="4" stroke-linecap="round"/>
            <circle cx="48" cy="54" r="4" fill="#ffe28d" stroke="${s}" stroke-width="3"/>
          </g>
        `, {bg1:'#fff7ef', bg2:'#fff0e5', ring:'#f0c7a0', accent:'#ffe1bf'});
      case 'window':
        return svgCard(`
          <g transform="translate(24 18)">
            <rect x="10" y="10" width="72" height="72" rx="12" fill="#e7f6ff" stroke="${s}" stroke-width="4"/>
            <path d="M46 10v72M10 46h72" stroke="${s}" stroke-width="4"/>
            <path d="M20 22h18M54 22h18" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e6f3ff', ring:'#bfd8fb', accent:'#dcebff'});
      case 'clock':
        return svgCard(`
          <g transform="translate(24 24)">
            <circle cx="46" cy="46" r="30" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <path d="M46 46V28M46 46l16 10" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
            <circle cx="46" cy="46" r="4" fill="#ff7f7f"/>
            <path d="M46 16v6M46 70v6M16 46h6M70 46h6" stroke="#aab8ca" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fafcff', bg2:'#f1f6fb', ring:'#cfd9e6', accent:'#e8eef7'});
      case 'computer':
        return svgCard(`
          <g transform="translate(18 20)">
            <rect x="10" y="10" width="84" height="50" rx="10" fill="#bcd6ff" stroke="${s}" stroke-width="4"/>
            <rect x="18" y="18" width="68" height="34" rx="6" fill="#eef6ff"/>
            <path d="M40 64h24M28 76h48" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
            <rect x="18" y="82" width="68" height="8" rx="4" fill="#d9e5f3" stroke="${s}" stroke-width="3"/>
          </g>
        `, {bg1:'#eff7ff', bg2:'#e7f0ff', ring:'#bfd5fb', accent:'#dbe9ff'});
      case 'bottle':
        return svgCard(`
          <g transform="translate(36 10)">
            <rect x="18" y="8" width="16" height="12" rx="4" fill="#5fa9ff" stroke="${s}" stroke-width="4"/>
            <path d="M14 20h24v10c0 8 10 12 10 28 0 20-12 34-26 34S-4 78-4 58c0-16 10-20 10-28z" fill="#a8d4ff" stroke="${s}" stroke-width="4"/>
            <path d="M8 42h36" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
            <path d="M8 52h36" stroke="#86b9ea" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e4f2ff', ring:'#bcd6fa', accent:'#d8e9ff'});
      default:
        return svgCard(`<circle cx="70" cy="70" r="24" fill="#e5ecf7" stroke="${s}" stroke-width="4"/>`);
    }
  }

  function animalSVG(name) {
    const s = '#25334d';
    const faceWrap = (inner, palette = {}) => svgCard(inner, palette);
    switch (name) {
      case 'dog':
        return faceWrap(`
          <g transform="translate(18 18)">
            <path d="M36 52 18 26l18 8" fill="#b78356" stroke="${s}" stroke-width="4"/>
            <path d="M76 50 90 24 68 10" fill="#b78356" stroke="${s}" stroke-width="4"/>
            <circle cx="54" cy="58" r="28" fill="#d6a06f" stroke="${s}" stroke-width="4"/>
            <ellipse cx="54" cy="68" rx="14" ry="10" fill="#fff2e5" stroke="${s}" stroke-width="4"/>
            <circle cx="44" cy="58" r="3.3" fill="${s}"/><circle cx="64" cy="58" r="3.3" fill="${s}"/>
            <circle cx="54" cy="64" r="3.4" fill="${s}"/>
            <path d="M49 74q5 5 10 0" stroke="${s}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffaf4', bg2:'#fff2e8', ring:'#efcaa7', accent:'#ffe2c6'});
      case 'cat':
        return faceWrap(`
          <g transform="translate(18 14)">
            <path d="M34 34 44 12l10 18" fill="#ffb347" stroke="${s}" stroke-width="4"/>
            <path d="M64 34 74 12l10 18" fill="#ffb347" stroke="${s}" stroke-width="4"/>
            <circle cx="58" cy="58" r="28" fill="#ffbf53" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="56" r="3.3" fill="${s}"/><circle cx="68" cy="56" r="3.3" fill="${s}"/>
            <path d="M58 60l5 7h-10z" fill="#ff7b88"/>
            <path d="M54 72q4 4 8 0" stroke="${s}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <path d="M28 64h14M28 72h14M74 64h14M74 72h14" stroke="${s}" stroke-width="3.4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fffaf2', bg2:'#fff3e3', ring:'#f3d08d', accent:'#ffe7bc'});
      case 'lion':
        return faceWrap(`
          <g transform="translate(14 14)">
            <circle cx="56" cy="56" r="34" fill="#ffb23d" stroke="${s}" stroke-width="4"/>
            <circle cx="56" cy="60" r="22" fill="#f6cfaa" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="58" r="3.3" fill="${s}"/><circle cx="64" cy="58" r="3.3" fill="${s}"/>
            <path d="M56 62l5 6h-10z" fill="#ff7f7f"/>
            <path d="M52 72q4 4 8 0" stroke="${s}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff9ef', bg2:'#fff2df', ring:'#f2c287', accent:'#ffe0b0'});
      case 'tiger':
        return faceWrap(`
          <g transform="translate(16 14)">
            <path d="M34 34 46 14l10 18" fill="#ff9a47" stroke="${s}" stroke-width="4"/>
            <path d="M66 34 78 14l10 18" fill="#ff9a47" stroke="${s}" stroke-width="4"/>
            <circle cx="60" cy="58" r="28" fill="#ff9a47" stroke="${s}" stroke-width="4"/>
            <path d="M48 40l-5 10M60 36v12M72 40l5 10" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
            <ellipse cx="60" cy="70" rx="14" ry="9" fill="#fff3e6" stroke="${s}" stroke-width="4"/>
            <circle cx="50" cy="58" r="3.3" fill="${s}"/><circle cx="70" cy="58" r="3.3" fill="${s}"/>
          </g>
        `, {bg1:'#fff9f0', bg2:'#fff1df', ring:'#f1c490', accent:'#ffe4be'});
      case 'bear':
        return faceWrap(`
          <g transform="translate(18 16)">
            <circle cx="42" cy="28" r="11" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <circle cx="78" cy="28" r="11" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <circle cx="60" cy="58" r="28" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <ellipse cx="60" cy="70" rx="14" ry="10" fill="#efd3bb" stroke="${s}" stroke-width="4"/>
            <circle cx="50" cy="58" r="3.3" fill="${s}"/><circle cx="70" cy="58" r="3.3" fill="${s}"/>
            <circle cx="60" cy="67" r="3.5" fill="${s}"/>
          </g>
        `, {bg1:'#fff8f3', bg2:'#fff1e8', ring:'#eac7ac', accent:'#f9e2d1'});
      case 'mouse':
        return faceWrap(`
          <g transform="translate(14 14)">
            <circle cx="36" cy="34" r="15" fill="#e6e8ee" stroke="${s}" stroke-width="4"/><circle cx="84" cy="34" r="15" fill="#e6e8ee" stroke="${s}" stroke-width="4"/>
            <circle cx="36" cy="34" r="7" fill="#f6bfd0"/><circle cx="84" cy="34" r="7" fill="#f6bfd0"/>
            <circle cx="60" cy="62" r="26" fill="#e6e8ee" stroke="${s}" stroke-width="4"/>
            <circle cx="50" cy="60" r="3.3" fill="${s}"/><circle cx="70" cy="60" r="3.3" fill="${s}"/>
            <circle cx="60" cy="70" r="4" fill="#ff8898"/>
            <path d="M40 72h12M68 72h12" stroke="${s}" stroke-width="3.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fcfcff', bg2:'#f3f5fb', ring:'#d2d8e3', accent:'#eceff7'});
      case 'rabbit':
        return faceWrap(`
          <g transform="translate(20 10)">
            <ellipse cx="44" cy="24" rx="9" ry="22" fill="#ffffff" stroke="${s}" stroke-width="4"/><ellipse cx="66" cy="24" rx="9" ry="22" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <ellipse cx="44" cy="24" rx="4" ry="12" fill="#ffc5d8"/><ellipse cx="66" cy="24" rx="4" ry="12" fill="#ffc5d8"/>
            <circle cx="56" cy="62" r="24" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="60" r="3.3" fill="${s}"/><circle cx="64" cy="60" r="3.3" fill="${s}"/><circle cx="56" cy="68" r="3.5" fill="#ff94a6"/>
          </g>
        `, {bg1:'#fffcff', bg2:'#f6f3ff', ring:'#ddd0ff', accent:'#efe9ff'});
      case 'monkey':
        return faceWrap(`
          <g transform="translate(16 16)">
            <circle cx="28" cy="58" r="12" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <circle cx="84" cy="58" r="12" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <circle cx="56" cy="58" r="28" fill="#8d6345" stroke="${s}" stroke-width="4"/>
            <ellipse cx="56" cy="70" rx="16" ry="12" fill="#f1d4bb" stroke="${s}" stroke-width="4"/>
            <circle cx="46" cy="58" r="3.2" fill="${s}"/><circle cx="66" cy="58" r="3.2" fill="${s}"/><circle cx="56" cy="67" r="3.5" fill="${s}"/>
          </g>
        `, {bg1:'#fff8f2', bg2:'#fff1e5', ring:'#efc6a2', accent:'#fde1c8'});
      case 'gorilla':
        return faceWrap(`
          <g transform="translate(16 14)">
            <circle cx="34" cy="38" r="12" fill="#4b5563" stroke="${s}" stroke-width="4"/>
            <circle cx="78" cy="38" r="12" fill="#4b5563" stroke="${s}" stroke-width="4"/>
            <path d="M28 42c0-20 14-30 28-30s28 10 28 30v14c0 18-12 32-28 32S28 74 28 56Z" fill="#4b5563" stroke="${s}" stroke-width="4"/>
            <ellipse cx="56" cy="66" rx="18" ry="14" fill="#c2c6cf" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="56" r="3.2" fill="${s}"/><circle cx="64" cy="56" r="3.2" fill="${s}"/>
            <path d="M56 62v8" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#f8fafc', bg2:'#eef3f8', ring:'#cbd5e1', accent:'#e7edf5'});
      case 'giraffe':
        return faceWrap(`
          <g transform="translate(22 10)">
            <path d="M52 20 46 8M72 20 78 8" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
            <circle cx="50" cy="10" r="4" fill="#8b5e3c"/><circle cx="74" cy="10" r="4" fill="#8b5e3c"/>
            <path d="M40 84V40c0-8 6-14 14-14h16c8 0 14 6 14 14v44" fill="#f7c85b" stroke="${s}" stroke-width="4"/>
            <rect x="34" y="30" width="46" height="36" rx="18" fill="#f7c85b" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="42" r="4" fill="#8b5e3c"/><circle cx="66" cy="54" r="4" fill="#8b5e3c"/><circle cx="58" cy="34" r="4" fill="#8b5e3c"/>
            <circle cx="48" cy="48" r="3.2" fill="${s}"/><circle cx="66" cy="48" r="3.2" fill="${s}"/>
          </g>
        `, {bg1:'#fffaf1', bg2:'#fff1db', ring:'#efce8f', accent:'#ffe6b8'});
      case 'hippo':
        return faceWrap(`
          <g transform="translate(16 24)">
            <ellipse cx="60" cy="52" rx="34" ry="24" fill="#b8c0cf" stroke="${s}" stroke-width="4"/>
            <ellipse cx="34" cy="40" rx="10" ry="12" fill="#b8c0cf" stroke="${s}" stroke-width="4"/><ellipse cx="86" cy="40" rx="10" ry="12" fill="#b8c0cf" stroke="${s}" stroke-width="4"/>
            <ellipse cx="60" cy="62" rx="20" ry="12" fill="#d8dde7" stroke="${s}" stroke-width="4"/>
            <circle cx="50" cy="48" r="3.2" fill="${s}"/><circle cx="70" cy="48" r="3.2" fill="${s}"/>
            <circle cx="54" cy="63" r="2.8" fill="${s}"/><circle cx="66" cy="63" r="2.8" fill="${s}"/>
          </g>
        `, {bg1:'#fafcff', bg2:'#eef3fb', ring:'#cfd9e6', accent:'#e7eef7'});
      case 'snake':
        return faceWrap(`
          <g transform="translate(18 18)">
            <path d="M18 74c0-18 18-20 26-10 8 10 22 8 26-4 4-12-4-24-18-24-16 0-28 14-28 28 0 14 10 24 24 24 16 0 28-10 34-24" fill="none" stroke="#4caf50" stroke-width="12" stroke-linecap="round"/>
            <circle cx="94" cy="44" r="11" fill="#63c55e" stroke="${s}" stroke-width="4"/>
            <circle cx="90" cy="42" r="2.2" fill="${s}"/><circle cx="98" cy="42" r="2.2" fill="${s}"/>
            <path d="M94 48v8" stroke="#ff6b81" stroke-width="3" stroke-linecap="round"/>
          </g>
        `, {bg1:'#f5fff4', bg2:'#e8fbe8', ring:'#bee9c0', accent:'#d9f7db'});
      case 'elephant':
        return faceWrap(`
          <g transform="translate(12 16)">
            <circle cx="32" cy="44" r="16" fill="#c6ccd8" stroke="${s}" stroke-width="4"/>
            <circle cx="88" cy="44" r="16" fill="#c6ccd8" stroke="${s}" stroke-width="4"/>
            <circle cx="60" cy="56" r="28" fill="#c6ccd8" stroke="${s}" stroke-width="4"/>
            <path d="M54 60c0 8 3 12 6 18 2 5-1 11-6 11-5 0-8-6-6-11 3-6 6-10 6-18" fill="#b6becd" stroke="${s}" stroke-width="4"/>
            <circle cx="50" cy="54" r="3.2" fill="${s}"/><circle cx="70" cy="54" r="3.2" fill="${s}"/>
          </g>
        `, {bg1:'#fbfcff', bg2:'#eef2f8', ring:'#d1d8e3', accent:'#e9edf4'});
      case 'zebra':
        return faceWrap(`
          <g transform="translate(18 18)">
            <path d="M40 24 50 10l10 16" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <path d="M62 26 74 10l8 18" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <circle cx="58" cy="56" r="28" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <path d="M42 34l6 10M54 30l4 14M68 34l6 10M46 58h24" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
            <circle cx="48" cy="56" r="3.2" fill="${s}"/><circle cx="68" cy="56" r="3.2" fill="${s}"/>
          </g>
        `, {bg1:'#fcfcff', bg2:'#f2f4f8', ring:'#d6dbe6', accent:'#ecf0f6'});
      case 'bird':
        return faceWrap(`
          <g transform="translate(18 22)">
            <path d="M20 58c0-20 18-32 36-32 18 0 34 12 34 30 0 18-14 30-32 30-20 0-38-10-38-28Z" fill="#7ec7ff" stroke="${s}" stroke-width="4"/>
            <path d="M36 58c4-12 12-18 24-18-4 8-4 18 2 28" fill="#56aef3" stroke="${s}" stroke-width="4"/>
            <path d="M88 52 102 58 88 66Z" fill="#ffd25f" stroke="${s}" stroke-width="4"/>
            <circle cx="72" cy="50" r="3.2" fill="${s}"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e4f3ff', ring:'#bfd8fb', accent:'#dcebff'});
      case 'fish':
        return faceWrap(`
          <g transform="translate(16 32)">
            <ellipse cx="56" cy="36" rx="28" ry="18" fill="#6ec5ff" stroke="${s}" stroke-width="4"/>
            <path d="M84 36 106 18v36Z" fill="#4faef5" stroke="${s}" stroke-width="4"/>
            <path d="M40 24l12 12-12 12" fill="none" stroke="#9ddaff" stroke-width="4" stroke-linecap="round"/>
            <circle cx="44" cy="34" r="3.1" fill="${s}"/>
          </g>
        `, {bg1:'#eefbff', bg2:'#e3f4ff', ring:'#bcd9fb', accent:'#d8ecff'});
      case 'whale':
        return faceWrap(`
          <g transform="translate(12 34)">
            <path d="M18 46c0-20 22-32 46-32 26 0 40 16 44 26 10 0 14 6 14 14 0 8-6 14-16 14-8 10-22 16-42 16-26 0-46-12-46-38Z" fill="#75bff7" stroke="${s}" stroke-width="4"/>
            <path d="M80 20 94 8l2 16" fill="#8fd1ff" stroke="${s}" stroke-width="4"/>
            <path d="M32 58c10 4 18 4 28 0" stroke="#d6f1ff" stroke-width="4" stroke-linecap="round"/>
            <circle cx="42" cy="42" r="3.2" fill="${s}"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e2f2ff', ring:'#bfd8fb', accent:'#dbeeff'});
      case 'dolphin':
        return faceWrap(`
          <g transform="translate(12 34)">
            <path d="M18 56c6-22 28-38 54-38 10 0 18 2 28 8-6 8-6 18 0 28-6 10-18 18-32 18-14 0-28-4-50-16Z" fill="#6fb4f2" stroke="${s}" stroke-width="4"/>
            <path d="M64 26 78 14l2 18" fill="#8dcbff" stroke="${s}" stroke-width="4"/>
            <path d="M20 58c12-4 20-4 30 0" stroke="#d9efff" stroke-width="4" stroke-linecap="round"/>
            <circle cx="58" cy="38" r="3.1" fill="${s}"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e2f3ff', ring:'#bfd9fb', accent:'#dceeff'});
      default:
        return faceWrap(`<circle cx="70" cy="70" r="24" fill="#e6edf7" stroke="${s}" stroke-width="4"/>`);
    }
  }

  function vehicleSVG(name) {
    const s = '#25334d';
    const wrap = (inner, palette = {}) => svgCard(inner, palette);
    switch (name) {
      case 'car':
        return wrap(`
          <g transform="translate(12 34)">
            <path d="M18 60h76c6 0 10-4 10-10V42c0-6-4-10-10-10H84L72 20H40L28 32H18c-6 0-10 4-10 10v8c0 6 4 10 10 10Z" fill="#f97373" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M42 24h26l10 12H30Z" fill="#daf1ff" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <circle cx="34" cy="62" r="10" fill="#334155"/><circle cx="84" cy="62" r="10" fill="#334155"/>
            <circle cx="34" cy="62" r="5" fill="#94a3b8"/><circle cx="84" cy="62" r="5" fill="#94a3b8"/>
          </g>
        `, {bg1:'#fff7f7', bg2:'#fff0f0', ring:'#f5c1c1', accent:'#ffe0e0'});
      case 'bus':
        return wrap(`
          <g transform="translate(10 30)">
            <rect x="10" y="18" width="100" height="40" rx="12" fill="#ffbe55" stroke="${s}" stroke-width="4"/>
            <rect x="20" y="26" width="16" height="12" rx="3" fill="#e8f7ff"/><rect x="40" y="26" width="16" height="12" rx="3" fill="#e8f7ff"/><rect x="60" y="26" width="16" height="12" rx="3" fill="#e8f7ff"/><rect x="80" y="26" width="16" height="12" rx="3" fill="#e8f7ff"/>
            <circle cx="34" cy="62" r="10" fill="#334155"/><circle cx="86" cy="62" r="10" fill="#334155"/>
            <circle cx="34" cy="62" r="5" fill="#94a3b8"/><circle cx="86" cy="62" r="5" fill="#94a3b8"/>
          </g>
        `, {bg1:'#fffaf1', bg2:'#fff2dd', ring:'#f1cf92', accent:'#ffe7b7'});
      case 'train':
        return wrap(`
          <g transform="translate(12 24)">
            <path d="M22 20h64c12 0 22 10 22 22v24c0 14-12 26-26 26H40c-14 0-26-12-26-26V40c0-11 8-20 18-20Z" fill="#69aef5" stroke="${s}" stroke-width="4"/>
            <rect x="28" y="30" width="18" height="12" rx="4" fill="#e6f5ff"/><rect x="52" y="30" width="18" height="12" rx="4" fill="#e6f5ff"/><rect x="76" y="30" width="12" height="12" rx="4" fill="#e6f5ff"/>
            <path d="M36 92l-8 12M78 92l8 12M22 104h64" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef8ff', bg2:'#e5f1ff', ring:'#bfd5fb', accent:'#dcebff'});
      case 'airplane':
        return wrap(`
          <g transform="translate(8 28)">
            <path d="M16 58c0-14 10-26 24-32l38-14c4-2 9 1 10 6l3 12 18 6c4 1 6 5 4 9l-1 2c-1 3-4 5-7 5H90l-4 8 10 10c2 2 2 6 0 8l-3 3c-2 2-6 2-8 0L72 69l-28 10c-12 4-24-4-28-21Z" fill="#ffffff" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M44 30h18M54 36h14M62 42h12" stroke="#4cb2ff" stroke-width="5" stroke-linecap="round"/>
            <path d="M74 16l12-4 8 10-4 10" fill="#dff3ff" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <path d="M46 54 84 42" stroke="#d8dee9" stroke-width="6" stroke-linecap="round"/>
          </g>
        `, {bg1:'#f3faff', bg2:'#eaf4ff', ring:'#bfd7fb', accent:'#dfefff'});
      case 'helicopter':
        return wrap(`
          <g transform="translate(10 28)">
            <rect x="22" y="34" width="46" height="24" rx="12" fill="#67c2ff" stroke="${s}" stroke-width="4"/>
            <path d="M68 44h24l12 8" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M44 20v14M16 28h58" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M28 62h44" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M28 58v8M66 58v8" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M32 38h16" stroke="#e6f6ff" stroke-width="5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eff9ff', bg2:'#e5f3ff', ring:'#c0d9fb', accent:'#dff0ff'});
      case 'boat':
        return wrap(`
          <g transform="translate(16 34)">
            <path d="M18 60h72l-8 14H26z" fill="#6aa7f4" stroke="${s}" stroke-width="4"/>
            <path d="M56 20v40" stroke="${s}" stroke-width="4.5"/>
            <path d="M56 22 30 50h26Z" fill="#fff0a6" stroke="${s}" stroke-width="4"/>
            <path d="M18 82c10 4 20 4 30 0s20-4 30 0" stroke="#5fc3ff" stroke-width="4" fill="none" stroke-linecap="round"/>
          </g>
        `, {bg1:'#eef9ff', bg2:'#e4f2ff', ring:'#bfd7fb', accent:'#def0ff'});
      case 'bike':
        return wrap(`
          <g transform="translate(12 34)">
            <circle cx="28" cy="54" r="14" fill="none" stroke="${s}" stroke-width="4.5"/>
            <circle cx="90" cy="54" r="14" fill="none" stroke="${s}" stroke-width="4.5"/>
            <path d="M28 54l24-22 16 22 22-22" stroke="#ef5f7c" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M52 32h16" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#fff7fb', bg2:'#fff0f6', ring:'#f3bfd3', accent:'#ffe0ea'});
      case 'motorcycle':
        return wrap(`
          <g transform="translate(10 34)">
            <circle cx="28" cy="54" r="14" fill="none" stroke="${s}" stroke-width="4.5"/>
            <circle cx="92" cy="54" r="14" fill="none" stroke="${s}" stroke-width="4.5"/>
            <path d="M28 54 52 36h22l10 18H60l-12 12" stroke="#8b6dff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M72 36l12-8" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
          </g>
        `, {bg1:'#f7f5ff', bg2:'#efebff', ring:'#d7ccff', accent:'#ebe6ff'});
      default:
        return wrap(`<circle cx="70" cy="70" r="24" fill="#e5ecf7" stroke="${s}" stroke-width="4"/>`);
    }
  }

  function bodySVG(part) {
    const s = '#25334d';
    const skin = '#f7c8a8';
    const skin2 = '#f2b98e';
    const hair = '#2d3444';

    const wrap = (inner, palette = {bg1:'#fffaf6', bg2:'#fff3ec', ring:'#f2d3bd', accent:'#ffe7da'}) => svgCard(inner, palette);

    switch (part) {
      case 'head':
        return wrap(`
          <g transform="translate(24 16)">
            <circle cx="46" cy="56" r="26" fill="${skin}" stroke="${s}" stroke-width="4"/>
            <path d="M20 50c0-22 12-34 26-34 14 0 30 12 30 30v8H20Z" fill="${hair}"/>
            <circle cx="36" cy="56" r="3.2" fill="${s}"/><circle cx="56" cy="56" r="3.2" fill="${s}"/>
            <path d="M40 68q6 5 12 0" stroke="${s}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <circle cx="30" cy="64" r="3" fill="#f5a3a3" opacity="0.7"/><circle cx="62" cy="64" r="3" fill="#f5a3a3" opacity="0.7"/>
          </g>
        `);
      case 'eyes':
        return wrap(`
          <g transform="translate(18 34)">
            <ellipse cx="38" cy="34" rx="16" ry="12" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <ellipse cx="84" cy="34" rx="16" ry="12" fill="#ffffff" stroke="${s}" stroke-width="4"/>
            <circle cx="38" cy="34" r="7" fill="#25334d"/><circle cx="84" cy="34" r="7" fill="#25334d"/>
            <circle cx="41" cy="31" r="2.3" fill="#ffffff"/><circle cx="87" cy="31" r="2.3" fill="#ffffff"/>
          </g>
        `);
      case 'nose':
        return wrap(`
          <g transform="translate(36 22)">
            <path d="M32 12c12 0 22 10 22 22 0 8-5 13-9 17-2 2-3 4-3 6 0 4 4 7 9 7-4 8-12 13-21 13-14 0-24-10-24-22 0-8 5-13 13-18 5-4 8-8 13-20Z" fill="${skin}" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
            <circle cx="22" cy="66" r="3" fill="${skin2}"/><circle cx="40" cy="66" r="3" fill="${skin2}"/>
          </g>
        `);
      case 'mouth':
        return wrap(`
          <g transform="translate(24 38)">
            <path d="M16 28q30 24 60 0v18c0 14-14 24-30 24S16 60 16 46Z" fill="#c84e4e" stroke="${s}" stroke-width="4"/>
            <path d="M18 28q28 14 56 0" stroke="${s}" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M24 34h44" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
          </g>
        `);
      case 'ear':
        return wrap(`
          <g transform="translate(30 26)">
            <path d="M34 14c16 0 28 12 28 28 0 8-3 15-8 20-6 6-8 10-8 14 0 6-4 10-11 10-6 0-11-4-11-11 0-8 6-13 11-18 4-4 7-8 7-14 0-5-4-10-10-10-6 0-10 5-10 12" fill="none" stroke="${s}" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M32 44c7 2 11 8 11 16" fill="none" stroke="${skin2}" stroke-width="4" stroke-linecap="round"/>
          </g>
        `);
      case 'hair':
        return wrap(`
          <g transform="translate(18 18)">
            <path d="M14 72c0-30 16-48 38-48 22 0 38 18 38 44v14H14Z" fill="${hair}"/>
            <path d="M16 60c10 0 13-14 24-14 6 0 10 6 18 6 6 0 10-4 14-8 5-4 9-4 18-1" fill="none" stroke="#4b5563" stroke-width="4" stroke-linecap="round"/>
          </g>
        `, {bg1:'#faf7ff', bg2:'#f3edff', ring:'#e0d6ff', accent:'#eee7ff'});
      case 'arm':
        return wrap(`
          <g transform="translate(24 24)">
            <path d="M14 76c-8 0-14-6-14-14 0-6 4-11 10-14l28-12c8-4 18 0 21 8 4 8 0 17-8 21L28 74c-4 2-8 2-14 2Z" fill="${skin}" stroke="${s}" stroke-width="4"/>
          </g>
        `);
      case 'hand':
        return wrap(`
          <g transform="translate(24 20)">
            <path d="M26 84c-10 0-16-8-16-18V50c0-4 3-7 7-7s7 3 7 7v-12c0-4 3-7 7-7s7 3 7 7v14-18c0-4 3-7 7-7s7 3 7 7v18-12c0-4 3-7 7-7s7 3 7 7v20-8c0-4 3-7 7-7s7 3 7 7v25c0 12-10 21-22 21H26Z" fill="${skin}" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
          </g>
        `);
      case 'torso':
        return wrap(`
          <g transform="translate(24 12)">
            <path d="M30 18c2 8 10 13 18 13s16-5 18-13c10 3 16 11 16 22v32c0 16-12 28-28 28H42c-16 0-28-12-28-28V40c0-11 6-19 16-22Z" fill="${skin}" stroke="${s}" stroke-width="4"/>
            <circle cx="48" cy="58" r="2.4" fill="${skin2}"/><circle cx="48" cy="70" r="2.4" fill="${skin2}"/>
          </g>
        `);
      case 'leg':
        return wrap(`
          <g transform="translate(36 16)">
            <path d="M16 14h28v26c0 9-4 17-8 23l-8 10v16c0 6-4 10-10 10h-2c-6 0-10-4-10-10V70c0-4 1-8 4-11l6-9V14Z" fill="${skin}" stroke="${s}" stroke-width="4"/>
          </g>
        `);
      case 'foot':
        return wrap(`
          <g transform="translate(28 28)">
            <path d="M18 28c0-11 8-20 17-22l8 34c3 10 12 18 22 18h10c0 11-9 20-20 20H34c-9 0-16-7-16-16Z" fill="${skin}" stroke="${s}" stroke-width="4"/>
            <circle cx="61" cy="59" r="2.3" fill="${skin2}"/><circle cx="54" cy="61" r="2.3" fill="${skin2}"/><circle cx="47" cy="63" r="2.3" fill="${skin2}"/>
          </g>
        `);
      default:
        return wrap(`<circle cx="70" cy="70" r="24" fill="${skin}" stroke="${s}" stroke-width="4"/>`);
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
