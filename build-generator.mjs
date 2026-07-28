/*
  Injects verticalAccordion.css into config-generator.html so the config
  preview always renders with the exact stylesheet that ships.

  Run after any change to verticalAccordion.css:
      node build-generator.mjs
*/
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, "verticalAccordion.css");
const htmlPath = join(here, "config-generator.html");

const css = await readFile(cssPath, "utf8");
const html = await readFile(htmlPath, "utf8");

const OPEN = '<style id="sdl-plugin-css">';
const CLOSE = "</style>";
const start = html.indexOf(OPEN);
if (start === -1) throw new Error('Could not find <style id="sdl-plugin-css"> in config-generator.html');
const end = html.indexOf(CLOSE, start);
if (end === -1) throw new Error("Unterminated <style id=\"sdl-plugin-css\"> block");

const next =
  html.slice(0, start + OPEN.length) + "\n" + css.trim() + "\n" + html.slice(end);

await writeFile(htmlPath, next, "utf8");
console.log(`Injected ${css.length} bytes of CSS into config-generator.html`);
