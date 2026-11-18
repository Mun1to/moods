// The moods every app with the plugin can ship: 8 moods in 2 families.
// Written by `pnpm moods` from the files in ../library/. Change those, not this file.
//
// Some families bring the colors of other projects, under the license each one chose:
//   Catppuccin: https://github.com/catppuccin/palette (MIT). Copyright (c) 2021 Catppuccin
//
// MIT:
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.

/** The families: who made each one, under which license, and which moods are in it. */
export const FAMILIES = [
  {"name":"Moods","about":"The four that come with the plugin, one for each face.","source":"https://github.com/Mun1to/moods","license":"MIT","copyright":"Copyright (c) 2026 Munir Torres Athayde","moods":["calm","focus","dream","bright"]},
  {"name":"Catppuccin","about":"Soothing pastel colors: one light flavor and three dark ones.","source":"https://github.com/catppuccin/palette","license":"MIT","copyright":"Copyright (c) 2021 Catppuccin","moods":["catppuccin-latte","catppuccin-frappe","catppuccin-macchiato","catppuccin-mocha"]},
];

/** @type {import("./compile.js").ModInput[]} */
export const MOODS = [
  {"id":"calm","manifest":{"format":1,"id":"calm","name":"Calm","type":"mood","family":"Moods","request":"The Calm mood: eyes closed, soft smile.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#102126\",\"surface\":\"#17323B\",\"text\":\"#DCEFEF\",\"muted\":\"#8FB3B6\",\"accent\":\"#6FD3C5\",\"accentText\":\"#0B1F1D\",\"border\":\"#28505A\"}}"}},
  {"id":"focus","manifest":{"format":1,"id":"focus","name":"Focus","type":"mood","family":"Moods","request":"The Focus mood: eyes wide open, straight mouth.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#1B1611\",\"surface\":\"#2B2219\",\"text\":\"#F5E8D5\",\"muted\":\"#B39C84\",\"accent\":\"#F2B544\",\"accentText\":\"#1B1611\",\"border\":\"#44372A\"}}"}},
  {"id":"dream","manifest":{"format":1,"id":"dream","name":"Dream","type":"mood","family":"Moods","request":"The Dream mood: sleepy eyes, little round mouth.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"dream\",\"colors\":{\"background\":\"#161329\",\"surface\":\"#231F40\",\"text\":\"#E8E4FB\",\"muted\":\"#A39CCC\",\"accent\":\"#A99BFF\",\"accentText\":\"#161329\",\"border\":\"#3A3363\"}}"}},
  {"id":"bright","manifest":{"format":1,"id":"bright","name":"Bright","type":"mood","family":"Moods","request":"The Bright mood: eyes open, big smile.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#FFF8EF\",\"surface\":\"#FFFFFF\",\"text\":\"#2A211E\",\"muted\":\"#6B5C54\",\"accent\":\"#F0603F\",\"accentText\":\"#1E1B24\",\"border\":\"#E6D8C8\"}}"}},
  {"id":"catppuccin-latte","manifest":{"format":1,"id":"catppuccin-latte","name":"Latte","type":"mood","family":"Catppuccin","request":"The Latte mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#eff1f5\",\"surface\":\"#e6e9ef\",\"text\":\"#4c4f69\",\"muted\":\"#5c5f77\",\"accent\":\"#8839ef\",\"accentText\":\"#eff1f5\",\"border\":\"#bcc0cc\"}}"}},
  {"id":"catppuccin-frappe","manifest":{"format":1,"id":"catppuccin-frappe","name":"Frappé","type":"mood","family":"Catppuccin","request":"The Frappé mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"dream\",\"colors\":{\"background\":\"#303446\",\"surface\":\"#292c3c\",\"text\":\"#c6d0f5\",\"muted\":\"#a5adce\",\"accent\":\"#ca9ee6\",\"accentText\":\"#232634\",\"border\":\"#51576d\"}}"}},
  {"id":"catppuccin-macchiato","manifest":{"format":1,"id":"catppuccin-macchiato","name":"Macchiato","type":"mood","family":"Catppuccin","request":"The Macchiato mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#24273a\",\"surface\":\"#1e2030\",\"text\":\"#cad3f5\",\"muted\":\"#a5adcb\",\"accent\":\"#c6a0f6\",\"accentText\":\"#181926\",\"border\":\"#494d64\"}}"}},
  {"id":"catppuccin-mocha","manifest":{"format":1,"id":"catppuccin-mocha","name":"Mocha","type":"mood","family":"Catppuccin","request":"The Mocha mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#1e1e2e\",\"surface\":\"#181825\",\"text\":\"#cdd6f4\",\"muted\":\"#a6adc8\",\"accent\":\"#cba6f7\",\"accentText\":\"#11111b\",\"border\":\"#45475a\"}}"}},
];

/**
 * The moods of some families, by name: `moodsFrom("Moods", "Catppuccin")`.
 * @param {...string} families
 */
export function moodsFrom(...families) {
  const ids = new Set(FAMILIES.filter((f) => families.includes(f.name)).flatMap((f) => f.moods));
  return MOODS.filter((m) => ids.has(m.id ?? ""));
}
