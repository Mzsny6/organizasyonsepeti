// Yönetim paneli > Ziyaret istatistikleri: özet kutucuklar, günlük ziyaret grafiği, saat dağılımı,
// sayfalar, kaynaklar, şehirler, cihazlar, tarayıcılar ve sitede yapılan aramalar.
// Grafikler bağımlılıksız SVG'dir; değerler tabloda da gösterilir (grafiğe bakmadan okunabilir).
import { api, fill, h } from "/assets/js/ui.js";

const NOTRACK = "os_notrack";
const PERIODS = [
  [1, "Bugün"],
  [7, "Son 7 gün"],
  [30, "Son 30 gün"],
  [90, "Son 90 gün"],
];
const SERIES = [
  { key: "visitors", label: "Tekil ziyaretçi", cls: "s-visitors" },
  { key: "views", label: "Görüntülenme", cls: "s-views" },
];
const EVENT_LABELS = {
  phone: "Telefon araması",
  whatsapp: "WhatsApp mesajı",
  request: "Teklif talebi",
  signup: "Yeni organizatör",
  listing: "Yeni ilan",
  review: "Değerlendirme",
};

let days = 7;

const num = (n) => Number(n || 0).toLocaleString("tr-TR");
const compact = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn`
    : n >= 1e4
      ? `${(n / 1e3).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} B`
      : num(n);
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const longDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// 0'dan başlayan, "yuvarlak" en fazla 4 aralıklı eksen
function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value / 4));
  const unit = [1, 2, 2.5, 5, 10].find((m) => value / 4 <= m * step) * step;
  return unit * 4;
}

// Değeri yuvarlatılmış (4px) uçlu, tabanı düz bir sütun yolu
function columnPath(x, y, w, height) {
  const r = Math.min(4, w / 2, height);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${bottom}Z`;
}

function delta(current, previous) {
  if (!previous) return current ? h("span", { class: "kpi-delta" }, "Önceki dönemde veri yok") : null;
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return h(
    "span",
    { class: `kpi-delta ${change === 0 ? "" : up ? "is-up" : "is-down"}` },
    `${change === 0 ? "■" : up ? "▲" : "▼"} %${Math.abs(change)} önceki döneme göre`,
  );
}

function kpi(label, value, note) {
  return h("div", { class: "kpi" }, h("span", { class: "kpi-label" }, label), h("strong", {}, value), note);
}

/* ---------- Günlük ziyaret: iki seri, ortak eksen, imleç + ipucu ---------- */

function lineChart(daily) {
  const box = h("div", { class: "viz" });
  const tip = h("div", { class: "viz-tip", hidden: true, role: "status" });
  const legend = h(
    "div",
    { class: "viz-legend" },
    SERIES.map((se) => h("span", {}, h("i", { class: `key-line ${se.cls}` }), se.label)),
    h("span", { class: "viz-legend-note" }, h("i", { class: "key-line is-partial" }), "Bugün (gün devam ediyor)"),
  );
  const draw = () => {
    const width = Math.max(320, box.clientWidth);
    const height = 240;
    const pad = { top: 16, right: 64, bottom: 28, left: 44 };
    const w = width - pad.left - pad.right;
    const ht = height - pad.top - pad.bottom;
    const max = niceMax(Math.max(...daily.map((d) => d.views), 0));
    const x = (i) => pad.left + (daily.length === 1 ? w / 2 : (i / (daily.length - 1)) * w);
    const y = (v) => pad.top + ht - (v / max) * ht;
    const svg = s("svg", { width, height, class: "viz-svg", role: "img", "aria-label": "Günlük ziyaret grafiği" });
    for (let i = 0; i <= 4; i++) {
      const value = (max / 4) * i;
      svg.append(s("line", { x1: pad.left, x2: pad.left + w, y1: y(value), y2: y(value), class: "viz-grid" }));
      svg.append(
        s("text", { x: pad.left - 8, y: y(value) + 4, class: "viz-tick", "text-anchor": "end" }, compact(value)),
      );
    }
    const labelIdx = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
    for (const i of labelIdx) {
      const anchor = i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle";
      svg.append(
        s("text", { x: x(i), y: height - 8, class: "viz-tick", "text-anchor": anchor }, shortDate(daily[i].date)),
      );
    }
    const ends = [];
    for (const se of SERIES) {
      // Son gün bugündür ve henüz bitmedi: o parça kesikli çizilir (düşüş gibi görünmesin)
      const pathOf = (from, to) =>
        daily
          .slice(from, to + 1)
          .map((p, k) => `${k ? "L" : "M"}${x(from + k)},${y(p[se.key])}`)
          .join("");
      const lastIdx = daily.length - 1;
      if (lastIdx > 0) {
        svg.append(s("path", { d: pathOf(0, lastIdx - 1), class: `viz-line ${se.cls}` }));
        svg.append(s("path", { d: pathOf(lastIdx - 1, lastIdx), class: `viz-line is-partial ${se.cls}` }));
      }
      const last = daily.at(-1);
      svg.append(s("circle", { cx: x(daily.length - 1), cy: y(last[se.key]), r: 4, class: `viz-dot ${se.cls}` }));
      ends.push({ y: y(last[se.key]), text: compact(last[se.key]) });
    }
    // Uç etiketleri: çakışırsa yalnızca üstteki yazılır (ayrıntı ipucunda ve tabloda)
    ends.sort((a, b) => a.y - b.y);
    ends.forEach((e, i) => {
      if (i && e.y - ends[i - 1].y < 14) return;
      svg.append(s("text", { x: pad.left + w + 10, y: e.y + 4, class: "viz-end" }, e.text));
    });
    const cross = s("line", { y1: pad.top, y2: pad.top + ht, class: "viz-cross", visibility: "hidden" });
    const hover = SERIES.map((se) => s("circle", { r: 5, class: `viz-dot ${se.cls}`, visibility: "hidden" }));
    const hit = s("rect", { x: pad.left - 10, y: 0, width: w + 20, height, fill: "transparent", tabindex: 0 });
    svg.append(cross, ...hover, hit);
    const show = (i) => {
      const p = daily[i];
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("visibility", "visible");
      SERIES.forEach((se, k) => {
        hover[k].setAttribute("cx", x(i));
        hover[k].setAttribute("cy", y(p[se.key]));
        hover[k].setAttribute("visibility", "visible");
      });
      fill(
        tip,
        h("strong", { class: "viz-tip-title" }, longDate(p.date)),
        SERIES.map((se) =>
          h("span", {}, h("i", { class: `key-line ${se.cls}` }), h("b", {}, num(p[se.key])), se.label),
        ),
      );
      tip.hidden = false;
      const left = Math.min(Math.max(x(i) + 12, 0), width - tip.offsetWidth - 4);
      tip.style.left = `${x(i) > width / 2 ? x(i) - tip.offsetWidth - 12 : left}px`;
      tip.style.top = `${pad.top}px`;
    };
    const hide = () => {
      tip.hidden = true;
      cross.setAttribute("visibility", "hidden");
      hover.forEach((c) => c.setAttribute("visibility", "hidden"));
    };
    let focusIdx = daily.length - 1;
    hit.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      focusIdx = Math.round(((px - pad.left) / w) * (daily.length - 1));
      show(Math.min(daily.length - 1, Math.max(0, focusIdx)));
    });
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("focus", () => show(focusIdx));
    hit.addEventListener("blur", hide);
    hit.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      focusIdx = Math.min(daily.length - 1, Math.max(0, focusIdx + (e.key === "ArrowRight" ? 1 : -1)));
      show(focusIdx);
    });
    fill(box, svg, tip);
  };
  new ResizeObserver(draw).observe(box);
  const table = h(
    "details",
    { class: "viz-table" },
    h("summary", {}, "Tablo olarak göster"),
    h(
      "table",
      { class: "table" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Gün"),
          SERIES.map((se) => h("th", { class: "num" }, se.label)),
        ),
      ),
      h(
        "tbody",
        {},
        [...daily].reverse().map((p) =>
          h(
            "tr",
            {},
            h("td", {}, longDate(p.date)),
            SERIES.map((se) => h("td", { class: "num" }, num(p[se.key]))),
          ),
        ),
      ),
    ),
  );
  return [legend, box, table];
}

/* ---------- Saatlere göre: tek seri sütun grafik ---------- */

function hourChart(hours) {
  const box = h("div", { class: "viz" });
  const tip = h("div", { class: "viz-tip", hidden: true, role: "status" });
  const draw = () => {
    const width = Math.max(320, box.clientWidth);
    const height = 200;
    const pad = { top: 12, right: 8, bottom: 26, left: 44 };
    const w = width - pad.left - pad.right;
    const ht = height - pad.top - pad.bottom;
    const max = niceMax(Math.max(...hours, 0));
    const slot = w / 24;
    const barW = Math.min(24, slot - 2);
    const svg = s("svg", { width, height, class: "viz-svg", role: "img", "aria-label": "Saatlere göre görüntülenme" });
    for (let i = 0; i <= 4; i++) {
      const value = (max / 4) * i;
      const yy = pad.top + ht - (value / max) * ht;
      svg.append(s("line", { x1: pad.left, x2: pad.left + w, y1: yy, y2: yy, class: "viz-grid" }));
      svg.append(s("text", { x: pad.left - 8, y: yy + 4, class: "viz-tick", "text-anchor": "end" }, compact(value)));
    }
    hours.forEach((n, hour) => {
      const cx = pad.left + slot * hour + slot / 2;
      const bh = (n / max) * ht;
      if (hour % 3 === 0)
        svg.append(
          s(
            "text",
            { x: cx, y: height - 8, class: "viz-tick", "text-anchor": "middle" },
            String(hour).padStart(2, "0"),
          ),
        );
      const g = s("g", { class: "viz-col", tabindex: 0 });
      g.append(s("rect", { x: pad.left + slot * hour, y: pad.top, width: slot, height: ht, fill: "transparent" }));
      if (n) g.append(s("path", { d: columnPath(cx - barW / 2, pad.top + ht - bh, barW, bh), class: "viz-bar" }));
      const show = () => {
        fill(
          tip,
          h(
            "strong",
            { class: "viz-tip-title" },
            `${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:00`,
          ),
          h("span", {}, h("b", {}, num(n)), "görüntülenme"),
        );
        tip.hidden = false;
        tip.style.left = `${Math.min(cx + 10, width - tip.offsetWidth - 4)}px`;
        tip.style.top = `${pad.top}px`;
      };
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("pointerleave", () => (tip.hidden = true));
      g.addEventListener("blur", () => (tip.hidden = true));
      svg.append(g);
    });
    fill(box, svg, tip);
  };
  new ResizeObserver(draw).observe(box);
  return box;
}

/* ---------- Sıralı listeler (değer + oran çubuğu) ---------- */

function rankList(items, { total, labelOf = (x) => x.key, subOf, empty = "Henüz veri yok." } = {}) {
  if (!items.length) return h("p", { class: "empty" }, empty);
  const max = Math.max(...items.map((x) => x.count));
  return h(
    "ol",
    { class: "rank-list" },
    items.map((x) =>
      h(
        "li",
        {},
        h("span", { class: "rank-label" }, labelOf(x), subOf ? h("small", {}, subOf(x)) : null),
        h(
          "span",
          { class: "rank-value" },
          num(x.count),
          total ? h("small", {}, ` %${Math.round((x.count / total) * 100)}`) : null,
        ),
        h("span", { class: "rank-track", "aria-hidden": "true" }, h("i", { style: `width:${(x.count / max) * 100}%` })),
      ),
    ),
  );
}

const card = (title, description, ...body) =>
  h(
    "section",
    { class: "card" },
    h("header", { class: "card-head" }, h("h2", {}, title), description && h("p", {}, description)),
    ...body,
  );

/* ---------- Sayfa ---------- */

export function renderAnalytics() {
  // Yönetici bu sayfayı açtığı cihazda kendi ziyaretlerini varsayılan olarak saymaz.
  let notrack = true;
  try {
    if (localStorage.getItem(NOTRACK) === null) localStorage.setItem(NOTRACK, "1");
    notrack = localStorage.getItem(NOTRACK) === "1";
  } catch {
    notrack = false;
  }
  const body = h("div", { class: "analytics-body" }, h("p", { class: "empty" }, "Yükleniyor…"));
  const periodBar = h("div", { class: "tabs", role: "tablist" });
  const toggle = h(
    "label",
    { class: "check notrack" },
    h("input", {
      type: "checkbox",
      checked: notrack,
      onchange: (e) => {
        try {
          localStorage.setItem(NOTRACK, e.target.checked ? "1" : "0");
        } catch {
          // depolama kapalı
        }
      },
    }),
    h("span", {}, "Bu cihazdan yaptığım ziyaretleri sayma"),
  );

  const load = async () => {
    fill(
      periodBar,
      PERIODS.map(([value, label]) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(days === value),
            class: days === value ? "is-active" : "",
            onclick: () => {
              days = value;
              load();
            },
          },
          label,
        ),
      ),
    );
    body.classList.add("is-loading");
    try {
      const r = await api(`/api/admin/analytics?days=${days}`);
      fill(body, report(r));
    } catch (err) {
      fill(body, h("p", { class: "empty" }, err.message));
    } finally {
      body.classList.remove("is-loading");
    }
  };

  const report = (r) => {
    const t = r.totals;
    const mobile = r.devices.find((d) => d.key === "Mobil")?.count || 0;
    const deviceTotal = r.devices.reduce((sum, d) => sum + d.count, 0);
    const ev = (k) => t.events[k] || 0;
    const evNote = (k) => delta(ev(k), r.previous.events[k] || 0);
    const sourceTotal = r.sources.reduce((sum, x) => sum + x.count, 0);
    return [
      h(
        "div",
        { class: "kpi-row" },
        kpi("Tekil ziyaretçi", num(t.visitors), delta(t.visitors, r.previous.visitors)),
        kpi("Sayfa görüntüleme", num(t.views), delta(t.views, r.previous.views)),
        kpi(
          "Ziyaretçi başına sayfa",
          t.visitors ? (t.views / t.visitors).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "0",
        ),
        kpi("Telefondan gelenler", deviceTotal ? `%${Math.round((mobile / deviceTotal) * 100)}` : "—"),
      ),
      card(
        "Ziyaretçiler ne yaptı?",
        "Ziyaretçilerin organizatörlere ulaştığı ve siteye katkı verdiği anlar.",
        h(
          "div",
          { class: "kpi-row is-compact" },
          ["phone", "whatsapp", "request", "signup", "listing", "review"].map((k) =>
            kpi(EVENT_LABELS[k], num(ev(k)), evNote(k)),
          ),
        ),
      ),
      days > 1 ? card("Günlük ziyaret", `${shortDate(r.from)} – ${shortDate(r.to)}`, ...lineChart(r.daily)) : null,
      card("Saatlere göre", "Sayfa görüntülemelerin günün saatlerine dağılımı (Türkiye saati).", hourChart(r.hours)),
      h(
        "div",
        { class: "analytics-grid" },
        card("En çok bakılan sayfalar", null, rankList(r.pages, { labelOf: (x) => x.title, subOf: (x) => x.key })),
        card(
          "Nereden geldiler?",
          "Ziyaretin başladığı yer. Paylaştığınız bağlantılara ?utm_source=instagram gibi bir ek koyarsanız burada ayrı görünür.",
          rankList(r.sources, { total: sourceTotal }),
        ),
        card(
          "Şehirler",
          "Yaklaşık konum (internet bağlantısının bulunduğu il).",
          rankList(r.cities, { total: deviceTotal }),
        ),
        card(
          "Cihazlar",
          null,
          rankList(r.devices, { total: deviceTotal }),
          h("h3", { class: "sub-head" }, "Tarayıcılar"),
          rankList(r.browsers, { total: deviceTotal }),
        ),
        card(
          "Sitede aranan kelimeler",
          "İlan aramasında yazılan kelimeler; hangi hizmetlerin arandığını gösterir.",
          rankList(r.searches, { empty: "Henüz arama yapılmadı." }),
        ),
      ),
      h(
        "p",
        { class: "analytics-note" },
        "Ziyaretler çerez kullanılmadan ve IP adresi saklanmadan, her gün değişen anonim bir kimlikle sayılır. Arama motoru botları sayılmaz. Veriler 400 gün saklanır.",
      ),
    ];
  };

  load();
  return h("div", { class: "page-body" }, h("div", { class: "analytics-filters" }, periodBar, toggle), body);
}
