# SDL Vertical Accordion

A horizontal-rail accordion for Squarespace, built from a collection.

Collapsed panels sit as narrow vertical rails; the open panel fills the rest of the
row. Below the mobile breakpoint it flips to a normal stacked accordion.

- **Portfolio collections** render each item's full page sections.
- **Every other collection** (blog, events, products, …) builds a card from the item
  fields — title, excerpt, image, metadata and a button. Blog, events and product
  collections default to a two-column panel: image on one side, words on the other.

The config generator asks what kind of collection you're pulling from and then only
offers the options that collection actually has — price appears for a store, an author
for a blog, and neither for a portfolio.

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
| Panel content | `showNumber` `showNumberInRail` `showTitleInPanel` `showExcerpt` `excerptLength` `textSource` `showButton` `buttonLabel` `buttonStyle` `buttonTarget` |
| Item details | `showCategories` `showTags` `showPrice` `showDate` `showAuthor` `metaStyle` `metaPosition` |
| Image | `showImage` `cardLayout` `splitSide` `splitRatio` `imageFit` `mediaHeight` `mediaRadius` `mediaBorderWidth` `mediaBorderColor` `overlayTint` `overlayText` `overlayTextColor` |
| Layout | `layout` `heightMode` `fixedHeight` `minPanelHeight` `maxPanelHeight` `railWidth` `panelGap` `borderRadius` `borderWidth` `borderColor` `contentPadding` `fullWidth` `railSide` `verticalTextDirection` `titleAlign` `contentAlign` |
| Behaviour | `initialOpen` `allowAllClosed` `trigger` `autoplay` `autoplayDelay` `pauseOnHover` `loop` `transitionDuration` `easing` `scrollToOnOpen` `scrollOffset` `updateUrl` `keyboardNav` `respectReducedMotion` `mobileBreakpoint` `mobileLayout` |
| Styling | `colorMode` `rampFrom` `rampTo` `panelColors` `titleColor` `titleFontFamily` `titleSize` `titleTextTransform` `titleLetterSpacing` `titlePadding` `numberSize` `excerptSize` `metaSize` `priceSize` `iconStyle` `icon` `iconPlacement` `iconShape` `iconSize` |
| Squarespace | `reloadSiteBundle` `initWebsiteComponents` `duplicateRootTheme` |

## Panel colours

`colorMode` decides where each panel's background comes from:

| Value | Behaviour |
| --- | --- |
| `theme` | Panels stay transparent and take the colour of the Squarespace section they sit in. The default. |
| `section` | Each panel picks up the background of the first section on that item's own page, so the accordion reads as a set of those pages. Text colour is derived to match. |
| `ramp` | Steps evenly from `rampFrom` to `rampTo` across the panels. `rampTextMode` is `auto` for a contrasting text colour at each step, or `custom` to pin one colour with `rampTextColor`. |
| `custom` | One entry of `panelColors` per panel — `{ bg, hover, text }`. `hover` and `text` are worked out from `bg` when left off. |

Panels sit flush by default with a 1px frame. Set `panelGap` above zero to break them
into separate cards; `borderRadius` and `borderWidth` then apply per panel rather than
to the block.

`borderColor: "currentColor"` means "follow the text colour". While the panels are
transparent that is the surrounding section's text colour. Once they carry their own
colours the frame follows the first panel's text colour and each divider follows its
own panel's — otherwise a page-coloured box gets drawn around coloured panels.

When the image fills the panel the words sit on top of it and cannot take their colour
from the panel background, which is hidden. `overlayText` sets that colour
(`light` / `dark` / `custom` / `auto`), and `overlayTint` darkens the photo behind it.

## Accessibility and markup

- Each rail is a real `<button>` with `aria-expanded` and `aria-controls`; each panel is
  a `role="region"` labelled by its rail, and closed panels are `aria-hidden` with their
  focusable contents taken out of the tab order.
- Arrow keys, Home and End move between panels with a roving `tabindex`.
- Cards are `<article>` elements, dates are `<time datetime>`, and metadata is a list.
- The rail is only a heading when the panel content doesn't already provide one, so no
  panel emits the same heading twice.
- Images carry alt text only when nothing else names the item, and are lazily loaded.
- `respectReducedMotion` collapses the transition when the visitor asks for less motion.

Content is fetched and rendered client-side, so treat it as an enhancement to the page
rather than its primary indexable copy.

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
