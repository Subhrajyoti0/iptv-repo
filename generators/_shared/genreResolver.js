import { GENRES } from "./genres.js";

export function resolveGenres(list = []) {
  const t = list.join(" ").toLowerCase();
  const found = [];

  for (const [g, keys] of Object.entries(GENRES)) {
    if (keys.some(k => t.includes(k))) found.push(g);
  }

  return found.length ? found : ["Entertainment"];
}
``
