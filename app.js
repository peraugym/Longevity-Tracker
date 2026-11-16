/* Reads data/data.json only. Display rules live in the README. */
(function () {
  const app = document.getElementById("app");

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function numberOrNull(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
    return null;
  }

  function parseISODate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function toISODate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const date = parseISODate(iso);
    if (!date) return iso;
    date.setUTCDate(date.getUTCDate() + days);
    return toISODate(date);
  }

  function weekStart(iso) {
    const date = parseISODate(iso);
    if (!date) return iso;
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return toISODate(date);
  }

  function todayISO(timeZone) {
    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).formatToParts(new Date());
      const year = parts.find((part) => part.type === "year").value;
      const month = parts.find((part) => part.type === "month").value;
      const day = parts.find((part) => part.type === "day").value;
      return `${year}-${month}-${day}`;
    } catch (error) {
      const parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" }).formatToParts(new Date());
      const year = parts.find((part) => part.type === "year").value;
      const month = parts.find((part) => part.type === "month").value;
      const day = parts.find((part) => part.type === "day").value;
      return `${year}-${month}-${day}`;
    }
  }

  function formatDate(iso, withWeekday) {
    const date = parseISODate(iso);
    if (!date) return String(iso ?? "");
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: withWeekday ? "short" : undefined,
      day: "numeric",
      month: "short",
    }).format(date);
  }

  function formatDateLong(iso) {
    const date = parseISODate(iso);
    if (!date) return String(iso ?? "");
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatKg(value) {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatEst(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function formatInt(value) {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  function formatSignedKg(value) {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === 0) return "Level with the average";
    const sign = rounded > 0 ? "+" : "−";
    return `${sign}${formatKg(Math.abs(rounded))} vs average`;
  }

  function safeUrl(url) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function proofLabel(proof) {
    const text = String(proof ?? "").trim();
    if (!text) return "";
    if (/^data:image\//i.test(text)) return "Logged";
    if (/\.(png|jpe?g|gif|webp|heic|avif)(\?.*)?$/i.test(text)) return "Logged";
    return text;
  }

  function typeLabel(type) {
    const labels = { strength: "Strength", zone2: "Zone 2", sport: "Sport", walk: "Walk" };
    return labels[type] || String(type || "Session");
  }

  function pillClass(type) {
    return ["strength", "zone2", "sport", "walk"].includes(type) ? `pill-${type}` : "";
  }

  function epley(load, reps) {
    if (reps === 1) return load;
    return load * (1 + reps / 30);
  }

  function bestSet(sets) {
    let best = null;
    for (const set of asArray(sets)) {
      if (!Array.isArray(set) || set.length < 2) continue;
      const load = numberOrNull(set[0]);
      const reps = numberOrNull(set[1]);
      if (load == null || reps == null || reps <= 0) continue;
      const est = epley(load, reps);
      if (!best || est > best.est || (est === best.est && reps > best.reps)) {
        best = { load, reps, est };
      }
    }
    return best;
  }

  function normalizeSessions(raw) {
    return asArray(raw)
      .map((session, index) => ({ session, index }))
      .filter(({ session }) => session && typeof session === "object" && session.date);
  }

  function normalizeWeights(raw) {
    return asArray(raw)
      .map((entry, index) => ({
        date: String(entry && entry.date || ""),
        kg: numberOrNull(entry && entry.kg),
        index,
      }))
      .filter((entry) => parseISODate(entry.date) && entry.kg != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
  }

  function rolling(weights) {
    return weights.map((point) => {
      const start = addDays(point.date, -6);
      const window = weights.filter((entry) => entry.date >= start && entry.date <= point.date);
      const avg = window.reduce((sum, entry) => sum + entry.kg, 0) / window.length;
      return { date: point.date, kg: point.kg, avg, count: window.length };
    });
  }

  function exerciseCatalog(sessions) {
    const chrono = [...sessions].sort((a, b) => a.session.date.localeCompare(b.session.date) || a.index - b.index);
    const map = new Map();
    for (const { session } of chrono) {
      const combined = new Map();
      for (const exercise of asArray(session.exercises)) {
        const name = String(exercise && exercise.name || "").trim();
        if (!name) continue;
        if (!combined.has(name)) combined.set(name, []);
        for (const set of asArray(exercise.sets)) combined.get(name).push(set);
      }
      for (const [name, sets] of combined) {
        const best = bestSet(sets);
        if (!best) continue;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push({
          date: session.date,
          session: String(session.name || ""),
          load: best.load,
          reps: best.reps,
          est: best.est,
        });
      }
    }
    return map;
  }

  function defaultExercise(map, sessions) {
    if (map.size === 0) return "";
    const maxCount = Math.max(...[...map.values()].map((rows) => rows.length));
    const strength = [...sessions]
      .filter(({ session }) => session.type === "strength")
      .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.index - a.index);
    for (const { session } of strength) {
      for (const exercise of asArray(session.exercises)) {
        const name = String(exercise && exercise.name || "").trim();
        if (map.has(name) && map.get(name).length === maxCount) return name;
      }
    }
    return [...map.keys()][0];
  }

  function hrDetail(session, goals) {
    const hr = numberOrNull(session.avgHr);
    if (hr == null) return "";
    const text = `${formatInt(hr)} bpm`;
    const band = goals && goals.zone2HrBpm;
    if (session.type !== "zone2" || !Array.isArray(band) || band.length < 2) return text;
    const low = numberOrNull(band[0]);
    const high = numberOrNull(band[1]);
    if (low == null || high == null) return text;
    if (hr < low) return `${text} <span class="band-out">below band</span>`;
    if (hr > high) return `${text} <span class="band-out">above band</span>`;
    return `${text} <span class="band-in">in band</span>`;
  }

  function sessionDetail(session, goals) {
    const parts = [];
    const volume = numberOrNull(session.volumeKg);
    if (volume != null) {
      const amount = Number.isInteger(volume) ? formatInt(volume) : formatKg(volume);
      parts.push(`${amount} kg`);
    }
    const prs = numberOrNull(session.prs);
    if (prs != null) parts.push(prs === 1 ? "1 PR" : `${formatInt(prs)} PRs`);
    const hr = hrDetail(session, goals);
    if (hr) parts.push(hr);
    return parts.join(" · ");
  }

  function goalPills(goals) {
    const pills = [];
    const steps = numberOrNull(goals.stepsPerDay);
    if (steps != null) pills.push(`${formatInt(steps)} steps/day`);
    if (Array.isArray(goals.proteinG)) {
      const nums = goals.proteinG.map(numberOrNull).filter((value) => value != null);
      if (nums.length === 1) pills.push(`Protein ${formatInt(nums[0])} g`);
      if (nums.length >= 2) pills.push(`Protein ${formatInt(nums[0])}–${formatInt(nums[1])} g`);
    }
    if (Array.isArray(goals.zone2HrBpm) && goals.zone2HrBpm.length >= 2) {
      const low = numberOrNull(goals.zone2HrBpm[0]);
      const high = numberOrNull(goals.zone2HrBpm[1]);
      if (low != null && high != null) pills.push(`Zone 2 HR ${formatInt(low)}–${formatInt(high)}`);
    }
    const lt1 = numberOrNull(goals.lt1CyclingBpm);
    if (lt1 != null) pills.push(`Cycling LT1 ${formatInt(lt1)} bpm`);
    if (!pills.length) return "";
    return `<p class="stat-label goals-label">Standing targets</p><div class="goals">${pills.map((pill) => `<span class="goal">${esc(pill)}</span>`).join("")}</div>`;
  }

  function statCard(options) {
    const bar = options.goal
      ? `<div class="bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, (options.count / options.goal) * 100))}%"></span></div>`
      : "";
    const value = options.goal != null && options.count != null
      ? `${esc(options.count)}<span class="of">/${esc(options.goal)}</span>`
      : esc(options.value);
    return `<article class="stat ${options.className || ""}">
      <p class="stat-label">${esc(options.label)}</p>
      <p class="stat-value">${value}</p>
      ${bar}
      <p class="stat-hint">${esc(options.hint || "")}</p>
    </article>`;
  }

  function themeCharts() {
    if (typeof Chart === "undefined" || Chart.__longevityThemed) return;
    Chart.defaults.color = "#9aa3b2";
    Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
    Chart.defaults.font.family = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    Chart.defaults.font.size = 11;
    Chart.__longevityThemed = true;
  }

  function axisBounds(values) {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) return { min: 0, max: 1 };
    const low = Math.min(...finite);
    const high = Math.max(...finite);
    if (low === high) {
      const pad = low === 0 ? 1 : Math.max(0.4, Math.abs(low) * 0.08);
      return { min: Math.min(0, low - pad), max: high + pad };
    }
    const pad = (high - low) * 0.35;
    return { min: low - pad, max: high + pad };
  }

  function chartMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 280 };
  }

  function render(data) {
    const athlete = String(data.athlete || "Athlete");
    const goals = data.goals && typeof data.goals === "object" ? data.goals : {};
    const sessions = normalizeSessions(data.sessions);
    const weights = rolling(normalizeWeights(data.weights));
    const today = todayISO(data.timezone || "Europe/Vienna");
    const start = weekStart(today);
    const end = addDays(start, 6);
    const weekSessions = sessions.filter(({ session }) => session.date >= start && session.date <= end);
    const strength = weekSessions.filter(({ session }) => session.type === "strength").length;
    const zone2 = weekSessions.filter(({ session }) => session.type === "zone2").length;
    const strengthGoal = numberOrNull(goals.strengthSessionsPerWeek);
    const zone2Goal = numberOrNull(goals.zone2PerWeek);
    const complianceMet = (strengthGoal == null ? strength : Math.min(strength, strengthGoal))
      + (zone2Goal == null ? zone2 : Math.min(zone2, zone2Goal));
    const complianceGoal = (strengthGoal == null ? 0 : strengthGoal) + (zone2Goal == null ? 0 : zone2Goal);
    const latest = weights[weights.length - 1];
    const height = numberOrNull(data.heightCm);
    const meta = [
      data.updated ? `Updated ${formatDateLong(data.updated)}` : "",
      data.timezone || "",
      height != null ? `${formatKg(height)} cm` : "",
    ].filter(Boolean).join(" · ");
    const crowd = safeUrl(data.links && data.links.gymCrowdTracker);
    document.title = `${athlete} · Longevity Tracker`;

    const weightValue = latest
      ? `${esc(formatKg(latest.kg))}<span class="unit"> kg</span>`
      : "—";
    const avgValue = latest
      ? `${esc(formatKg(latest.avg))}<span class="unit"> kg</span>`
      : "—";

    app.innerHTML = `
      <a class="skip" href="#week">Skip to this week</a>
      <div class="wrap">
        <header class="hero">
          <div>
            <p class="kicker">Longevity tracker</p>
            <h1>${esc(athlete)}</h1>
            <p class="meta">${esc(meta)}</p>
          </div>
          ${crowd ? `<a class="crowd" href="${esc(crowd)}">Gym crowd tracker <span aria-hidden="true">↗</span></a>` : ""}
        </header>
        <nav class="jump" aria-label="Sections">
          <a href="#week">This week</a>
          <a href="#weight">Weight</a>
          <a href="#lifts">Lifts</a>
          <a href="#log">Log</a>
          <a href="#targets">Targets</a>
          <a href="#penalties">Penalties</a>
          <a href="#history">History</a>
        </nav>
        <main>
          <section id="week">
            <h2>This week</h2>
            <p class="lede">${esc(formatDate(start, true))} – ${esc(formatDate(end, true))}</p>
            <div class="glance">
              ${statCard({
                className: "stat-strength",
                label: "Strength",
                count: strength,
                goal: strengthGoal,
                value: String(strength),
                hint: "sessions",
              })}
              ${statCard({
                className: "stat-zone2",
                label: "Zone 2",
                count: zone2,
                goal: zone2Goal,
                value: String(zone2),
                hint: "sessions",
              })}
              <article class="stat stat-weight">
                <p class="stat-label">Latest weight</p>
                <p class="stat-value">${weightValue}</p>
                <p class="stat-hint">${latest ? `${esc(formatDate(latest.date, true))}<br>${esc(formatSignedKg(latest.kg - latest.avg))}` : "No weigh-in yet"}</p>
              </article>
              <article class="stat stat-avg">
                <p class="stat-label">7-day average</p>
                <p class="stat-value">${avgValue}</p>
                <p class="stat-hint">${latest ? `${esc(`${formatDate(addDays(latest.date, -6))} – ${formatDate(latest.date)}`)}<br>${esc(`${latest.count} weigh-in${latest.count === 1 ? "" : "s"}`)}` : "No weigh-in yet"}</p>
              </article>
              <article class="stat stat-wide">
                <p class="stat-label">Compliance</p>
                <p class="stat-value">${complianceGoal ? `${complianceMet}<span class="of">/${complianceGoal}</span>` : esc(String(complianceMet))}</p>
                ${complianceGoal ? `<div class="bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, (complianceMet / complianceGoal) * 100))}%"></span></div>` : ""}
                <p class="stat-hint">${esc(`${strength} strength · ${zone2} Zone 2`)}</p>
              </article>
            </div>
            ${goalPills(goals)}
          </section>
          <section id="weight">
            <h2>Bodyweight</h2>
            <p class="lede">Scale weight and the average of weigh-ins in the 7 days ending that day.</p>
            <div class="chart-card">
              <p class="snapshot">${latest ? `${esc(formatKg(latest.kg))} kg latest · ${esc(formatKg(latest.avg))} kg 7-day average` : "No weigh-ins yet."}</p>
              <div class="chart-box"><canvas id="weight-chart"></canvas></div>
            </div>
          </section>
          <section id="lifts">
            <h2>Lift progression</h2>
            <p class="lede">Best set each session. Estimated 1RM is Epley on the logged load: load × (1 + reps / 30). Added-weight lifts stay as logged.</p>
            <div id="lift-panel"></div>
          </section>
          <section id="log">
            <h2>Session log</h2>
            <p class="lede">Newest first. ${sessions.length} session${sessions.length === 1 ? "" : "s"}.</p>
            ${renderLog(sessions, goals)}
          </section>
          <section id="targets">
            <h2>Next targets</h2>
            <p class="lede">The next pass on each session.</p>
            ${renderTargets(data.nextTargets)}
          </section>
          <section id="penalties">
            <h2>Penalty board</h2>
            ${renderPenalties(data.penalties)}
          </section>
          <section id="history">
            <h2>Weekly history</h2>
            ${renderWeeks(data.weeks)}
          </section>
        </main>
        <footer class="foot"><p>Figures come from <code>data/data.json</code>. Edit that file and refresh.</p></footer>
      </div>`;

    app.removeAttribute("aria-busy");
    drawWeight(weights);
    drawLifts(exerciseCatalog(sessions), sessions);
  }

  function renderLog(sessions, goals) {
    if (!sessions.length) return `<p class="lede">No sessions logged.</p>`;
    const rows = [...sessions].sort((a, b) => b.session.date.localeCompare(a.session.date) || b.index - a.index);
    const body = rows.map(({ session }) => {
      const detail = sessionDetail(session, goals);
      const proof = proofLabel(session.proof);
      const accent = ["strength", "zone2", "sport", "walk"].includes(session.type) ? session.type : "";
      return `<tr class="${accent ? `type-${accent}` : "type-strength"}">
        <td data-col="date">${esc(formatDate(session.date, true))}</td>
        <td data-col="name">${esc(session.name || "Session")}</td>
        <td data-col="type"><span class="pill ${pillClass(session.type)}">${esc(typeLabel(session.type))}</span></td>
        <td data-col="minutes">${esc(numberOrNull(session.minutes) == null ? "—" : `${formatInt(session.minutes)} min`)}</td>
        <td data-col="detail" class="${detail ? "" : "is-empty"}">${detail || "—"}</td>
        <td data-col="proof">${proof ? `<span class="pill pill-proof">${esc(proof)}</span>` : "—"}</td>
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="log-table">
      <caption class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Training sessions, newest first</caption>
      <thead><tr>
        <th>Date</th><th>Session</th><th>Type</th><th>Minutes</th><th>Volume / PRs / HR</th><th>Proof</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function renderTargets(nextTargets) {
    const entries = nextTargets && typeof nextTargets === "object" ? Object.entries(nextTargets) : [];
    if (!entries.length) return `<p class="lede">No targets logged.</p>`;
    return `<div class="stack two">${entries.map(([title, items], index) => {
      const lines = asArray(items);
      const list = (lines.length ? lines : [items]).map((item) => `<li>${esc(item)}</li>`).join("");
      return `<article class="target accent-${index % 4}"><h3>${esc(title)}</h3><ol>${list}</ol></article>`;
    }).join("")}</div>`;
  }

  function renderPenalties(penalties) {
    const items = asArray(penalties);
    if (!items.length) {
      return `<div class="clean"><div class="clean-mark" aria-hidden="true">✓</div><div><h3>Clean sheet</h3><p>Nothing on the board.</p></div></div>`;
    }
    const cards = items.map((item, index) => ({ item, index })).sort((a, b) => {
      const left = a.item && a.item.date ? String(a.item.date) : "";
      const right = b.item && b.item.date ? String(b.item.date) : "";
      if (left && right && left !== right) return right.localeCompare(left);
      return b.index - a.index;
    });
    return `<div class="stack">${cards.map(({ item }) => {
      if (typeof item === "string") {
        return `<article class="penalty"><h3>${esc(item)}</h3></article>`;
      }
      const reason = item && (item.reason || item.title) || "Penalty";
      const detail = item && (item.detail || item.note) || "";
      const date = item && item.date ? formatDate(item.date, true) : "";
      return `<article class="penalty">
        <div class="penalty-top"><h3>${esc(reason)}</h3>${date ? `<span class="num">${esc(date)}</span>` : ""}</div>
        ${detail ? `<p>${esc(detail)}</p>` : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderWeeks(weeks) {
    const items = asArray(weeks)
      .filter((week) => week && typeof week === "object")
      .sort((a, b) => String(b.week || "").localeCompare(String(a.week || "")));
    if (!items.length) return `<p class="lede">No weeks logged yet.</p>`;
    return `<div class="stack">${items.map((week) => {
      const strength = numberOrNull(week.strengthSessions);
      const zone2 = numberOrNull(week.zone2Sessions);
      const bits = [
        strength != null ? `${formatInt(strength)} strength` : "",
        zone2 != null ? `${formatInt(zone2)} Zone 2` : "",
      ].filter(Boolean).join(" · ");
      return `<article class="week-card">
        <div class="week-top">
          <h3>Week of ${esc(formatDate(week.week, true))}</h3>
          <span class="week-score">${esc(week.compliance || "")}</span>
        </div>
        ${bits ? `<p>${esc(bits)}</p>` : ""}
        ${week.note ? `<p class="note">${esc(week.note)}</p>` : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function drawWeight(series) {
    const canvas = document.getElementById("weight-chart");
    if (!canvas) return;
    if (!series.length) {
      canvas.replaceWith(Object.assign(document.createElement("p"), { className: "lede", textContent: "No weigh-ins yet." }));
      return;
    }
    if (typeof Chart === "undefined") {
      canvas.insertAdjacentHTML("beforebegin", `<p class="chart-fallback">Chart library did not load. The latest figures are above.</p>`);
      canvas.remove();
      return;
    }
    themeCharts();
    const bounds = axisBounds(series.flatMap((point) => [point.kg, point.avg]));
    const latest = series[series.length - 1];
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Bodyweight from ${formatDate(series[0].date)} to ${formatDate(latest.date)}. Latest ${formatKg(latest.kg)} kilograms. 7-day average ${formatKg(latest.avg)} kilograms.`);
    new Chart(canvas, {
      type: "line",
      data: {
        labels: series.map((point) => formatDate(point.date)),
        datasets: [
          {
            label: "Weight",
            data: series.map((point) => point.kg),
            borderColor: "#d6ff3f",
            backgroundColor: "rgba(214, 255, 63, 0.12)",
            pointBackgroundColor: "#d6ff3f",
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.25,
            fill: true,
          },
          {
            label: "7-day average",
            data: series.map((point) => point.avg),
            borderColor: "#ff8a3d",
            backgroundColor: "#ff8a3d",
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartMotion(),
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 8 } },
          tooltip: {
            backgroundColor: "#12151c",
            borderColor: "#2c3344",
            borderWidth: 1,
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${formatKg(context.parsed.y)} kg`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
          y: {
            min: bounds.min,
            max: bounds.max,
            ticks: { callback: (value) => `${Number(value).toFixed(1)}` },
          },
        },
      },
    });
  }

  function drawLifts(catalog, sessions) {
    const panel = document.getElementById("lift-panel");
    if (!panel) return;
    const names = [...catalog.keys()].sort((a, b) => {
      const left = catalog.get(a);
      const right = catalog.get(b);
      if (right.length !== left.length) return right.length - left.length;
      const lastLeft = left[left.length - 1].date;
      const lastRight = right[right.length - 1].date;
      if (lastLeft !== lastRight) return lastRight.localeCompare(lastLeft);
      return a.localeCompare(b);
    });
    if (!names.length) {
      panel.innerHTML = `<p class="lede">No lifts logged yet.</p>`;
      return;
    }
    const repeated = names.filter((name) => catalog.get(name).length > 1);
    const once = names.filter((name) => catalog.get(name).length === 1);
    const option = (name) => {
      const count = catalog.get(name).length;
      return `<option value="${esc(name)}">${esc(name)} · ${count} session${count === 1 ? "" : "s"}</option>`;
    };
    const groups = [
      repeated.length ? `<optgroup label="Across sessions">${repeated.map(option).join("")}</optgroup>` : "",
      once.length ? `<optgroup label="Single session">${once.map(option).join("")}</optgroup>` : "",
    ].join("");
    panel.innerHTML = `
      <label class="field">
        <span>Exercise</span>
        <select id="lift-select" class="lift-select">${groups}</select>
      </label>
      <div class="chart-card">
        <p id="lift-summary" class="lift-summary"></p>
        <div class="chart-box"><canvas id="lift-chart"></canvas></div>
        <div id="lift-table"></div>
      </div>`;
    const select = document.getElementById("lift-select");
    const initial = defaultExercise(catalog, sessions);
    select.value = initial;
    const holder = { chart: null, rows: [] };
    const show = (name) => {
      const rows = catalog.get(name) || [];
      if (!rows.length) return;
      const summary = document.getElementById("lift-summary");
      const table = document.getElementById("lift-table");
      const canvas = document.getElementById("lift-chart");
      const first = rows[0];
      const last = rows[rows.length - 1];
      let change = "first log";
      if (rows.length > 1) {
        const delta = Math.round((last.est - first.est) * 10) / 10;
        change = delta === 0 ? "e1RM unchanged" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} e1RM`;
      }
      summary.innerHTML = `<span>${rows.length} session${rows.length === 1 ? "" : "s"}</span><span>Latest e1RM ${esc(formatEst(last.est))}</span><span>${esc(change)}</span>`;
      table.innerHTML = `<table class="set-table">
        <caption class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Best sets for ${esc(name)}</caption>
        <thead><tr><th>Date</th><th>Session</th><th>Best set</th><th>e1RM</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>
          <td class="num">${esc(formatDate(row.date, true))}</td>
          <td>${esc(row.session)}</td>
          <td class="num">${esc(`${formatKg(row.load)} kg × ${formatInt(row.reps)}`)}</td>
          <td class="num">${esc(formatEst(row.est))}</td>
        </tr>`).join("")}</tbody>
      </table>`;
      if (!canvas || typeof Chart === "undefined") {
        if (canvas && typeof Chart === "undefined") {
          canvas.replaceWith(Object.assign(document.createElement("p"), {
            className: "chart-fallback",
            textContent: "Chart library did not load. The set list is below.",
          }));
        }
        return;
      }
      themeCharts();
      const estBounds = axisBounds(rows.map((row) => row.est));
      const repBounds = axisBounds(rows.map((row) => row.reps));
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${name}. Latest estimated 1RM ${formatEst(last.est)} from ${formatKg(last.load)} kilograms for ${formatInt(last.reps)} reps.`);
      const configData = {
        labels: rows.map((row) => formatDate(row.date)),
        datasets: [
          {
            label: "e1RM",
            data: rows.map((row) => row.est),
            yAxisID: "y",
            borderColor: "#d6ff3f",
            backgroundColor: "#d6ff3f",
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.2,
          },
          {
            label: "Top-set reps",
            data: rows.map((row) => row.reps),
            yAxisID: "y1",
            borderColor: "#3ee0c5",
            backgroundColor: "#3ee0c5",
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [4, 3],
            tension: 0.2,
          },
        ],
      };
      holder.rows = rows;
      if (!holder.chart) {
        holder.chart = new Chart(canvas, {
          type: "line",
          data: configData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: chartMotion(),
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 8 } },
              tooltip: {
                backgroundColor: "#12151c",
                borderColor: "#2c3344",
                borderWidth: 1,
                callbacks: {
                  title(items) {
                    const row = holder.rows[items[0].dataIndex];
                    return `${formatDate(row.date, true)} · ${row.session}`;
                  },
                  label(context) {
                    const row = holder.rows[context.dataIndex];
                    if (context.datasetIndex === 0) {
                      return `e1RM ${formatEst(row.est)} · ${formatKg(row.load)} kg × ${formatInt(row.reps)}`;
                    }
                    return `Top set ${formatInt(row.reps)} reps`;
                  },
                },
              },
            },
            scales: {
              x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
              y: { position: "left", min: estBounds.min, max: estBounds.max, title: { display: true, text: "e1RM" } },
              y1: {
                position: "right",
                min: repBounds.min,
                max: repBounds.max,
                grid: { drawOnChartArea: false },
                title: { display: true, text: "Reps" },
                ticks: { precision: 0 },
              },
            },
          },
        });
      } else {
        holder.chart.data.labels = configData.labels;
        holder.chart.data.datasets[0].data = configData.datasets[0].data;
        holder.chart.data.datasets[1].data = configData.datasets[1].data;
        holder.chart.options.scales.y.min = estBounds.min;
        holder.chart.options.scales.y.max = estBounds.max;
        holder.chart.options.scales.y1.min = repBounds.min;
        holder.chart.options.scales.y1.max = repBounds.max;
        holder.chart.update();
      }
    };
    select.addEventListener("change", () => show(select.value));
    show(select.value || names[0]);
  }

  async function main() {
    try {
      const url = new URL("data/data.json", window.location.href);
      url.searchParams.set("t", String(Date.now()));
      const response = await fetch(url.href, { cache: "no-store" });
      if (!response.ok) throw new Error(`data/data.json returned ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== "object") throw new Error("data/data.json was not an object");
      render(data);
      document.body.dataset.ready = "1";
    } catch (error) {
      app.innerHTML = `<div class="error"><h1>Log unavailable</h1><p>Could not read <code>data/data.json</code>.</p><p>${esc(error.message)}</p></div>`;
      app.removeAttribute("aria-busy");
      document.body.dataset.ready = "error";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
})();
