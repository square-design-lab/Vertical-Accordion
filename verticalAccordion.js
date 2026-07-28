(function () {
  /*
    SDL Vertical Accordion v1.0
    A horizontal-rail / vertical-title accordion for Squarespace, driven by a collection.

    - Portfolio collections render their full page sections; every other collection
      renders a card built from the item fields (title / excerpt / image / button).
    - Collapsed panels become narrow vertical rails; the open panel fills the rest.
    - Flips to a normal stacked accordion below the mobile breakpoint.
    - Self-contained: no external helper library, no class / constructor.

    Markup:
      <div data-sdl-plugin="vertical-accordions" data-source="/portfolio"></div>

    Config, lowest precedence first:
      DEFAULT_SETTINGS
      window.sdlVerticalAccordionSettings  = { ... }          // whole page
      data-config='{ ... }'                                    // per instance
      data-source / data-count / data-open                     // v0 attributes
  */

  "use strict";

  const PLUGIN_TITLE = "sdlVerticalAccordions";
  const PLUGIN_SELECTOR = '[data-sdl-plugin="vertical-accordions"]';
  const MAX_PANELS = 12;

  const DEFAULT_SETTINGS = {
    /* ---- Content ---- */
    source: undefined,
    panelLimit: 5,
    contentMode: "auto", // auto | fields | sections
    reverseOrder: false,
    titleSource: "title", // title | categories | custom
    customTitles: "",
    titleTag: "h3",
    showNumber: "none", // none | pad | plain | roman
    showNumberInRail: true,
    showTitleInPanel: true,
    showExcerpt: true,
    excerptLength: 240,
    showImage: true,
    imageFit: "cover", // cover | contain | inline
    mediaHeight: 240, // px — height of a contain / inline image
    showButton: true,
    buttonLabel: "Read more",
    buttonTarget: "_self",
    buttonStyle: "primary", // primary | secondary | link
    weglotPaths: undefined,

    /* ---- Layout ---- */
    layout: "rails", // rails | fullbleed | minimal
    heightMode: "content", // content | fixed
    fixedHeight: "620px",
    minPanelHeight: "30vh",
    maxPanelHeight: "80vh",
    railWidth: "equal", // auto | equal | <px number>
    panelGap: 0,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "currentColor",
    fullWidth: false,
    railSide: "left", // left | right — which side of its own panel the rail sits on
    verticalTextDirection: "up", // up | down
    titleAlign: "end", // start | center | end
    contentAlign: "bottom", // top | center | bottom
    contentPadding: 40,

    /* ---- Behaviour ---- */
    initialOpen: 1,
    allowAllClosed: false,
    trigger: "click", // click | hover | both
    autoplay: false,
    autoplayDelay: 5000,
    pauseOnHover: true,
    loop: true,
    transitionDuration: 500,
    easing: "ease",
    scrollToOnOpen: true,
    scrollOffset: 0,
    updateUrl: false,
    keyboardNav: true,
    respectReducedMotion: true,
    mobileBreakpoint: 767,
    mobileLayout: "stacked", // stacked | horizontal

    /* ---- Styling ---- */
    colorMode: "theme", // theme | ramp | custom
    rampFrom: "#f2f2f2",
    rampTo: "#111111",
    panelColors: [], // [{ bg, hover, text }]
    titleColor: "",
    titleFontFamily: "",
    titleSize: "",
    titleTextTransform: "",
    titleLetterSpacing: "",
    titlePadding: 16,
    numberSize: "",
    excerptSize: "",
    iconStyle: "plus", // plus | arrow | chevron | none | custom
    icon: "",
    iconPlacement: "bottom", // top | bottom
    iconShape: "bare", // bare | circle | square
    iconSize: 24,
    overlayTint: 0,

    /* ---- Squarespace integration ---- */
    reloadSiteBundle: true,
    initWebsiteComponents: true,
    duplicateRootTheme: true,
  };

  /* ------------------------------------------------------------------ *
   *  Utilities
   * ------------------------------------------------------------------ */

  function isPlainObject(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === "[object Object]"
    );
  }

  function deepMerge(target, ...sources) {
    sources.forEach((source) => {
      if (!isPlainObject(source)) return;
      Object.keys(source).forEach((key) => {
        const sourceVal = source[key];
        if (isPlainObject(sourceVal)) {
          if (!isPlainObject(target[key])) target[key] = {};
          deepMerge(target[key], sourceVal);
        } else if (sourceVal !== undefined) {
          target[key] = sourceVal;
        }
      });
    });
    return target;
  }

  // Turn a data-* string into a real JS type (bool / number / JSON).
  function parseAttr(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed !== "" && /^-?\d*\.?\d+$/.test(trimmed)) return Number(trimmed);
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  function emitEvent(name, detail, target) {
    try {
      (target || document).dispatchEvent(
        new CustomEvent(name, { detail: detail || null, bubbles: true, cancelable: true })
      );
    } catch (e) {
      /* no-op */
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html == null ? "" : html);
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  function truncate(text, max) {
    const limit = parseInt(max, 10);
    if (!limit || limit < 1 || text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "") + "…";
  }

  const ROMAN = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  function formatNumber(index, style) {
    const n = index + 1;
    if (style === "pad") return n < 10 ? "0" + n : String(n);
    if (style === "plain") return String(n);
    if (style === "roman") {
      let num = n;
      let out = "";
      ROMAN.forEach(([value, numeral]) => {
        while (num >= value) {
          out += numeral;
          num -= value;
        }
      });
      return out + ".";
    }
    return "";
  }

  function toNumber(value, fallback) {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  // Accept "20", "20px", "5vh" — bare numbers become px.
  function toLength(value, fallback) {
    if (value == null || value === "") return fallback;
    if (typeof value === "number") return value + "px";
    const str = String(value).trim();
    return /^-?\d*\.?\d+$/.test(str) ? str + "px" : str;
  }

  function hexToRgb(hex) {
    let h = String(hex || "").trim().replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return "#" + to(r) + to(g) + to(b);
  }

  function mixColors(from, to, t) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    if (!a || !b) return from;
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }

  function shade(hex, amount) {
    const c = hexToRgb(hex);
    if (!c) return hex;
    const target = amount > 0 ? 255 : 0;
    const t = Math.abs(amount);
    return rgbToHex(
      c.r + (target - c.r) * t,
      c.g + (target - c.g) * t,
      c.b + (target - c.b) * t
    );
  }

  // Relative luminance — decides whether a panel needs light or dark text.
  function isLight(hex) {
    const c = hexToRgb(hex);
    if (!c) return true;
    const chan = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b) > 0.42;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function debounce(fn, wait) {
    let timer;
    const wrapped = function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
  }

  /* ------------------------------------------------------------------ *
   *  Icons
   * ------------------------------------------------------------------ */

  const ICONS = {
    plus: '<span class="va-icon va-icon--plus"><span class="va-icon__h"></span><span class="va-icon__v"></span></span>',
    arrow:
      '<svg class="va-icon va-icon--svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.25 6.75 12 3m0 0 3.75 3.75M12 3v18"/></svg>',
    chevron:
      '<svg class="va-icon va-icon--svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>',
  };

  function iconMarkup(settings) {
    if (settings.iconStyle === "none") return "";
    if (settings.iconStyle === "custom") return settings.icon || ICONS.plus;
    return ICONS[settings.iconStyle] || ICONS.plus;
  }

  /* ------------------------------------------------------------------ *
   *  Data layer
   * ------------------------------------------------------------------ */

  const fetchCache = new Map();

  function fetchWithCache(url) {
    if (fetchCache.has(url)) return fetchCache.get(url);
    const promise = fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
        return response.json();
      })
      .catch((error) => {
        fetchCache.delete(url);
        throw error;
      });
    fetchCache.set(url, promise);
    return promise;
  }

  const pageCache = new Map();

  function fetchPageHtml(url) {
    if (pageCache.has(url)) return pageCache.get(url);
    const promise = fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
        return response.text();
      })
      .catch((error) => {
        pageCache.delete(url);
        throw error;
      });
    pageCache.set(url, promise);
    return promise;
  }

  function extractSectionsFromPageHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sections =
      doc.querySelector("#sections") ||
      doc.querySelector("article [data-page-sections]") ||
      doc.querySelector("main #sections");
    if (!sections) return "";

    // Never let fetched sections keep another page's Squarespace identity: in edit
    // mode data-page-sections makes the editor persist changes against the source
    // item instead of the page being edited.
    sections.removeAttribute("data-page-sections");
    sections.querySelectorAll("[data-page-sections]").forEach((el) => {
      el.removeAttribute("data-page-sections");
    });
    return sections.outerHTML;
  }

  async function fetchItemSections(fullUrl) {
    try {
      return extractSectionsFromPageHtml(await fetchPageHtml(fullUrl));
    } catch (error) {
      console.error(PLUGIN_TITLE + ": could not fetch item page " + fullUrl, error);
      return "";
    }
  }

  // Fetch a collection as JSON and normalise its items. Events collections keep
  // their items under `upcoming` / `past` rather than `items`.
  async function collectionData(source, settings) {
    let path = String(source || "").trim();

    if (settings.weglotPaths && typeof settings.weglotPaths === "object") {
      const lang =
        document.documentElement.getAttribute("lang") ||
        (window.Weglot && window.Weglot.getCurrentLang && window.Weglot.getCurrentLang());
      if (lang && settings.weglotPaths[lang]) path = settings.weglotPaths[lang];
    }

    if (!/^https?:\/\//.test(path) && path[0] !== "/") path = "/" + path;

    const url = new URL(path, window.location.origin);
    const params = new URLSearchParams(url.search);

    // "?featured" on the source path narrows the list to starred items.
    const featuredOnly = params.has("featured");
    if (featuredOnly) params.delete("featured");
    params.set("format", "json");
    params.set("date", String(Date.now()));
    url.search = params.toString();

    const data = await fetchWithCache(url.toString());

    let rawItems = Array.isArray(data.items) ? data.items : [];
    if (!rawItems.length && (data.upcoming || data.past)) {
      rawItems = [].concat(data.upcoming || [], data.past || []);
    }
    if (featuredOnly) rawItems = rawItems.filter((item) => item.starred === true);

    const typeName = String(
      (data.collection && (data.collection.typeName || data.collection.type)) || ""
    );
    const isPortfolio =
      /portfolio/i.test(typeName) ||
      (rawItems[0] && rawItems[0].recordTypeLabel === "portfolio-item");

    const items = rawItems.map((item) => ({
      id: item.id,
      title: item.title || "",
      body: item.body || "",
      excerpt: item.excerpt || (item.seoData && item.seoData.seoDescription) || "",
      fullUrl: item.fullUrl || "",
      categories: item.categories || [],
      tags: item.tags || [],
      image: imageUrlFor(item),
      imageAlt: (item.mediaFocalPoint && item.title) || item.title || "",
    }));

    return { items, typeName, isPortfolio, collectionTitle: (data.collection && data.collection.title) || "" };
  }

  function imageUrlFor(item) {
    if (item.assetUrl) return item.assetUrl;
    if (item.items && item.items[0] && item.items[0].assetUrl) return item.items[0].assetUrl;
    if (item.image && item.image.assetUrl) return item.image.assetUrl;
    return "";
  }

  /* ------------------------------------------------------------------ *
   *  Squarespace lifecycle — injected sections need re-initialising
   * ------------------------------------------------------------------ */

  // Clone the site's second `:root` colour-theme block onto [data-section-theme="white"]
  // so injected sections that rely on the default theme aren't left unthemed.
  let rootThemePromise = null;
  function duplicateRootCssRule() {
    if (rootThemePromise) return rootThemePromise;
    if (document.getElementById("sdl-root-theme-duplicate")) {
      rootThemePromise = Promise.resolve();
      return rootThemePromise;
    }
    rootThemePromise = fetch("/site.css", { credentials: "same-origin" })
      .then((response) => response.text())
      .then((cssText) => {
        const rules = cssText.split("}").map((rule) => rule.trim() + "}");
        const rootRules = rules.filter((rule) => rule.startsWith(":root"));
        if (rootRules.length < 2) return;
        const style = document.createElement("style");
        style.id = "sdl-root-theme-duplicate";
        style.dataset.description = "Duplicate of the :root colour theme styles";
        style.textContent = rootRules[1].replace(":root", '[data-section-theme="white"]');
        document.head.prepend(style);
      })
      .catch((error) => {
        console.warn(PLUGIN_TITLE + ": could not duplicate the :root colour theme", error);
      });
    return rootThemePromise;
  }

  // Squarespace's newer blocks (accordion, marquee, shape …) are "website components"
  // initialised by a visitor loader that only resolves modules already in its import
  // map; its API fallback returns 401 on visitor pages, so components fetched in after
  // page load silently fail. Each block carries its own script URLs in
  // data-block-scripts — register those before the visitor loader runs.
  function registerWebsiteComponentModules(scope) {
    const loader = window.websiteComponents && window.websiteComponents.loader;
    if (!loader || !loader.importMap) return;

    const canLoadModule = (moduleName) => {
      if (typeof loader.canLoadModule === "function") return loader.canLoadModule(moduleName);
      return (
        loader.importMap[moduleName] !== undefined ||
        (loader.modules && loader.modules[moduleName] !== undefined)
      );
    };

    scope
      .querySelectorAll(".sqs-block-website-component[data-definition-name][data-block-scripts]")
      .forEach((block) => {
        const definitionName = block.getAttribute("data-definition-name");
        let scriptUrls;
        try {
          scriptUrls = JSON.parse(block.getAttribute("data-block-scripts"));
        } catch (error) {
          console.warn(PLUGIN_TITLE + ": could not parse data-block-scripts", block, error);
          return;
        }
        if (!Array.isArray(scriptUrls)) return;

        scriptUrls.forEach((url) => {
          if (typeof url !== "string") return;
          const filename = url.split("/").pop();
          if (!filename || !filename.endsWith(".js")) return;
          const moduleName = filename.slice(0, -3);
          // Only this block's own modules, and never overwrite an entry the page
          // already resolves — a second copy of a visitor script throws
          // "[…] is already defined" in the loser.
          if (moduleName.startsWith(definitionName + ".") && !canLoadModule(moduleName)) {
            loader.importMap[moduleName] = url;
          }
        });
      });
  }

  async function initializeWebsiteComponents(scope) {
    const instanceLoader =
      window.websiteComponents && window.websiteComponents.visitorInstanceLoader;
    if (!instanceLoader || typeof instanceLoader.load !== "function") return;

    const blocks = Array.from(
      scope.querySelectorAll("[data-website-component-id][data-definition-name]")
    );
    const results = await Promise.allSettled(
      blocks.map((element) =>
        instanceLoader.load({
          definitionName: element.dataset.definitionName,
          id: element.dataset.websiteComponentId,
          element,
          forceRefresh: true,
        })
      )
    );
    results.forEach((result, index) => {
      if (result.status !== "rejected") return;
      console.warn(
        PLUGIN_TITLE + ': could not initialise website component "' +
          blocks[index].dataset.definitionName + '"',
        result.reason
      );
    });
  }

  function executeScripts(scope) {
    scope.querySelectorAll("script").forEach((script) => {
      if (script.type === "application/json" || script.dataset.sdlRan === "true") return;
      script.dataset.sdlRan = "true";
      if (script.src) {
        const clone = document.createElement("script");
        clone.src = script.src;
        clone.async = script.async;
        document.body.appendChild(clone);
      } else {
        try {
          new Function(script.textContent)();
        } catch (error) {
          console.error(PLUGIN_TITLE + ": error running an inline script", error);
        }
      }
    });
  }

  // Force lazy / JS-gated content visible inside injected markup.
  function revealLazyContent(scope) {
    scope.querySelectorAll("img[data-src]").forEach((img) => {
      if (window.ImageLoader && typeof window.ImageLoader.load === "function") {
        try {
          window.ImageLoader.load(img, { load: true });
          return;
        } catch (e) {
          /* fall through */
        }
      }
      if (!img.getAttribute("src")) img.setAttribute("src", img.dataset.src);
      img.style.opacity = "1";
    });

    scope
      .querySelectorAll('[class*="gallery-"][class*="-item"]:not([data-show])')
      .forEach((item) => item.setAttribute("data-show", "true"));

    scope.querySelectorAll("[data-src].section-background-image, .section-background img").forEach((img) => {
      if (img.dataset && img.dataset.src && !img.getAttribute("src")) {
        img.setAttribute("src", img.dataset.src);
      }
    });
  }

  let bundleReloaded = false;
  function reloadSiteBundle() {
    if (bundleReloaded) return;
    const existing = document.querySelector('script[src*="static1.squarespace.com/static/vta"]');
    if (!existing) return;
    bundleReloaded = true;
    const script = document.createElement("script");
    script.src = existing.src;
    script.async = true;
    existing.remove();
    document.body.appendChild(script);
  }

  async function reloadSquarespaceLifecycle(scope, settings) {
    try {
      if (settings.initWebsiteComponents) registerWebsiteComponentModules(scope);

      const Y = window.Y;
      const Squarespace = window.Squarespace;
      if (Squarespace && Y && typeof Y.one === "function") {
        const node = Y.one(scope);
        try {
          Squarespace.initializeLayoutBlocks && Squarespace.initializeLayoutBlocks(Y, node);
          Squarespace.initializeNativeVideo && Squarespace.initializeNativeVideo(Y, node);
          Squarespace.initializeCollectionPages && Squarespace.initializeCollectionPages(Y, node);
        } catch (error) {
          console.warn(PLUGIN_TITLE + ": Squarespace initialisers threw", error);
        }
      }

      // initializePageContent uses the content-preview path, which 401s for logged-out
      // visitors. Load each injected component once through the visitor loader instead;
      // overlapping initialisers attach duplicate listeners and break interactive blocks.
      if (settings.initWebsiteComponents) await initializeWebsiteComponents(scope);

      revealLazyContent(scope);
      executeScripts(scope);

      const needsBundle =
        scope.querySelector(".section-background .sqs-video-background-native") ||
        scope.querySelector(".page-section.user-items-list-section") ||
        scope.querySelector(".page-section.gallery-section") ||
        scope.querySelector(".background-fx-canvas");
      if (settings.reloadSiteBundle && needsBundle) reloadSiteBundle();

      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      console.warn(PLUGIN_TITLE + ": lifecycle refresh failed", error);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Markup
   * ------------------------------------------------------------------ */

  function titleFor(item, index, settings) {
    if (settings.titleSource === "categories") {
      const list = item.categories || [];
      if (list.length) return list.join(", ");
    }
    if (settings.titleSource === "custom") {
      const custom = String(settings.customTitles || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (custom[index]) return custom[index];
    }
    return item.title || "";
  }

  function buttonClassFor(style) {
    if (style === "link") return "va-card__link";
    const variant = style === "secondary" ? "secondary" : "primary";
    return (
      "va-card__btn sqs-block-button-element sqs-block-button-element--medium " +
      "sqs-button-element--" + variant
    );
  }

  function cardMarkup(item, index, settings) {
    const number = formatNumber(index, settings.showNumber);
    const excerptText = truncate(stripHtml(item.excerpt || item.body), settings.excerptLength);

    const media =
      settings.showImage && item.image
        ? '<div class="va-card__media" data-fit="' + escapeHtml(settings.imageFit) + '">' +
          '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.imageAlt) + '" loading="lazy">' +
          (toNumber(settings.overlayTint, 0) > 0 ? '<span class="va-card__tint"></span>' : "") +
          "</div>"
        : "";

    const parts = [];
    if (number && settings.showNumber !== "none") {
      parts.push('<span class="va-card__num">' + escapeHtml(number) + "</span>");
    }
    if (settings.showTitleInPanel) {
      const tag = escapeHtml(settings.titleTag || "h3");
      parts.push(
        "<" + tag + ' class="va-card__title">' + escapeHtml(titleFor(item, index, settings)) + "</" + tag + ">"
      );
    }
    if (settings.showExcerpt && excerptText) {
      parts.push('<p class="va-card__excerpt">' + escapeHtml(excerptText) + "</p>");
    }
    if (settings.showButton && item.fullUrl) {
      parts.push(
        '<a class="' + buttonClassFor(settings.buttonStyle) + '" href="' + escapeHtml(item.fullUrl) +
          '" target="' + escapeHtml(settings.buttonTarget) + '"' +
          (settings.buttonTarget === "_blank" ? ' rel="noopener noreferrer"' : "") +
          ">" + escapeHtml(settings.buttonLabel || "Read more") + "</a>"
      );
    }

    return (
      '<div class="va-card">' +
      media +
      '<div class="va-card__body">' + parts.join("") + "</div>" +
      "</div>"
    );
  }

  function panelMarkup(item, index, settings, mode, uid) {
    const railTitle = titleFor(item, index, settings);
    const number = formatNumber(index, settings.showNumber);
    const tag = escapeHtml(settings.titleTag || "h3");
    const icon = iconMarkup(settings);
    const panelId = uid + "-panel-" + index;
    const buttonId = uid + "-title-" + index;

    const railNumber =
      settings.showNumberInRail && number && settings.showNumber !== "none"
        ? '<span class="va-rail__num">' + escapeHtml(number) + "</span>"
        : "";

    const content =
      mode === "sections"
        ? item.body || cardMarkup(item, index, settings)
        : cardMarkup(item, index, settings);

    return (
      '<div class="accordion-panel" data-index="' + index + '">' +
      '<button type="button" class="accordion-title" id="' + buttonId + '" aria-expanded="false" aria-controls="' + panelId + '" tabindex="-1">' +
      railNumber +
      "<" + tag + ' class="text"><span class="va-rail__label">' + escapeHtml(railTitle) + "</span></" + tag + ">" +
      (icon ? '<span class="icon-wrapper">' + icon + "</span>" : "") +
      "</button>" +
      '<div class="accordion-content-wrapper" id="' + panelId + '" role="region" aria-labelledby="' + buttonId + '">' +
      '<div class="accordion-content">' + content + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ *
   *  Styling — settings become CSS custom properties
   * ------------------------------------------------------------------ */

  function applyStyleVars(root, component, settings, panelCount) {
    const set = (name, value) => {
      if (value === "" || value == null) component.style.removeProperty(name);
      else component.style.setProperty(name, value);
    };

    const duration = settings.respectReducedMotion && prefersReducedMotion()
      ? 0
      : toNumber(settings.transitionDuration, 500);

    set("--va-transition-duration", duration + "ms");
    set("--va-easing", settings.easing || "ease");
    set("--va-panel-gap", toLength(settings.panelGap, "0px"));
    set("--va-border-radius", toLength(settings.borderRadius, "0px"));
    set("--va-border-width", toLength(settings.borderWidth, "0px"));
    set("--va-border-color", settings.borderColor || "currentColor");
    set("--va-min-panel-height", toLength(settings.minPanelHeight, "30vh"));
    set("--va-max-panel-height", toLength(settings.maxPanelHeight, "80vh"));
    set("--va-fixed-height", toLength(settings.fixedHeight, "620px"));
    set("--va-content-padding", toLength(settings.contentPadding, "40px"));
    set("--va-media-height", toLength(settings.mediaHeight, "240px"));
    set("--va-accordion-title-padding", toLength(settings.titlePadding, "16px"));
    set("--va-accordion-title-color", settings.titleColor);
    set("--va-accordion-title-font-family", settings.titleFontFamily);
    set("--va-accordion-title-size", settings.titleSize);
    set("--va-accordion-title-text-transform", settings.titleTextTransform);
    set("--va-accordion-title-letter-spacing", settings.titleLetterSpacing);
    set("--va-number-size", settings.numberSize);
    set("--va-excerpt-size", settings.excerptSize);
    set("--va-icon-width", toLength(settings.iconSize, "24px"));
    set("--va-overlay-tint", String(toNumber(settings.overlayTint, 0) / 100));

    root.dataset.layout = settings.layout;
    root.dataset.railSide = settings.railSide;
    root.dataset.textDirection = settings.verticalTextDirection;
    root.dataset.titleAlign = settings.titleAlign;
    root.dataset.contentAlign = settings.contentAlign;
    root.dataset.iconPlacement = settings.iconPlacement;
    root.dataset.iconShape = settings.iconShape;
    root.dataset.heightMode = settings.heightMode;
    root.dataset.colorMode = settings.colorMode;
    root.classList.toggle("va-full-width", !!settings.fullWidth);
    root.classList.toggle("va-gapped", toNumber(settings.panelGap, 0) > 0);

    // Panel colours
    for (let i = 1; i <= MAX_PANELS; i++) {
      component.style.removeProperty("--va-panel-" + i + "-background");
      component.style.removeProperty("--va-panel-hover-" + i + "-background");
      component.style.removeProperty("--va-panel-" + i + "-color");
    }

    if (settings.colorMode === "ramp") {
      const steps = Math.max(1, panelCount - 1);
      for (let i = 0; i < panelCount; i++) {
        const bg = mixColors(settings.rampFrom, settings.rampTo, panelCount === 1 ? 0 : i / steps);
        const light = isLight(bg);
        set("--va-panel-" + (i + 1) + "-background", bg);
        set("--va-panel-hover-" + (i + 1) + "-background", shade(bg, light ? -0.08 : 0.12));
        set("--va-panel-" + (i + 1) + "-color", light ? "#111111" : "#ffffff");
      }
    } else if (settings.colorMode === "custom") {
      (settings.panelColors || []).slice(0, MAX_PANELS).forEach((entry, i) => {
        if (!entry) return;
        const bg = entry.bg || "";
        if (bg) {
          set("--va-panel-" + (i + 1) + "-background", bg);
          set("--va-panel-hover-" + (i + 1) + "-background", entry.hover || shade(bg, isLight(bg) ? -0.08 : 0.12));
          set("--va-panel-" + (i + 1) + "-color", entry.text || (isLight(bg) ? "#111111" : "#ffffff"));
        }
      });
    }
  }

  /* ------------------------------------------------------------------ *
   *  Instance
   * ------------------------------------------------------------------ */

  function createAccordion(root, settings, data) {
    const controller = new AbortController();
    const signal = controller.signal;
    const uid = root.id || "va-" + Math.random().toString(36).slice(2, 9);

    const mode =
      settings.contentMode === "auto"
        ? data.isPortfolio
          ? "sections"
          : "fields"
        : settings.contentMode;

    let items = data.items.slice();
    if (settings.reverseOrder) items.reverse();
    const limit = Math.min(MAX_PANELS, Math.max(1, toNumber(settings.panelLimit, 5)));
    items = items.slice(0, limit);

    root.innerHTML =
      '<div class="vertical-accordions" data-mode="' + mode + '">' +
      items.map((item, index) => panelMarkup(item, index, settings, mode, uid)).join("") +
      "</div>";

    const component = root.querySelector(".vertical-accordions");
    const panels = Array.from(root.querySelectorAll(".accordion-panel"));
    const titles = panels.map((panel) => panel.querySelector(".accordion-title"));
    const wrappers = panels.map((panel) => panel.querySelector(".accordion-content-wrapper"));

    applyStyleVars(root, component, settings, panels.length);

    let activeIndex = -1;
    let autoplayTimer = null;
    let hovering = false;

    /* ---- measurement ---- */

    function isMobile() {
      return (
        settings.mobileLayout === "stacked" &&
        window.innerWidth <= toNumber(settings.mobileBreakpoint, 767)
      );
    }

    function measure() {
      const mobile = isMobile();
      root.classList.toggle("va-mobile", mobile);

      if (mobile) {
        titles.forEach((title) => (title.style.width = ""));
        component.style.removeProperty("--va-active-width");
        measureMobileHeight();
        return;
      }

      // Rail widths — "equal" normalises every rail to the widest natural one,
      // which also sidesteps Firefox's vertical-writing-mode measurement bug.
      let railTotal = 0;
      const railSetting = settings.railWidth;
      if (railSetting === "auto") {
        titles.forEach((title) => (title.style.width = ""));
        titles.forEach((title) => {
          railTotal += title.getBoundingClientRect().width;
        });
      } else {
        let width;
        if (railSetting === "equal") {
          titles.forEach((title) => (title.style.width = ""));
          width = Math.ceil(
            titles.reduce((max, title) => Math.max(max, title.getBoundingClientRect().width), 0)
          );
          if (!width) width = 56;
        } else {
          width = toNumber(railSetting, 56);
        }
        titles.forEach((title) => (title.style.width = width + "px"));
        railTotal = width * titles.length;
      }

      const componentWidth = component.getBoundingClientRect().width;
      const gap = toNumber(settings.panelGap, 0);
      const gapTotal = Math.max(0, panels.length - 1) * gap;
      const activeWidth = Math.max(0, Math.floor(componentWidth - railTotal - gapTotal));
      component.style.setProperty("--va-active-width", activeWidth + "px");

      measureTallestPanel();
    }

    function contentNodeOf(panel) {
      return (
        panel.querySelector("#sections") ||
        panel.querySelector(".sqs-layout") ||
        panel.querySelector(".va-card") ||
        panel.querySelector(".accordion-content")
      );
    }

    // Content nodes stretch to fill the panel (min-height:100%), so scrollHeight
    // alone just reports the height we're trying to derive. Drop the stretch for
    // the read so we get the height the content actually wants.
    function naturalHeight(node) {
      const previous = node.style.minHeight;
      node.style.minHeight = "0";
      const height = node.scrollHeight;
      node.style.minHeight = previous;
      return height;
    }

    function measureTallestPanel() {
      if (settings.heightMode === "fixed") {
        component.style.removeProperty("--va-tallest-panel-height");
        return;
      }
      let maxHeight = 0;
      panels.forEach((panel) => {
        const node = contentNodeOf(panel);
        if (!node) return;
        maxHeight = Math.max(maxHeight, naturalHeight(node));
      });
      if (maxHeight) component.style.setProperty("--va-tallest-panel-height", maxHeight + "px");
    }

    function measureMobileHeight() {
      const panel = panels[activeIndex];
      if (!panel) return;
      const node = contentNodeOf(panel);
      if (node) component.style.setProperty("--va-active-height", naturalHeight(node) + "px");
    }

    /* ---- focus management ---- */

    const FOCUSABLE =
      '.accordion-content a, .accordion-content button, .accordion-content input, ' +
      '.accordion-content textarea, .accordion-content select, .accordion-content details, ' +
      '.accordion-content [tabindex]:not([tabindex="-1"])';

    function setFocusable(panel, enabled) {
      panel.querySelectorAll(FOCUSABLE).forEach((el) => {
        if (enabled) el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", "-1");
      });
    }

    /* ---- open / close ---- */

    function scrollIntoViewIfNeeded() {
      if (!settings.scrollToOnOpen) return;
      const rect = root.getBoundingClientRect();
      if (rect.top >= 0) return;
      window.scrollTo({
        top: rect.top + window.pageYOffset - toNumber(settings.scrollOffset, 0),
        behavior: settings.respectReducedMotion && prefersReducedMotion() ? "auto" : "smooth",
      });
    }

    function open(index, options) {
      const opts = options || {};
      if (index < 0 || index >= panels.length) return;
      if (index === activeIndex) {
        if (settings.allowAllClosed) close(opts);
        return;
      }

      activeIndex = index;
      panels.forEach((panel, i) => {
        const on = i === index;
        panel.classList.toggle("panel-active", on);
        titles[i].setAttribute("aria-expanded", on ? "true" : "false");
        titles[i].setAttribute("tabindex", on ? "0" : "-1");
        wrappers[i].setAttribute("aria-hidden", on ? "false" : "true");
        setFocusable(panel, on);
      });
      root.classList.remove("va-none-active");

      if (isMobile()) measureMobileHeight();
      if (!opts.silent) scrollIntoViewIfNeeded();
      if (settings.updateUrl && !opts.silent) writeUrl(index);

      emitEvent(PLUGIN_TITLE + ":open", { container: root, index, item: items[index] }, root);
    }

    function close(options) {
      if (!settings.allowAllClosed) return;
      const previous = activeIndex;
      activeIndex = -1;
      panels.forEach((panel, i) => {
        panel.classList.remove("panel-active");
        titles[i].setAttribute("aria-expanded", "false");
        titles[i].setAttribute("tabindex", i === previous ? "0" : "-1");
        wrappers[i].setAttribute("aria-hidden", "true");
        setFocusable(panel, false);
      });
      root.classList.add("va-none-active");
      emitEvent(PLUGIN_TITLE + ":close", { container: root, index: previous }, root);
    }

    function step(delta) {
      if (!panels.length) return;
      let next = activeIndex + delta;
      if (next >= panels.length) next = settings.loop ? 0 : panels.length - 1;
      if (next < 0) next = settings.loop ? panels.length - 1 : 0;
      open(next);
    }

    function writeUrl(index) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("va-active", String(index + 1));
        window.history.replaceState({}, "", url.toString());
      } catch (e) {
        /* no-op */
      }
    }

    /* ---- events ---- */

    panels.forEach((panel, index) => {
      const title = titles[index];

      if (settings.trigger === "click" || settings.trigger === "both") {
        panel.addEventListener(
          "click",
          (event) => {
            // Let real links and buttons inside the open panel do their job.
            if (activeIndex === index && event.target.closest("a, button:not(.accordion-title)")) return;
            open(index);
          },
          { signal }
        );
      }

      if ((settings.trigger === "hover" || settings.trigger === "both") && !isTouch()) {
        title.addEventListener("mouseenter", () => open(index), { signal });
      }

      title.addEventListener(
        "keydown",
        (event) => {
          if (!settings.keyboardNav) return;
          const mobile = isMobile();
          const nextKey = mobile ? "ArrowDown" : "ArrowRight";
          const prevKey = mobile ? "ArrowUp" : "ArrowLeft";
          let handled = true;
          if (event.key === nextKey) step(1);
          else if (event.key === prevKey) step(-1);
          else if (event.key === "Home") open(0);
          else if (event.key === "End") open(panels.length - 1);
          else if (event.key === "Enter" || event.key === " ") open(index);
          else handled = false;
          if (handled) {
            event.preventDefault();
            const focusTarget = titles[activeIndex] || titles[index];
            if (focusTarget) focusTarget.focus();
          }
        },
        { signal }
      );
    });

    root.addEventListener("mouseenter", () => (hovering = true), { signal });
    root.addEventListener("mouseleave", () => (hovering = false), { signal });

    const onResize = debounce(measure, 120);
    window.addEventListener("resize", onResize, { signal });
    window.addEventListener("orientationchange", onResize, { signal });

    let resizeObserver = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(component);
    }

    /* ---- autoplay ---- */

    function startAutoplay() {
      if (!settings.autoplay || panels.length < 2) return;
      stopAutoplay();
      autoplayTimer = window.setInterval(() => {
        if (settings.pauseOnHover && hovering) return;
        if (document.hidden) return;
        step(1);
      }, Math.max(1200, toNumber(settings.autoplayDelay, 5000)));
    }

    function stopAutoplay() {
      if (autoplayTimer) window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }

    /* ---- initial state ---- */

    function initialIndex() {
      let index = toNumber(settings.initialOpen, 1);
      try {
        const param = new URLSearchParams(window.location.search).get("va-active");
        if (param) index = toNumber(param, index);
      } catch (e) {
        /* no-op */
      }
      index = Math.round(index) - 1;
      if (index < 0) index = 0;
      if (index > panels.length - 1) index = panels.length - 1;
      return index;
    }

    measure();
    open(initialIndex(), { silent: true });

    emitEvent(PLUGIN_TITLE + ":loaded", { container: root, count: panels.length }, root);

    // Injected Squarespace sections need their blocks re-initialised, then the
    // heights re-measured once images and blocks have settled.
    const lifecycle =
      mode === "sections" ? reloadSquarespaceLifecycle(root, settings) : Promise.resolve();

    lifecycle.then(() => {
      measure();
      window.setTimeout(measure, 400);
      window.setTimeout(measure, 1200);
      startAutoplay();
    });

    root.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", onResize, { signal, once: true });
    });

    return {
      el: root,
      settings,
      items,
      open,
      close,
      next: () => step(1),
      prev: () => step(-1),
      refresh: measure,
      get activeIndex() {
        return activeIndex;
      },
      destroy() {
        stopAutoplay();
        onResize.cancel();
        if (resizeObserver) resizeObserver.disconnect();
        controller.abort();
        root.classList.remove("loaded", "va-mobile", "va-none-active");
        root.innerHTML = "";
        delete root.sdlVerticalAccordion;
      },
    };
  }

  function isTouch() {
    return window.matchMedia && window.matchMedia("(hover: none)").matches;
  }

  /* ------------------------------------------------------------------ *
   *  Instance settings
   * ------------------------------------------------------------------ */

  function readInstanceSettings(el) {
    const settings = deepMerge({}, DEFAULT_SETTINGS, window.sdlVerticalAccordionSettings || {});

    if (el.dataset.config) {
      try {
        deepMerge(settings, JSON.parse(el.dataset.config));
      } catch (error) {
        console.warn(PLUGIN_TITLE + ": could not parse data-config", el, error);
      }
    }

    // v0 attributes stay supported.
    if (el.dataset.source) settings.source = el.dataset.source;
    if (el.dataset.count) settings.panelLimit = parseAttr(el.dataset.count);
    if (el.dataset.open) settings.initialOpen = parseAttr(el.dataset.open);

    // Any other data-* that matches a known setting name.
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      if (key === "source") return;
      if (el.dataset[key] !== undefined) settings[key] = parseAttr(el.dataset[key]);
    });

    return settings;
  }

  /* ------------------------------------------------------------------ *
   *  Edit mode
   * ------------------------------------------------------------------ */

  let editObserver = null;
  function addEditModeObserver() {
    if (editObserver || !document.body) return;
    if (!document.body.classList.contains("sqs-edit-mode-active") && !window.Static?.SQUARESPACE_CONTEXT?.authenticatedAccount) {
      return;
    }
    const rebuild = debounce(() => {
      window.sdlVerticalAccordionsInit();
    }, 400);
    editObserver = new MutationObserver((mutations) => {
      const touched = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) => node.nodeType === 1 && (node.matches?.(PLUGIN_SELECTOR) || node.querySelector?.(PLUGIN_SELECTOR))
        )
      );
      if (touched) rebuild();
    });
    editObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------------ *
   *  Init
   * ------------------------------------------------------------------ */

  async function buildOne(el) {
    const settings = readInstanceSettings(el);

    if (!settings.source) {
      console.warn(PLUGIN_TITLE + ": no collection source set on", el);
      el.classList.remove("loaded");
      return;
    }

    if (settings.duplicateRootTheme) duplicateRootCssRule();

    try {
      const data = await collectionData(settings.source, settings);
      if (!data.items.length) {
        console.warn(PLUGIN_TITLE + ': no items in collection "' + settings.source + '"');
        el.classList.remove("loaded");
        return;
      }
      if (el.sdlVerticalAccordion && typeof el.sdlVerticalAccordion.destroy === "function") {
        el.sdlVerticalAccordion.destroy();
        el.classList.add("loaded");
      }
      el.sdlVerticalAccordion = createAccordion(el, settings, data);
    } catch (error) {
      console.error(PLUGIN_TITLE + ': could not build from "' + settings.source + '"', error);
      el.classList.remove("loaded");
    }
  }

  window.sdlVerticalAccordionsInit = async function () {
    const mounts = Array.from(document.querySelectorAll(PLUGIN_SELECTOR + ":not(.loaded)"));
    if (!mounts.length) return;

    await Promise.all(
      mounts.map((el) => {
        el.classList.add("loaded");
        return buildOne(el);
      })
    );

    emitEvent(PLUGIN_TITLE + ":ready", { count: mounts.length });
    addEditModeObserver();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.sdlVerticalAccordionsInit());
  } else {
    window.sdlVerticalAccordionsInit();
  }
})();
