const list = document.getElementById("list");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const search = document.getElementById("search");
const template = document.getElementById("item");
const clearBtn = document.getElementById("clear");

const isTab = new URLSearchParams(location.search).has("tab");
if (isTab) {
  document.body.classList.add("tab");
  document.getElementById("open-tab").hidden = true;
}

let snippets = [];

async function load() {
  ({ snippets = [] } = await browser.storage.local.get("snippets"));
  render();
}

function render() {
  const q = search.value.trim().toLowerCase();
  const shown = q
    ? snippets.filter((s) => [s.text, s.title, s.url].some((v) => v?.toLowerCase().includes(q)))
    : snippets;

  list.replaceChildren();
  for (const s of shown) list.append(renderItem(s));

  count.textContent = snippets.length ? `(${snippets.length})` : "";
  empty.hidden = snippets.length > 0;
}

// All snippet content is inserted with textContent / attributes, never innerHTML,
// so text copied from a hostile page can't run as markup here.
function renderItem(s) {
  const li = template.content.firstElementChild.cloneNode(true);

  const text = li.querySelector(".text");
  text.textContent = s.text;
  text.title = "Click to expand";
  text.addEventListener("click", () => text.classList.toggle("expanded"));

  const link = li.querySelector(".source");
  const safeUrl = /^https?:|^file:/i.test(s.url) ? s.url : "";
  if (safeUrl) link.href = safeUrl;
  link.textContent = s.title || s.url || "Unknown page";
  link.title = s.url;

  const time = li.querySelector("time");
  const d = new Date(s.savedAt);
  time.dateTime = s.savedAt;
  time.textContent = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  li.querySelector(".copy").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(s.text);
    e.target.textContent = "Copied";
    setTimeout(() => (e.target.textContent = "Copy"), 1200);
  });

  li.querySelector(".delete").addEventListener("click", async () => {
    snippets = snippets.filter((x) => x.id !== s.id);
    await browser.storage.local.set({ snippets });
  });

  return li;
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

document.getElementById("export-json").addEventListener("click", () => {
  download(`snippets-${stamp()}.json`, JSON.stringify(snippets, null, 2), "application/json");
});

document.getElementById("export-md").addEventListener("click", () => {
  const md = snippets
    .map((s) => {
      const quote = s.text.split("\n").map((l) => `> ${l}`).join("\n");
      const when = new Date(s.savedAt).toLocaleString();
      return `${quote}\n\n— [${s.title || s.url}](${s.url}), ${when}`;
    })
    .join("\n\n---\n\n");
  download(`snippets-${stamp()}.md`, `# Snippets\n\n${md}\n`, "text/markdown");
});

// Two-step confirm: alert()/confirm() don't work in Firefox extension popups.
let clearArmed = false;
clearBtn.addEventListener("click", async () => {
  if (!snippets.length) return;
  if (!clearArmed) {
    clearArmed = true;
    clearBtn.textContent = "Click again to delete all";
    setTimeout(() => {
      clearArmed = false;
      clearBtn.textContent = "Delete all";
    }, 3000);
    return;
  }
  await browser.storage.local.set({ snippets: [] });
});

document.getElementById("open-tab").addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("popup.html?tab") });
  window.close();
});

search.addEventListener("input", render);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.snippets) {
    snippets = changes.snippets.newValue || [];
    render();
  }
});

load();
