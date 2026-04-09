/* MI Patterns — interactive demo
 * Illustrates: detect naming-convention pattern -> label positions ->
 *              deconstruct campaign names -> extract dimensions ->
 *              harmonize across sources -> analyze.
 */

// ---------- Sample data ----------
// Three sources, all using the same internal convention
//   <Company> | <Target Audience> | <Campaign Objective>
// A couple of unmatched rows are included to show what the detector ignores.
const SOURCES = [
  {
    id: "google",
    name: "Google Ads",
    dotClass: "google",
    campaigns: [
      "Honda | M24-35 | Awareness",
      "Toyota | F18-24 | Conversion",
      "Ford | M35-44 | Consideration",
      "Honda | F25-34 | Conversion",
      "summer_sale_2024",
    ],
  },
  {
    id: "meta",
    name: "Meta Ads",
    dotClass: "meta",
    campaigns: [
      "Nissan | F25-34 | Awareness",
      "Hyundai | M45-54 | Conversion",
      "Toyota | M24-35 | Consideration",
      "BMW | F18-24 | Awareness",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    dotClass: "tiktok",
    campaigns: [
      "BMW | F18-24 | Consideration",
      "Audi | M24-35 | Awareness",
      "Lexus | F35-44 | Conversion",
      "Honda | M24-35 | Awareness",
      "Q4-2024-Promo",
    ],
  },
];

// App state
const state = {
  currentStep: 1,
  delimiter: null,
  positionCount: 0,
  matched: [],   // [{ source, raw, parts: [] }]
  unmatched: [], // [{ source, raw }]
  labels: [],    // [{ suggested, value }]
};

// ---------- Pattern detection ----------
const CANDIDATE_DELIMITERS = ["|", "-", "_", "/", ":", ";"];

function detectPattern(sources) {
  // Flatten all campaigns with their source
  const all = [];
  sources.forEach((s) => {
    s.campaigns.forEach((c) => all.push({ source: s, raw: c }));
  });

  // For each candidate delimiter, find the position count that maximizes
  // the number of matching rows.
  let best = { delimiter: null, positionCount: 0, matchCount: 0 };

  for (const delim of CANDIDATE_DELIMITERS) {
    const counts = {};
    all.forEach((row) => {
      if (!row.raw.includes(delim)) return;
      const n = row.raw.split(delim).length;
      if (n < 2) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    for (const n of Object.keys(counts)) {
      const count = counts[n];
      if (count > best.matchCount) {
        best = {
          delimiter: delim,
          positionCount: parseInt(n, 10),
          matchCount: count,
        };
      }
    }
  }

  // Produce matched / unmatched row arrays based on the winning pattern
  const matched = [];
  const unmatched = [];
  all.forEach((row) => {
    if (!best.delimiter || !row.raw.includes(best.delimiter)) {
      unmatched.push(row);
      return;
    }
    const parts = row.raw.split(best.delimiter).map((p) => p.trim());
    if (parts.length !== best.positionCount) {
      unmatched.push(row);
      return;
    }
    matched.push({ source: row.source, raw: row.raw, parts });
  });

  return { ...best, total: all.length, matched, unmatched };
}

// ---------- Heuristic label suggestions ----------
// Look at the shape of the values at each position to guess a label.
function suggestLabels(matched, positionCount) {
  const suggestions = [];
  for (let i = 0; i < positionCount; i++) {
    const values = matched.map((m) => m.parts[i]);
    suggestions.push(guessLabelForValues(values, i));
  }
  return suggestions;
}

function guessLabelForValues(values, index) {
  const sample = values[0] || "";
  // Audience-ish: starts with M/F and contains a digit range
  if (values.every((v) => /^[MF]\d/.test(v))) return "Target Audience";
  // Objective-ish: known marketing objectives
  const objectiveWords = ["awareness", "consideration", "conversion", "retention", "loyalty"];
  if (values.every((v) => objectiveWords.includes(v.toLowerCase()))) {
    return "Campaign Objective";
  }
  // Company-ish: single word, mostly letters
  if (values.every((v) => /^[A-Za-z][A-Za-z0-9&\s]*$/.test(v))) return "Company";
  return `Dimension ${index + 1}`;
}

// ---------- Rendering ----------
function render() {
  renderStepper();
  renderStep1();
}

function renderStepper() {
  document.querySelectorAll(".step").forEach((el) => {
    const n = parseInt(el.dataset.step, 10);
    el.classList.toggle("active", n === state.currentStep);
    el.classList.toggle("done", n < state.currentStep);
  });
}

function goToStep(n) {
  state.currentStep = n;
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel-${n}`).classList.add("active");
  renderStepper();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Step 1: raw sources ---
function renderStep1() {
  const view = document.getElementById("sources-view");
  view.innerHTML = "";
  SOURCES.forEach((s) => {
    const card = document.createElement("div");
    card.className = "source-card";
    card.innerHTML = `
      <div class="source-head">
        <span class="source-dot ${s.dotClass}"></span>
        <span class="source-name">${s.name}</span>
        <span class="source-count">${s.campaigns.length} campaigns</span>
      </div>
      <div class="campaigns"></div>
    `;
    const list = card.querySelector(".campaigns");
    s.campaigns.forEach((c) => {
      const row = document.createElement("div");
      row.className = "campaign";
      row.textContent = c;
      list.appendChild(row);
    });
    view.appendChild(card);
  });
}

// --- Step 2: detection ---
function renderStep2() {
  const result = detectPattern(SOURCES);
  state.delimiter = result.delimiter;
  state.positionCount = result.positionCount;
  state.matched = result.matched;
  state.unmatched = result.unmatched;
  state.labels = suggestLabels(result.matched, result.positionCount).map((s) => ({
    suggested: s,
    value: s,
  }));

  // Mark matched/unmatched in the step-1 source cards so the user can see what was filtered.
  document.querySelectorAll("#sources-view .campaign").forEach((el) => {
    const raw = el.textContent;
    const isMatch = result.matched.some((m) => m.raw === raw);
    el.classList.toggle("matched", isMatch);
    el.classList.toggle("unmatched", !isMatch);
  });

  document.getElementById("detected-delimiter").textContent =
    result.delimiter === "|" ? "|" : result.delimiter || "—";
  document.getElementById("detected-positions").textContent = result.positionCount || "—";
  document.getElementById("matched-count").textContent = result.matched.length;
  document.getElementById("unmatched-count").textContent = result.unmatched.length;
  const coverage = Math.round((result.matched.length / result.total) * 100);
  document.getElementById("delimiter-coverage").textContent = coverage;

  // Build animated sample row using the first matched campaign
  const sampleRow = document.getElementById("sample-row");
  sampleRow.innerHTML = "";
  if (result.matched.length > 0) {
    const sample = result.matched[0];
    sample.parts.forEach((part, i) => {
      if (i > 0) {
        const d = document.createElement("span");
        d.className = "sample-delim";
        d.textContent = result.delimiter;
        sampleRow.appendChild(d);
      }
      const p = document.createElement("span");
      p.className = "sample-piece";
      p.textContent = part;
      sampleRow.appendChild(p);
    });
  }
}

// --- Step 3: labeling ---
function renderStep3() {
  const view = document.getElementById("labeling-view");
  view.innerHTML = "";
  for (let i = 0; i < state.positionCount; i++) {
    const card = document.createElement("div");
    card.className = "label-card";
    const samples = state.matched
      .map((m) => m.parts[i])
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .slice(0, 4);
    card.innerHTML = `
      <div class="label-pos">Position ${i + 1}</div>
      <input type="text" data-pos="${i}" value="${state.labels[i].value}" />
      <div class="label-samples">
        <strong>Sample values:</strong><br/>
        ${samples.map((s) => `<span>${s}</span>`).join("")}
      </div>
    `;
    view.appendChild(card);
  }
  view.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.pos, 10);
      state.labels[idx].value = e.target.value;
    });
  });
}

// --- Step 4: deconstruct ---
function renderStep4() {
  const view = document.getElementById("deconstruct-view");
  view.innerHTML = "";
  state.matched.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "deconstruct-row";
    row.style.animationDelay = `${Math.min(idx * 0.04, 0.6)}s`;
    const chips = m.parts
      .map(
        (p, i) =>
          `<span class="chip chip-${i + 1}">${state.labels[i].value}: ${p}</span>`
      )
      .join("");
    row.innerHTML = `
      <div class="deconstruct-source">
        <span class="source-dot ${m.source.dotClass}"></span>
        ${m.source.name}
      </div>
      <div class="deconstruct-raw">${m.raw}</div>
      <div class="arrow">&rarr;</div>
      <div class="chips">${chips}</div>
    `;
    view.appendChild(row);
  });
}

// --- Step 5: harmonized table ---
function renderStep5() {
  const table = document.getElementById("harmonized-table");
  const labelCells = state.labels
    .map((l) => `<th class="new-dim">${l.value}</th>`)
    .join("");
  const header = `
    <thead>
      <tr>
        <th>Source</th>
        <th>Original campaign name</th>
        ${labelCells}
      </tr>
    </thead>
  `;
  const body = state.matched
    .map((m) => {
      const tds = m.parts
        .map((p) => `<td class="new-dim">${p}</td>`)
        .join("");
      return `
        <tr>
          <td><span class="src-tag"><span class="source-dot ${m.source.dotClass}"></span>${m.source.name}</span></td>
          <td class="raw-col">${m.raw}</td>
          ${tds}
        </tr>
      `;
    })
    .join("");
  table.innerHTML = header + `<tbody>${body}</tbody>`;
}

// --- Step 6: analysis ---
function renderStep6() {
  const grid = document.getElementById("analysis-grid");
  grid.innerHTML = "";
  for (let i = 0; i < state.positionCount; i++) {
    const label = state.labels[i].value;
    const counts = {};
    state.matched.forEach((m) => {
      const v = m.parts[i];
      counts[v] = (counts[v] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...sorted.map((x) => x[1]));
    const bars = sorted
      .map(
        ([val, count]) => `
          <div class="bar-row">
            <div class="bar-label" title="${val}">${val}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${(count / max) * 100}%"></div>
            </div>
            <div class="bar-val">${count}</div>
          </div>
        `
      )
      .join("");
    const card = document.createElement("div");
    card.className = "analysis-card";
    card.innerHTML = `
      <h3>Campaigns by ${label}</h3>
      <div class="analysis-sub">Aggregated across all ${SOURCES.length} sources</div>
      ${bars}
    `;
    grid.appendChild(card);
  }
}

// ---------- Theme toggle ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");
  if (theme === "light") {
    icon.innerHTML = "&#9728;"; // sun
    label.textContent = "Light";
  } else {
    icon.innerHTML = "&#9790;"; // moon
    label.textContent = "Dark";
  }
  try { localStorage.setItem("mi-patterns-theme", theme); } catch (e) {}
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("mi-patterns-theme"); } catch (e) {}
  applyTheme(saved === "light" ? "light" : "dark");
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "light" ? "dark" : "light");
  });
}

// ---------- Wire up buttons ----------
function init() {
  initTheme();
  render();

  document.getElementById("btn-detect").addEventListener("click", () => {
    renderStep2();
    goToStep(2);
  });

  document.getElementById("btn-label").addEventListener("click", () => {
    renderStep3();
    goToStep(3);
  });

  document.getElementById("btn-deconstruct").addEventListener("click", () => {
    renderStep4();
    goToStep(4);
  });

  document.getElementById("btn-harmonize").addEventListener("click", () => {
    renderStep5();
    goToStep(5);
  });

  document.getElementById("btn-analyze").addEventListener("click", () => {
    renderStep6();
    goToStep(6);
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    // Reset state and visible marks on step 1 cards
    state.currentStep = 1;
    state.delimiter = null;
    state.positionCount = 0;
    state.matched = [];
    state.unmatched = [];
    state.labels = [];
    renderStep1();
    goToStep(1);
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goToStep(parseInt(btn.dataset.back, 10));
    });
  });
}

init();
