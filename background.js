chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: toggleVideoZoom,
  });
});

function toggleVideoZoom() {
  const STATE_KEY = "__zoomSkoolVideoState__";
  const STYLE_ID = "__zoom-skool-video-style__";
  const OVERLAY_ID = "__zoom-skool-video-overlay__";
  const KEEP_ATTR = "data-zsv-keep";
  const TARGET_ATTR = "data-zsv-target";
  const SIDEBAR_PX = 80;

  const existing = window[STATE_KEY];
  if (existing) {
    deactivate(existing);
    return;
  }

  const iframe = findVideoIframe();
  if (!iframe) {
    console.warn("[Zoom Skool Video] No video iframe found on this page.");
    return;
  }

  activate(iframe);

  function findVideoIframe() {
    const preferred = [
      'iframe[src*="loom.com/embed"]',
      'iframe[src*="youtube.com/embed"]',
      'iframe[src*="youtube-nocookie.com/embed"]',
      'iframe[src*="player.vimeo.com"]',
      'iframe[src*="wistia.net"]',
    ];
    for (const sel of preferred) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    const all = Array.from(document.querySelectorAll("iframe"));
    if (!all.length) return null;
    return all.reduce((best, el) => {
      const a = el.getBoundingClientRect();
      const b = best ? best.getBoundingClientRect() : { width: 0, height: 0 };
      return a.width * a.height > b.width * b.height ? el : best;
    }, null);
  }

  function extractLogoUrl() {
    const candidates = [
      '[class*="GroupLogoWrapper"] img',
      '[class*="GroupLogoWrapper"]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (!el) continue;
      if (el.tagName === "IMG" && el.src) return el.src;
      const bg = window.getComputedStyle(el).backgroundImage;
      const m = bg.match(/url\((['"]?)(.*?)\1\)/);
      if (m && m[2] && m[2] !== "none") return m[2];
    }
    return null;
  }

  function getMetadata() {
    const logoUrl = extractLogoUrl();
    const programName =
      document.querySelector('[class*="GroupNameWrapper"] span')?.textContent ||
      document.querySelector('[class*="GroupNameWrapper"]')?.textContent ||
      "";
    const courseTitle =
      document.querySelector('[class*="CourseMenuTopTitleText"]')?.textContent ||
      "";
    const md = new URLSearchParams(location.search).get("md");
    let lessonTitle = "";
    if (md) {
      const node = document.querySelector(
        `[data-rbd-draggable-id="module-${md}"] [title]`
      );
      lessonTitle = node?.getAttribute("title") || node?.textContent || "";
    }
    return { logoUrl, programName, courseTitle, lessonTitle };
  }

  function buildSidebar(side, meta) {
    const aside = document.createElement("aside");
    aside.className = `zsv-side zsv-side-${side}`;

    const logo = meta.logoUrl
      ? Object.assign(document.createElement("div"), { className: "zsv-logo" })
      : null;
    if (logo) logo.style.backgroundImage = `url("${meta.logoUrl}")`;

    const stack = document.createElement("div");
    stack.className = "zsv-text-stack";
    const items = [meta.programName, meta.courseTitle, meta.lessonTitle].filter(Boolean);
    // Left side reads bottom-to-top, so the reading-order start (program name)
    // belongs at the bottom of the stack and the current lesson at the top.
    const ordered = side === "left" ? [...items].reverse() : items;
    for (const text of ordered) {
      const el = document.createElement("div");
      el.className = "zsv-text";
      el.textContent = text;
      stack.appendChild(el);
    }

    if (side === "left") {
      aside.appendChild(stack);
      if (logo) aside.appendChild(logo);
    } else {
      if (logo) aside.appendChild(logo);
      aside.appendChild(stack);
    }
    return aside;
  }

  function activate(target) {
    target.setAttribute(TARGET_ATTR, "");
    const ancestors = [];
    for (let el = target.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      el.setAttribute(KEEP_ATTR, "");
      ancestors.push(el);
    }

    const meta = getMetadata();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.appendChild(buildSidebar("left", meta));
    overlay.appendChild(buildSidebar("right", meta));
    // Append to <html> so the body-descendant hide rule does not affect it.
    document.documentElement.appendChild(overlay);

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body :not([${KEEP_ATTR}]):not([${TARGET_ATTR}]) { display: none !important; }
      html, body {
        background: #000 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      [${KEEP_ATTR}] {
        transform: none !important;
        filter: none !important;
        perspective: none !important;
        contain: none !important;
        will-change: auto !important;
        overflow: visible !important;
        max-width: none !important;
        max-height: none !important;
        clip-path: none !important;
        mask: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border: 0 !important;
      }
      [${TARGET_ATTR}] {
        position: fixed !important;
        inset: 0 !important;
        margin: auto !important;
        width: calc(100vw - ${SIDEBAR_PX * 2}px) !important;
        height: calc((100vw - ${SIDEBAR_PX * 2}px) * 9 / 16) !important;
        max-width: calc(100vw - ${SIDEBAR_PX * 2}px) !important;
        max-height: 100vh !important;
        border: 0 !important;
        z-index: 2147483647 !important;
      }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: none;
        color: #e5e7eb;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
      }
      #${OVERLAY_ID} .zsv-side {
        position: absolute;
        top: 0;
        bottom: 0;
        width: ${SIDEBAR_PX}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px 8px;
        gap: 20px;
        box-sizing: border-box;
      }
      #${OVERLAY_ID} .zsv-side-left { left: 0; }
      #${OVERLAY_ID} .zsv-side-right { right: 0; }
      #${OVERLAY_ID} .zsv-logo {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        background-color: transparent;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        border-radius: 8px;
        /* The Skool group image often has a baked-in light background. Invert
           flips white -> dark; hue-rotate restores the icon's original hue. */
        filter: invert(1) hue-rotate(180deg);
      }
      #${OVERLAY_ID} .zsv-side-left .zsv-logo { transform: rotate(-90deg) !important; }
      #${OVERLAY_ID} .zsv-side-right .zsv-logo { transform: rotate(90deg) !important; }
      #${OVERLAY_ID} .zsv-text-stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
      }
      #${OVERLAY_ID} .zsv-text {
        writing-mode: vertical-rl;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.02em;
        line-height: 1;
        color: #e5e7eb;
      }
      /* Left column reads bottom-to-top */
      #${OVERLAY_ID} .zsv-side-left .zsv-text { transform: rotate(180deg); }
      /* Right column keeps default vertical-rl: reads top-to-bottom */
    `;
    document.head.appendChild(style);

    const escHandler = (e) => {
      if (e.key === "Escape") {
        const s = window[STATE_KEY];
        if (s) deactivate(s);
      }
    };
    document.addEventListener("keydown", escHandler, true);

    window[STATE_KEY] = { target, ancestors, escHandler, overlay };
  }

  function deactivate(state) {
    document.getElementById(STYLE_ID)?.remove();
    state.overlay?.remove();
    if (state.target?.isConnected) state.target.removeAttribute(TARGET_ATTR);
    for (const el of state.ancestors) {
      if (el?.isConnected) el.removeAttribute(KEEP_ATTR);
    }
    document.removeEventListener("keydown", state.escHandler, true);
    delete window[STATE_KEY];
  }
}
