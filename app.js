"use strict";

const $ = (id) => document.getElementById(id);
const P = (t, kind, jump = false) => ({ t, kind, jump });
const uniq = (a) => [...new Set(a)];

/* ---------- Algorithms ----------
   Each returns a path: [{t: track, kind: 'start'|'req'|'edge', jump: bool}]
   jump = this point was reached by the circular "return" jump. */

function builder(head) {
  const path = [P(head, "start")];
  return {
    path,
    add(t, kind = "req", jump = false) {
      const last = path[path.length - 1];
      if (!jump && last.t === t) {
        if (kind === "req" && last.kind === "edge") last.kind = "req";
        return;
      }
      path.push(P(t, kind, jump));
    },
  };
}

function fcfs(c) {
  return [P(c.head, "start"), ...c.reqs.map((t) => P(t, "req"))];
}

function sstf(c) {
  const path = [P(c.head, "start")];
  const rem = c.reqs.slice();
  let cur = c.head;
  while (rem.length) {
    let bi = 0;
    for (let i = 1; i < rem.length; i++) {
      if (Math.abs(rem[i] - cur) < Math.abs(rem[bi] - cur)) bi = i;
    }
    cur = rem.splice(bi, 1)[0];
    path.push(P(cur, "req"));
  }
  return path;
}

function groups(c) {
  const up = c.dir === "up";
  const hi = uniq(c.reqs.filter((t) => (up ? t >= c.head : t > c.head))).sort((a, b) => a - b); // ascending
  const lo = uniq(c.reqs.filter((t) => (up ? t < c.head : t <= c.head))).sort((a, b) => b - a); // descending
  return { up, hi, lo };
}

function look(c) {
  const { up, hi, lo } = groups(c);
  const b = builder(c.head);
  (up ? [hi, lo] : [lo, hi]).forEach((g) => g.forEach((t) => b.add(t)));
  return b.path;
}

function cscan(c) {
  const { up, hi, lo } = groups(c);
  const b = builder(c.head);
  const first = up ? hi : lo;
  const rest = up ? lo : hi;
  first.forEach((t) => b.add(t));
  if (rest.length) {
    b.add(up ? c.tracks - 1 : 0, "edge"); // go to the end of the disk
    b.add(up ? 0 : c.tracks - 1, "edge", true); // jump to the other end
    rest.slice().reverse().forEach((t) => b.add(t));
  }
  return b.path;
}

function clook(c) {
  const { up, hi, lo } = groups(c);
  const b = builder(c.head);
  const first = up ? hi : lo;
  const rest = (up ? lo : hi).slice().reverse();
  first.forEach((t) => b.add(t));
  if (rest.length) {
    b.add(rest[0], "req", true); // jump to the farthest request on the other side
    rest.slice(1).forEach((t) => b.add(t));
  }
  return b.path;
}

const ALGOS = [
  { name: "FCFS", full: "First-Come, First-Served", fn: fcfs },
  { name: "SSTF", full: "Shortest Seek Time First", fn: sstf },
  { name: "LOOK", full: "", fn: look },
  { name: "C-SCAN", full: "", fn: cscan },
  { name: "C-LOOK", full: "", fn: clook },
];

function totalMovement(path, countJump) {
  let s = 0;
  for (let i = 1; i < path.length; i++) {
    if (path[i].jump && !countJump) continue;
    s += Math.abs(path[i].t - path[i - 1].t);
  }
  return s;
}

/* ---------- Input ---------- */

function readInput() {
  const tracks = Number($("tracks").value);
  const head = Number($("head").value);
  if (!Number.isInteger(tracks) || tracks < 1) throw new Error("Number of tracks must be a whole number ≥ 1.");
  if (!Number.isInteger(head) || head < 0 || head > tracks - 1)
    throw new Error(`Current track must be between 0 and ${tracks - 1}.`);

  const parts = $("requests").value.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one track request.");
  const reqs = parts.map(Number);
  if (reqs.some((n) => !Number.isInteger(n))) throw new Error("Requests must be whole numbers separated by commas or spaces.");
  const bad = reqs.find((n) => n < 0 || n > tracks - 1);
  if (bad !== undefined) throw new Error(`Track ${bad} is outside the disk (0 to ${tracks - 1}).`);
  if (reqs.length > 200) throw new Error("Please use 200 requests or fewer.");

  return { tracks, head, reqs, dir: $("dir").value, countJump: $("countJump").checked };
}

/* ---------- Chart ---------- */

function niceStep(max) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (const s of steps) if (max / s <= 6) return s;
  return 100000;
}

function chart(path, N) {
  const stepW = 54;
  const m = { l: 48, r: 18, t: 24, b: 44 };
  const H = 300;
  const n = path.length;
  const innerW = Math.max((n - 1) * stepW, 240);
  const W = m.l + m.r + innerW;
  const innerH = H - m.t - m.b;
  const max = Math.max(N - 1, 1);

  const x = (i) => m.l + (n > 1 ? (i * innerW) / (n - 1) : 0);
  const y = (t) => m.t + (1 - t / max) * innerH;

  let s = `<svg viewBox="0 0 ${W} ${H}" style="min-width:${W}px;width:100%" role="img" aria-label="Head movement graph">`;

  // horizontal grid + Y ticks (track number on the left)
  const step = niceStep(max);
  const ticks = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  if (max - ticks[ticks.length - 1] > step * 0.4) ticks.push(max);
  ticks.forEach((t) => {
    s += `<line class="g-grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`;
    s += `<text class="g-tick" x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  });

  // axes
  s += `<line class="g-axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>`;
  s += `<line class="g-axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;

  // X ticks (time = step number at the bottom)
  for (let i = 0; i < n; i++) {
    s += `<text class="g-tick" x="${x(i)}" y="${H - m.b + 16}" text-anchor="middle">${i}</text>`;
  }
  s += `<text class="g-title" x="${m.l + innerW / 2}" y="${H - 8}" text-anchor="middle">Time (step)</text>`;
  s += `<text class="g-title" transform="translate(13 ${m.t + innerH / 2}) rotate(-90)" text-anchor="middle">Track number</text>`;

  // segments
  for (let i = 1; i < n; i++) {
    const cls = path[i].jump ? "g-jump" : "g-line";
    s += `<line class="${cls}" x1="${x(i - 1)}" y1="${y(path[i - 1].t)}" x2="${x(i)}" y2="${y(path[i].t)}"/>`;
  }

  // points + labels
  path.forEach((p, i) => {
    const cls = p.kind === "start" ? "g-start" : p.kind === "edge" ? "g-edge" : "g-dot";
    const r = p.kind === "start" ? 6 : 5;
    s += `<circle class="${cls}" cx="${x(i)}" cy="${y(p.t)}" r="${r}"/>`;
    const below = p.t > max * 0.88; // keep labels inside the plot near the top
    s += `<text class="g-label" x="${x(i)}" y="${y(p.t) + (below ? 18 : -9)}">${p.t}</text>`;
  });

  return s + "</svg>";
}

/* ---------- Render ---------- */

function render() {
  const err = $("error");
  let c;
  try {
    c = readInput();
    err.hidden = true;
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    return;
  }

  const results = ALGOS.map((a) => {
    const path = a.fn(c);
    return { ...a, path, total: totalMovement(path, c.countJump) };
  });
  const best = Math.min(...results.map((r) => r.total));

  // summary table
  let tbl = `<tr><th>Algorithm</th><th class="num">Total movement</th><th class="num">Avg / request</th></tr>`;
  results.forEach((r) => {
    const cls = r.total === best ? ' class="best"' : "";
    tbl += `<tr><td${cls}>${r.name}${r.total === best ? " ★" : ""}</td><td class="num"${cls}>${r.total}</td><td class="num">${(r.total / c.reqs.length).toFixed(2)}</td></tr>`;
  });
  $("summaryTable").innerHTML = tbl;
  $("summary").hidden = false;

  // cards
  $("results").innerHTML = results
    .map((r) => {
      const order = r.path
        .map((p, i) => (i === 0 ? `<b>${p.t}</b>` : `${p.jump ? " ⇢ " : " → "}${p.kind === "edge" ? `<i>${p.t}</i>` : p.t}`))
        .join("");
      return `<article class="card">
        <h3>${r.name}${r.full ? ` <small>${r.full}</small>` : ""}<span class="chip">${r.total} tracks</span></h3>
        <p class="order">${order}</p>
        <div class="chart-scroll">${chart(r.path, c.tracks)}</div>
      </article>`;
    })
    .join("");
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  render();
  document.activeElement && document.activeElement.blur();
});

let timer;
["requests", "tracks", "head", "dir", "countJump"].forEach((id) =>
  $(id).addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  })
);

$("example").addEventListener("click", () => {
  $("requests").value = "98, 183, 37, 122, 14, 124, 65, 67";
  $("tracks").value = 200;
  $("head").value = 53;
  $("dir").value = "up";
  render();
});

render();
