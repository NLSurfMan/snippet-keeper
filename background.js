const MENU_ID = "save-snippet";

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: MENU_ID,
    title: "Save snippet",
    contexts: ["selection"],
  });
});

// Read the full selection from the page. The contextMenus API's selectionText
// can be shortened and loses line breaks, so we ask the page directly.
// This only works because activeTab grants access to the current tab for the
// moment the user clicks the menu item or presses the shortcut.
async function readSelection(tabId, frameId) {
  try {
    const target = { tabId };
    if (typeof frameId === "number") target.frameIds = [frameId];
    else target.allFrames = true;

    const results = await browser.scripting.executeScript({
      target,
      func: () => window.getSelection().toString(),
    });
    const hit = results.find((r) => typeof r.result === "string" && r.result.trim());
    return hit ? hit.result : "";
  } catch {
    // Restricted pages (about:, addons.mozilla.org, reader view) refuse scripts.
    return "";
  }
}

async function saveSnippet({ text, url, title, tabId }) {
  const clean = (text || "").trim();
  if (!clean) return;

  const { snippets = [] } = await browser.storage.local.get("snippets");
  snippets.unshift({
    id: crypto.randomUUID(),
    text: clean,
    url: url || "",
    title: title || "",
    savedAt: new Date().toISOString(),
  });
  await browser.storage.local.set({ snippets });

  // Brief confirmation on the toolbar button.
  if (tabId !== undefined) {
    await browser.action.setBadgeBackgroundColor({ color: "#2f7d32", tabId });
    await browser.action.setBadgeText({ text: "✓", tabId });
    setTimeout(() => browser.action.setBadgeText({ text: "", tabId }), 1500);
  }
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const fromPage = tab ? await readSelection(tab.id, info.frameId) : "";
  await saveSnippet({
    text: fromPage || info.selectionText,
    url: info.pageUrl || tab?.url,
    title: tab?.title,
    tabId: tab?.id,
  });
});

browser.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "save-selection") return;
  if (!tab) [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await saveSnippet({
    text: await readSelection(tab.id),
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
  });
});
