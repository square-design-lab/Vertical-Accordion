# SDL Vertical Accordion

A horizontal-rail accordion for Squarespace, built from a collection.

Collapsed panels sit as narrow vertical rails; the open panel fills the rest of the
row. Below the mobile breakpoint it flips to a normal stacked accordion.

- **Portfolio collections** render each item's full page sections.
- **Every other collection** (blog, events, products, …) builds a card from the item
  fields — title, excerpt, image and a button.

## Install

Open `config-generator.html`, set it up, and copy the two blocks it gives you.

**1 — a Code Block on the page**

```html
<div data-sdl-plugin="vertical-accordions" data-source="/portfolio"></div>
```

**2 — Settings → Advanced → Code Injection → Footer**

```html
<script>
  window.sdlVerticalAccordionSettings = { /* your settings */ };
</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/square-design-lab/Vertical-Accordion@main/verticalAccordion.css">
<script src="https://cdn.jsdelivr.net/gh/square-design-lab/Vertical-Accordion@main/verticalAccordion.js" defer></script>
```

## Options

Settings resolve lowest-precedence first:

1. plugin defaults
2. `window.sdlVerticalAccordionSettings` — the whole page
3. `data-config='{ … }'` on the mount — one instance
4. individual `data-*` attributes on the mount

`data-source`, `data-count` and `data-open` from v0 still work.

| Group | Options |
| --- | --- |
| Content | `source` `panelLimit` `contentMode` `reverseOrder` `titleSource` `customTitles` `titleTag` `weglotPaths` |
| Panel content | `showNumber` `showNumberInRail` `showTitleInPanel` `showExcerpt` `excerptLength` `showImage` `imageFit` `mediaHeight` `overlayTint` `showButton` `buttonLabel` `buttonStyle` `buttonTarget` |
| Layout | `layout` `heightMode` `fixedHeight` `minPanelHeight` `maxPanelHeight` `railWidth` `panelGap` `borderRadius` `borderWidth` `borderColor` `contentPadding` `fullWidth` `railSide` `verticalTextDirection` `titleAlign` `contentAlign` |
| Behaviour | `initialOpen` `allowAllClosed` `trigger` `autoplay` `autoplayDelay` `pauseOnHover` `loop` `transitionDuration` `easing` `scrollToOnOpen` `scrollOffset` `updateUrl` `keyboardNav` `respectReducedMotion` `mobileBreakpoint` `mobileLayout` |
| Styling | `colorMode` `rampFrom` `rampTo` `panelColors` `titleColor` `titleFontFamily` `titleSize` `titleTextTransform` `titleLetterSpacing` `titlePadding` `numberSize` `excerptSize` `iconStyle` `icon` `iconPlacement` `iconShape` `iconSize` |
| Squarespace | `reloadSiteBundle` `initWebsiteComponents` `duplicateRootTheme` |

## Notes

- Add `?featured` to the collection URL to use starred items only.
- Deep-link a panel with `?va-active=3`.
- Events: `sdlVerticalAccordions:ready` `:loaded` `:open` `:close`.
- Each mount exposes `el.sdlVerticalAccordion` — `open(i)` `next()` `prev()` `refresh()` `destroy()`.
- Maximum 12 panels.

## Development

`config-generator.html` embeds `verticalAccordion.css` verbatim so the preview can't
drift from what ships. After editing the stylesheet, re-sync it:

```bash
node build-generator.mjs
```
