// Organizatör ajandası: ay / hafta / liste görünümü, iş ve kapalı gün kayıtları, ödeme takibi,
// çakışma uyarısı, telefon takvimine abonelik (ICS) ve müşteriye WhatsApp teyit mesajı.
import { api, fill, fmtDay, fmtPrice, h, ic, toast } from "/assets/js/ui.js";

export const BOOKING_STATUSES = { option: "Opsiyon", confirmed: "Kesinleşti", done: "Tamamlandı", cancelled: "İptal" };
const TONE = { option: "warn", confirmed: "ok", done: "accent", cancelled: "muted" };
const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso, n) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const weekStart = (iso) => addDays(iso, -((fromIso(iso).getDay() + 6) % 7));
const shortDay = (iso) => fromIso(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const monthTitle = (d) => d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const isJob = (b) => b.kind !== "block";
const active = (b) => b.status !== "cancelled";
const timeRange = (b) => (b.eventTime ? (b.endTime ? `${b.eventTime}–${b.endTime}` : b.eventTime) : "Tüm gün");
const remaining = (b) => Math.max(0, (b.totalAmount || 0) - (b.deposit || 0));
const money = (n) => fmtPrice(n) || "0 ₺";

function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = `9${d}`;
  if (d.length === 10 && d.startsWith("5")) d = `90${d}`;
  return d.length === 12 && d.startsWith("905") ? d : "";
}

function confirmMessage(b, company, listingTitle) {
  const lines = [
    `Merhaba ${b.clientName},`,
    `${fmtDay(b.eventDate)}${b.eventTime ? ` ${timeRange(b)}` : ""} tarihli${listingTitle ? ` "${listingTitle}"` : ""} randevunuz ${company} takvimine kaydedildi.`,
    b.location && `Adres: ${b.location}`,
    b.totalAmount && `Toplam: ${money(b.totalAmount)} · Alınan: ${money(b.deposit)} · Kalan: ${money(remaining(b))}`,
    "Görüşmek üzere!",
  ];
  return lines.filter(Boolean).join("\n");
}

let mode = "month"; // ay / hafta / liste (sekmeler arasında hatırlanır)

// ctx: { state, field, statusLine, setStatus, openDialog, BLACKLIST_REASONS }
export async function renderAgenda(root, ctx) {
  const { state, field, statusLine, setStatus, openDialog } = ctx;
  document.title = `Ajanda | ${state.siteName}`;
  fill(root, h("h2", { class: "acc-title" }, "Ajanda"), h("p", { class: "loading" }, "Yükleniyor…"));
  let [{ bookings }, settings] = await Promise.all([api("/api/account/bookings"), api("/api/account/agenda")]);

  const today = isoDate(new Date());
  let cursor = fromIso(today); // ay / hafta görünümünün gösterdiği tarih
  let selectedDay = today;
  const list = { q: "", status: "", past: false };
  const listingTitle = (id) => state.listings.find((l) => l.id === id)?.title || "";

  const main = h("div", { class: "ag-main" });
  const reload = async () => {
    bookings = (await api("/api/account/bookings")).bookings;
    render();
  };

  // Durum ya da ödeme gibi hızlı güncellemeler (çakışma kontrolü atlanır; tarih değişmiyor)
  const patch = async (b, changes, message) => {
    await api(`/api/account/bookings/${b.id}`, { method: "PUT", body: { ...b, ...changes, force: true } });
    if (message) toast(message, "success");
    await reload();
  };

  /* ---------- Kayıt kartı ---------- */

  const row = (b, { compact = false } = {}) => {
    const wa = isJob(b) && waNumber(b.clientPhone);
    const rest = remaining(b);
    return h(
      "article",
      { class: `ag-item tone-${isJob(b) ? TONE[b.status] : "block"}${compact ? " is-compact" : ""}` },
      h(
        "button",
        { type: "button", class: "ag-item-main", onclick: () => bookingDialog(b) },
        h("span", { class: "ag-time" }, compact ? timeRange(b) : `${fmtDay(b.eventDate)} · ${timeRange(b)}`),
        h("strong", {}, isJob(b) ? b.clientName : `Kapalı${b.note ? ` · ${b.note.split("\n")[0]}` : ""}`),
        !compact && isJob(b)
          ? h(
              "span",
              { class: "muted" },
              [listingTitle(b.listingId), b.location, b.clientPhone].filter(Boolean).join(" · "),
            )
          : null,
        !compact && isJob(b) && b.totalAmount
          ? h(
              "span",
              { class: "ag-money" },
              `Toplam ${money(b.totalAmount)} · Alınan ${money(b.deposit)} · `,
              h("b", { class: rest ? "is-due" : "is-paid" }, rest ? `Kalan ${money(rest)}` : "Ödendi"),
            )
          : null,
      ),
      compact
        ? null
        : h(
            "div",
            { class: "ag-item-side" },
            isJob(b) ? h("span", { class: `status status-${TONE[b.status]}` }, BOOKING_STATUSES[b.status]) : null,
            wa
              ? h(
                  "a",
                  {
                    class: "btn btn-whatsapp btn-sm",
                    href: `https://wa.me/${wa}?text=${encodeURIComponent(confirmMessage(b, state.user.company, listingTitle(b.listingId)))}`,
                    target: "_blank",
                    rel: "noopener",
                    title: "Müşteriye randevu teyidi gönder",
                  },
                  ic("whatsapp"),
                  "Teyit",
                )
              : null,
            isJob(b) && rest && active(b)
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn-light btn-sm",
                    onclick: () => patch(b, { deposit: b.totalAmount }, "Ödemenin tamamı alındı olarak işaretlendi."),
                  },
                  "Ödendi",
                )
              : null,
          ),
    );
  };

  /* ---------- Özet ---------- */

  const summary = (items, label) => {
    const jobs = items.filter((b) => isJob(b) && active(b));
    const total = jobs.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paid = jobs.reduce((s, b) => s + (b.deposit || 0), 0);
    return h(
      "div",
      { class: "ag-summary", "aria-label": label },
      h("div", {}, h("span", {}, "İş"), h("strong", {}, String(jobs.length))),
      h("div", {}, h("span", {}, "Toplam tutar"), h("strong", {}, money(total))),
      h("div", {}, h("span", {}, "Alınan"), h("strong", {}, money(paid))),
      h(
        "div",
        { class: total - paid ? "is-due" : "" },
        h("span", {}, "Kalan alacak"),
        h("strong", {}, money(total - paid)),
      ),
    );
  };

  /* ---------- Ay ---------- */

  function monthView() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const monthKey = isoDate(first).slice(0, 7);
    const byDay = {};
    for (const b of bookings) if (active(b)) (byDay[b.eventDate] ||= []).push(b);
    const cells = [];
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push(h("span", { class: "cal-cell is-empty" }));
    for (let d = 1; d <= days; d++) {
      const key = `${monthKey}-${pad(d)}`;
      const items = byDay[key] || [];
      const jobs = items.filter(isJob);
      const closed = items.some((b) => !isJob(b) && !b.eventTime);
      const full = closed || jobs.length >= settings.dailyCapacity;
      cells.push(
        h(
          "button",
          {
            type: "button",
            class: [
              "cal-cell ag-cell",
              jobs.length && "has-booking",
              full && "is-full",
              closed && "is-closed",
              key === today && "is-today",
              key === selectedDay && "is-selected",
              key < today && "is-past",
            ]
              .filter(Boolean)
              .join(" "),
            onclick: () => {
              selectedDay = key;
              render();
            },
            "aria-label": `${d}${jobs.length ? `, ${jobs.length} iş` : ""}${closed ? ", kapalı" : ""}`,
          },
          h("span", { class: "ag-daynum" }, String(d)),
          closed ? h("span", { class: "ag-closed" }, "Kapalı") : null,
          jobs.length
            ? h(
                "span",
                { class: "cal-dots" },
                jobs.slice(0, 4).map((b) => h("i", { class: `tone-${TONE[b.status]}` })),
              )
            : null,
        ),
      );
    }
    const dayItems = bookings.filter((b) => b.eventDate === selectedDay);
    const monthItems = bookings.filter((b) => b.eventDate.startsWith(monthKey));
    const upcoming = bookings.filter((b) => b.eventDate >= today && active(b) && isJob(b)).slice(0, 6);
    return [
      summary(monthItems, `${monthTitle(first)} özeti`),
      h(
        "div",
        { class: "crm-layout" },
        h(
          "section",
          { class: "panel crm-cal" },
          h(
            "div",
            { class: "crm-cal-head" },
            h(
              "button",
              {
                type: "button",
                class: "icon-btn",
                "aria-label": "Önceki ay",
                onclick: () => {
                  cursor = new Date(first.getFullYear(), first.getMonth() - 1, 1);
                  render();
                },
              },
              ic("chevron", "icon rot-left"),
            ),
            h("h3", {}, monthTitle(first)),
            h(
              "button",
              {
                type: "button",
                class: "icon-btn",
                "aria-label": "Sonraki ay",
                onclick: () => {
                  cursor = new Date(first.getFullYear(), first.getMonth() + 1, 1);
                  render();
                },
              },
              ic("chevron"),
            ),
          ),
          h(
            "div",
            { class: "cal-grid" },
            WEEKDAYS.map((w) => h("span", { class: "cal-head" }, w)),
            cells,
          ),
          h(
            "p",
            { class: "cal-legend ag-legend" },
            Object.entries(BOOKING_STATUSES)
              .filter(([k]) => k !== "cancelled")
              .map(([k, v]) => h("span", {}, h("i", { class: `tone-${TONE[k]}` }), v)),
            h("span", {}, h("i", { class: "tone-full" }), "Dolu gün"),
          ),
        ),
        h(
          "section",
          { class: "panel ag-day" },
          h(
            "div",
            { class: "panel-head" },
            h("h3", {}, fmtDay(selectedDay)),
            h(
              "div",
              { class: "ag-day-actions" },
              h(
                "button",
                {
                  type: "button",
                  class: "btn btn-light btn-sm",
                  onclick: () => bookingDialog({ kind: "block", eventDate: selectedDay }),
                },
                "Kapalı işaretle",
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "btn btn-action btn-sm",
                  onclick: () => bookingDialog({ eventDate: selectedDay }),
                },
                ic("plus"),
                "İş ekle",
              ),
            ),
          ),
          dayItems.length ? dayItems.map((b) => row(b)) : h("p", { class: "muted" }, "Bu güne kayıt yok."),
        ),
      ),
      h(
        "section",
        { class: "panel" },
        h("h3", {}, "Yaklaşan işler"),
        upcoming.length ? upcoming.map((b) => row(b)) : h("p", { class: "muted" }, "Yaklaşan iş yok."),
      ),
    ];
  }

  /* ---------- Hafta ---------- */

  function weekView() {
    const start = weekStart(isoDate(cursor));
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const items = bookings.filter((b) => b.eventDate >= days[0] && b.eventDate <= days[6]);
    const move = (n) => {
      cursor = fromIso(addDays(start, n * 7));
      render();
    };
    return [
      summary(items, "Hafta özeti"),
      h(
        "section",
        { class: "panel" },
        h(
          "div",
          { class: "crm-cal-head" },
          h(
            "button",
            { type: "button", class: "icon-btn", "aria-label": "Önceki hafta", onclick: () => move(-1) },
            ic("chevron", "icon rot-left"),
          ),
          h("h3", {}, `${shortDay(days[0])} – ${shortDay(days[6])}`),
          h(
            "button",
            { type: "button", class: "icon-btn", "aria-label": "Sonraki hafta", onclick: () => move(1) },
            ic("chevron"),
          ),
        ),
        h(
          "div",
          { class: "ag-week" },
          days.map((day, i) => {
            const dayItems = items.filter((b) => b.eventDate === day && active(b));
            return h(
              "div",
              { class: `ag-col${day === today ? " is-today" : ""}${day < today ? " is-past" : ""}` },
              h("header", {}, h("b", {}, WEEKDAYS[i]), h("span", {}, shortDay(day))),
              dayItems.map((b) => row(b, { compact: true })),
              h(
                "button",
                {
                  type: "button",
                  class: "ag-add",
                  "aria-label": `${shortDay(day)} için iş ekle`,
                  onclick: () => bookingDialog({ eventDate: day }),
                },
                ic("plus"),
              ),
            );
          }),
        ),
      ),
    ];
  }

  /* ---------- Liste ---------- */

  function listView() {
    const q = list.q.trim().toLocaleLowerCase("tr");
    const items = bookings
      .filter((b) => list.past || b.eventDate >= today)
      .filter((b) => !list.status || (list.status === "block" ? !isJob(b) : isJob(b) && b.status === list.status))
      .filter(
        (b) =>
          !q ||
          [b.clientName, b.clientPhone, b.location, b.note, listingTitle(b.listingId)]
            .join(" ")
            .toLocaleLowerCase("tr")
            .includes(q),
      );
    const sorted = list.past ? [...items].reverse() : items;
    const groups = new Map();
    for (const b of sorted) {
      const key = b.eventDate.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    const search = h("input", {
      type: "search",
      class: "ag-search",
      placeholder: "Müşteri, telefon, mekân ya da not ara…",
      value: list.q,
      oninput: (e) => {
        list.q = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const again = root.querySelector(".ag-search");
        again?.focus();
        again?.setSelectionRange(pos, pos);
      },
    });
    return [
      h(
        "div",
        { class: "ag-filters" },
        search,
        h(
          "div",
          { class: "acc-counts" },
          [["", "Tümü"], ...Object.entries(BOOKING_STATUSES), ["block", "Kapalı"]].map(([k, v]) =>
            h(
              "button",
              {
                type: "button",
                class: `chip${list.status === k ? " is-active" : ""}`,
                "aria-pressed": String(list.status === k),
                onclick: () => {
                  list.status = k;
                  render();
                },
              },
              v,
            ),
          ),
        ),
        h(
          "label",
          { class: "check" },
          h("input", {
            type: "checkbox",
            checked: list.past,
            onchange: (e) => {
              list.past = e.target.checked;
              render();
            },
          }),
          h("span", {}, "Geçmiş kayıtları da göster"),
        ),
      ),
      summary(items, "Listelenen kayıtların özeti"),
      groups.size
        ? [...groups].map(([key, group]) =>
            h(
              "section",
              { class: "panel ag-group" },
              h("h3", {}, monthTitle(fromIso(`${key}-01`))),
              group.map((b) => row(b)),
            ),
          )
        : h(
            "div",
            { class: "empty-state is-compact" },
            h("span", { class: "empty-icon" }, ic("calendar")),
            h("h2", {}, "Kayıt bulunamadı"),
          ),
    ];
  }

  /* ---------- Kayıt penceresi ---------- */

  function bookingDialog(b) {
    let kind = b.kind === "block" ? "block" : "job";
    const status = statusLine();
    const form = h("form", { class: "form-grid", novalidate: true });
    const inputs = {
      clientName: h("input", { name: "clientName", value: b.clientName || "", maxlength: 80, required: true }),
      clientPhone: h("input", {
        name: "clientPhone",
        type: "tel",
        value: b.clientPhone || "",
        placeholder: "05xx xxx xx xx",
      }),
      eventDate: h("input", { name: "eventDate", type: "date", value: b.eventDate || today, required: true }),
      eventTime: h("input", { name: "eventTime", type: "time", value: b.eventTime || "" }),
      endTime: h("input", { name: "endTime", type: "time", value: b.endTime || "" }),
      location: h("input", {
        name: "location",
        value: b.location || "",
        maxlength: 160,
        placeholder: "Mekân adı ya da adres",
      }),
      listingId: h(
        "select",
        { name: "listingId" },
        h("option", { value: "" }, "Seçilmedi"),
        state.listings.map((l) => h("option", { value: l.id, selected: l.id === b.listingId }, l.title)),
      ),
      status: h(
        "select",
        { name: "status" },
        Object.entries(BOOKING_STATUSES).map(([k, v]) =>
          h("option", { value: k, selected: k === (b.status || "option") }, v),
        ),
      ),
      totalAmount: h("input", {
        name: "totalAmount",
        inputmode: "numeric",
        value: b.totalAmount || "",
        placeholder: "0",
      }),
      deposit: h("input", { name: "deposit", inputmode: "numeric", value: b.deposit || "", placeholder: "0" }),
      note: h("textarea", { name: "note", rows: 2, maxlength: 1000, value: b.note || "" }),
    };
    const num = (el) => Number(String(el.value).replace(/\D/g, "")) || 0;
    const due = h("p", { class: "ag-due field-full" });
    const updateDue = () => {
      const rest = Math.max(0, num(inputs.totalAmount) - num(inputs.deposit));
      fill(
        due,
        num(inputs.totalAmount)
          ? [
              h("span", {}, "Kalan: ", h("b", { class: rest ? "is-due" : "is-paid" }, rest ? money(rest) : "Ödendi")),
              rest
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "link-btn",
                      onclick: () => {
                        inputs.deposit.value = String(num(inputs.totalAmount));
                        updateDue();
                      },
                    },
                    "Tamamı alındı",
                  )
                : null,
            ]
          : null,
      );
    };
    inputs.totalAmount.addEventListener("input", updateDue);
    inputs.deposit.addEventListener("input", updateDue);

    const kindSwitch = h("div", { class: "ag-kind field-full", role: "tablist" });
    const layout = () => {
      fill(
        kindSwitch,
        [
          ["job", "Müşteri işi"],
          ["block", "Kapalı gün / saat"],
        ].map(([k, label]) =>
          h(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": String(kind === k),
              class: kind === k ? "is-active" : "",
              onclick: () => {
                kind = k;
                layout();
              },
            },
            label,
          ),
        ),
      );
      const job = kind === "job";
      fill(
        form,
        b.id ? null : kindSwitch,
        job ? field("Müşteri adı", inputs.clientName) : null,
        job ? field("Müşteri telefonu", inputs.clientPhone) : null,
        field("Tarih", inputs.eventDate),
        h(
          "div",
          { class: "ag-times" },
          field(job ? "Başlangıç saati" : "Başlangıç (boşsa tüm gün)", inputs.eventTime),
          field("Bitiş saati", inputs.endTime),
        ),
        job ? field("Adres / mekân", inputs.location, { wide: true }) : null,
        job ? field("İlan", inputs.listingId) : null,
        job ? field("Durum", inputs.status) : null,
        job ? field("Toplam tutar (₺)", inputs.totalAmount) : null,
        job ? field("Alınan ödeme / kapora (₺)", inputs.deposit) : null,
        job ? due : null,
        field(job ? "Not" : "Açıklama (ör. yıllık izin)", inputs.note, { wide: true }),
      );
      updateDue();
    };
    layout();

    const save = async (force = false) => {
      const body = { ...Object.fromEntries(new FormData(form)), kind, force };
      if (kind === "block" && !body.clientName) body.clientName = "Kapalı";
      try {
        const result = await api(b.id ? `/api/account/bookings/${b.id}` : "/api/account/bookings", {
          method: b.id ? "PUT" : "POST",
          body,
        });
        if (result.warning) {
          toast(
            result.warning.blocked
              ? "Dikkat: Bu müşteri numarası kara listede (engellenmiş)."
              : `Dikkat: Bu numara hakkında ${result.warning.reports} kötü niyet ihbarı var.`,
            "error",
          );
        } else toast(kind === "block" ? "Kapalı zaman kaydedildi." : "İş kaydedildi.", "success");
        dialog.close();
        selectedDay = body.eventDate;
        cursor = fromIso(body.eventDate);
        await reload();
      } catch (err) {
        if (err.status === 409 && err.data?.conflicts) {
          fill(
            status,
            h("strong", {}, "Bu zamanda başka kayıt var: "),
            err.data.conflicts
              .map((c) => `${c.kind === "block" ? "Kapalı" : c.clientName} (${timeRange(c)})`)
              .join(", "),
            ". ",
            h("button", { type: "button", class: "link-btn", onclick: () => save(true) }, "Yine de kaydet"),
          );
          status.className = "form-status is-error";
          return;
        }
        setStatus(status, err.message, "error");
      }
    };
    const dialog = openDialog(
      b.id
        ? kind === "block"
          ? "Kapalı zamanı düzenle"
          : "İşi düzenle"
        : kind === "block"
          ? "Kapalı zaman"
          : "Yeni iş",
      form,
      status,
      h(
        "div",
        { class: "dialog-actions" },
        b.id
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-ghost danger",
                onclick: async () => {
                  if (!confirm("Kayıt silinsin mi?")) return;
                  await api(`/api/account/bookings/${b.id}`, { method: "DELETE" });
                  dialog.close();
                  await reload();
                },
              },
              "Sil",
            )
          : null,
        h("button", { type: "button", class: "btn btn-primary", onclick: () => save() }, "Kaydet"),
      ),
    );
  }

  /* ---------- Ayarlar: kapasite ve telefon takvimi ---------- */

  function settingsDialog() {
    const status = statusLine();
    const capacity = h("input", { type: "number", min: 1, max: 10, value: settings.dailyCapacity });
    const icsBox = h("div", { class: "ag-ics" });
    const drawIcs = () => {
      if (!settings.icsUrl) {
        fill(
          icsBox,
          h(
            "p",
            { class: "panel-lead" },
            "İşleriniz telefonunuzun takviminde (Google Takvim, iPhone Takvim) hatırlatmalarıyla görünsün.",
          ),
          h(
            "button",
            {
              type: "button",
              class: "btn btn-light",
              onclick: async () => {
                settings = await api("/api/account/agenda/ics", { method: "POST", body: {} });
                drawIcs();
              },
            },
            ic("calendar"),
            "Telefon takvimime bağla",
          ),
        );
        return;
      }
      const webcal = settings.icsUrl.replace(/^https?:/, "webcal:");
      const input = h("input", { value: settings.icsUrl, readonly: true, onfocus: (e) => e.target.select() });
      fill(
        icsBox,
        field("Takvim bağlantınız (kimseyle paylaşmayın)", input),
        h(
          "div",
          { class: "ag-ics-actions" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn-light btn-sm",
              onclick: async () => {
                try {
                  await navigator.clipboard.writeText(settings.icsUrl);
                  toast("Bağlantı kopyalandı.", "success");
                } catch {
                  input.select();
                }
              },
            },
            "Kopyala",
          ),
          h(
            "a",
            {
              class: "btn btn-light btn-sm",
              href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
              target: "_blank",
              rel: "noopener",
            },
            "Google Takvim'e ekle",
          ),
          h("a", { class: "btn btn-light btn-sm", href: webcal }, "iPhone / Mac takvimine ekle"),
        ),
        h(
          "ul",
          { class: "ag-help" },
          h("li", {}, "Google Takvim (bilgisayar): Diğer takvimler › + › URL ile › bağlantıyı yapıştırın."),
          h("li", {}, "iPhone: Ayarlar › Takvim › Hesaplar › Hesap Ekle › Diğer › Takvim Aboneliği Ekle."),
          h("li", {}, "Takvim uygulamaları yeni kayıtları birkaç saatte bir çeker; Google gecikmeli güncelleyebilir."),
        ),
        h(
          "div",
          { class: "ag-ics-actions" },
          h(
            "button",
            {
              type: "button",
              class: "link-btn",
              onclick: async () => {
                if (!confirm("Yeni bağlantı oluşturulsun mu? Eski bağlantıyı ekleyen takvimler güncellenmez.")) return;
                settings = await api("/api/account/agenda/ics", { method: "POST", body: {} });
                drawIcs();
              },
            },
            "Bağlantıyı yenile",
          ),
          h(
            "button",
            {
              type: "button",
              class: "link-btn danger",
              onclick: async () => {
                settings = await api("/api/account/agenda/ics", { method: "DELETE" });
                drawIcs();
              },
            },
            "Bağlantıyı kapat",
          ),
        ),
      );
    };
    drawIcs();
    const dialog = openDialog(
      "Ajanda ayarları",
      field("Günde en fazla kaç iş alırsınız?", capacity, {
        help: "Bu sayıya ulaşan gün ilanınızda dolu görünür. Saatleri çakışan işler için her durumda uyarı verilir.",
      }),
      h("h3", { class: "ag-sub" }, "Telefon takvimi"),
      icsBox,
      status,
      h(
        "div",
        { class: "dialog-actions" },
        h(
          "button",
          {
            type: "button",
            class: "btn btn-primary",
            onclick: async () => {
              try {
                settings = await api("/api/account/agenda", { method: "PUT", body: { dailyCapacity: capacity.value } });
                toast("Ajanda ayarları kaydedildi.", "success");
                dialog.close();
                render();
              } catch (err) {
                setStatus(status, err.message, "error");
              }
            },
          },
          "Kaydet",
        ),
      ),
    );
  }

  /* ---------- Kara liste bildirimi ---------- */

  const blStatus = statusLine();
  const blForm = h(
    "form",
    {
      class: "panel",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const result = await api("/api/account/blacklist", {
            method: "POST",
            body: Object.fromEntries(new FormData(blForm)),
          });
          blForm.reset();
          setStatus(
            blStatus,
            result.blocked ? "Bildiriminiz alındı. Bu numara artık engellendi." : "Bildiriminiz alındı. Teşekkürler.",
            "success",
          );
        } catch (err) {
          setStatus(blStatus, err.message, "error");
        }
      },
    },
    h("h2", {}, "Kötü niyetli müşteri bildir"),
    h(
      "p",
      { class: "panel-lead" },
      "Asılsız adres veren ya da kapıda iptal eden müşterileri bildirin. Farklı organizatörlerden 2 ihbar alan numara kalıcı olarak engellenir ve iletişim bilgilerini göremez.",
    ),
    h(
      "div",
      { class: "form-grid" },
      field(
        "Müşteri telefonu",
        h("input", { name: "phone", type: "tel", required: true, placeholder: "05xx xxx xx xx" }),
      ),
      field(
        "Neden",
        h(
          "select",
          { name: "reason" },
          Object.entries(ctx.BLACKLIST_REASONS).map(([k, v]) => h("option", { value: k }, v)),
        ),
      ),
      field("Açıklama (isteğe bağlı)", h("textarea", { name: "note", rows: 2, maxlength: 500 }), { wide: true }),
    ),
    blStatus,
    h("div", { class: "panel-actions" }, h("button", { class: "btn btn-light", type: "submit" }, "Bildir")),
  );

  /* ---------- Sayfa ---------- */

  function render() {
    // Tarihi geçen kesinleşmiş işler: tek dokunuşla "Tamamlandı" yapılır.
    const overdue = bookings.filter((b) => isJob(b) && b.status === "confirmed" && b.eventDate < today);
    const tabs = h(
      "div",
      { class: "ag-tabs", role: "tablist" },
      [
        ["month", "Ay"],
        ["week", "Hafta"],
        ["list", "Liste"],
      ].map(([k, label]) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(mode === k),
            class: mode === k ? "is-active" : "",
            onclick: () => {
              mode = k;
              render();
            },
          },
          label,
        ),
      ),
    );
    fill(
      main,
      overdue.length
        ? h(
            "div",
            { class: "ag-notice" },
            h("span", {}, `${overdue.length} kesinleşmiş işin tarihi geçti.`),
            h(
              "button",
              {
                type: "button",
                class: "btn btn-light btn-sm",
                onclick: async () => {
                  for (const b of overdue) {
                    await api(`/api/account/bookings/${b.id}`, {
                      method: "PUT",
                      body: { ...b, status: "done", force: true },
                    });
                  }
                  toast(`${overdue.length} iş tamamlandı olarak işaretlendi.`, "success");
                  await reload();
                },
              },
              "Hepsini tamamlandı yap",
            ),
          )
        : null,
      h(
        "div",
        { class: "ag-bar" },
        tabs,
        h("span", { class: "muted small" }, `Günlük kapasite: ${settings.dailyCapacity} iş`),
      ),
      mode === "week" ? weekView() : mode === "list" ? listView() : monthView(),
    );
  }

  fill(
    root,
    h(
      "div",
      { class: "acc-toolbar" },
      h("h2", { class: "acc-title" }, "Ajanda"),
      h(
        "div",
        { class: "ag-toolbar-actions" },
        h(
          "button",
          { type: "button", class: "btn btn-light", onclick: settingsDialog },
          ic("calendar"),
          "Ayarlar ve telefon takvimi",
        ),
        h(
          "button",
          { type: "button", class: "btn btn-action", onclick: () => bookingDialog({ eventDate: selectedDay }) },
          ic("plus"),
          "Yeni iş",
        ),
      ),
    ),
    main,
    blForm,
  );

  // "Talepler"den gelen kayıt taslağı: ilgili ay açılır ve form doldurulmuş gelir.
  const draft = state.bookingDraft;
  state.bookingDraft = null;
  if (draft?.eventDate) {
    cursor = fromIso(draft.eventDate);
    selectedDay = draft.eventDate;
  }
  render();
  if (draft) bookingDialog(draft);
  if (state.blacklistPhone) {
    blForm.phone.value = state.blacklistPhone;
    state.blacklistPhone = "";
    blForm.scrollIntoView({ behavior: "smooth", block: "center" });
    blForm.reason.focus();
  }
}
