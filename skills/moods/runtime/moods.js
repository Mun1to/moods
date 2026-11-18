// Example moods for any app with the plugin: 15 moods in 6 families. The plugin puts none of them in an app
// by itself: an app offers the ones it passes to `startMods`, changes them or brings its own.
// Written by `pnpm moods` from the files in ../library/. Change those, not this file.
//
// Some families bring the colors of other projects, under the license each one chose:
//   Catppuccin: https://github.com/catppuccin/palette (MIT). Copyright (c) 2021 Catppuccin
//   Everforest: https://github.com/sainnhe/everforest (MIT). Copyright (c) 2019 sainnhe
//   Flexoki: https://github.com/kepano/flexoki (MIT). Copyright (c) 2023 Steph Ango
//   Kanagawa: https://github.com/rebelot/kanagawa.nvim (MIT). Copyright (c) 2021 Tommaso Laurenzi
//   Rosé Pine: https://github.com/rose-pine/palette (MIT). Copyright (c) mvllow
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
  {"name":"Moods","about":"Four examples by this project, one for each face.","source":"https://github.com/Mun1to/moods","license":"MIT","copyright":"Copyright (c) 2026 Munir Torres Athayde","moods":["calm","focus","dream","bright"]},
  {"name":"Catppuccin","about":"Soothing pastel colors: one light flavor and three dark ones.","source":"https://github.com/catppuccin/palette","license":"MIT","copyright":"Copyright (c) 2021 Catppuccin","moods":["catppuccin-latte","catppuccin-frappe","catppuccin-macchiato","catppuccin-mocha"]},
  {"name":"Everforest","about":"A green forest that is warm and soft on the eyes.","source":"https://github.com/sainnhe/everforest","license":"MIT","copyright":"Copyright (c) 2019 sainnhe","moods":["everforest-dark"]},
  {"name":"Flexoki","about":"An inky palette for reading and writing, on paper or at night.","source":"https://github.com/kepano/flexoki","license":"MIT","copyright":"Copyright (c) 2023 Steph Ango","moods":["flexoki-light","flexoki-dark"]},
  {"name":"Kanagawa","about":"The colors of the famous wave: two dark moods and a light one on paper.","source":"https://github.com/rebelot/kanagawa.nvim","license":"MIT","copyright":"Copyright (c) 2021 Tommaso Laurenzi","moods":["kanagawa-wave","kanagawa-dragon","kanagawa-lotus"]},
  {"name":"Rosé Pine","about":"All natural pine, faux fur and a bit of soho vibes.","source":"https://github.com/rose-pine/palette","license":"MIT","copyright":"Copyright (c) mvllow","moods":["rose-pine-main"]},
];

/**
 * Every example mood, family by family.
 * @type {import("./compile.js").ModInput[]}
 */
export const EXAMPLES = [
  {"id":"calm","manifest":{"format":1,"id":"calm","name":"Calm","type":"mood","family":"Moods","request":"The Calm mood: eyes closed, soft smile.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#102126\",\"surface\":\"#17323B\",\"text\":\"#DCEFEF\",\"muted\":\"#8FB3B6\",\"accent\":\"#6FD3C5\",\"accentText\":\"#0B1F1D\",\"border\":\"#28505A\"}}"}},
  {"id":"focus","manifest":{"format":1,"id":"focus","name":"Focus","type":"mood","family":"Moods","request":"The Focus mood: eyes wide open, straight mouth.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#1B1611\",\"surface\":\"#2B2219\",\"text\":\"#F5E8D5\",\"muted\":\"#B39C84\",\"accent\":\"#F2B544\",\"accentText\":\"#1B1611\",\"border\":\"#44372A\"}}"}},
  {"id":"dream","manifest":{"format":1,"id":"dream","name":"Dream","type":"mood","family":"Moods","request":"The Dream mood: sleepy eyes, little round mouth.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"dream\",\"colors\":{\"background\":\"#161329\",\"surface\":\"#231F40\",\"text\":\"#E8E4FB\",\"muted\":\"#A39CCC\",\"accent\":\"#A99BFF\",\"accentText\":\"#161329\",\"border\":\"#3A3363\"}}"}},
  {"id":"bright","manifest":{"format":1,"id":"bright","name":"Bright","type":"mood","family":"Moods","request":"The Bright mood: eyes open, big smile.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#FFF8EF\",\"surface\":\"#FFFFFF\",\"text\":\"#2A211E\",\"muted\":\"#6B5C54\",\"accent\":\"#F0603F\",\"accentText\":\"#1E1B24\",\"border\":\"#E6D8C8\"}}"}},
  {"id":"catppuccin-latte","manifest":{"format":1,"id":"catppuccin-latte","name":"Latte","type":"mood","family":"Catppuccin","request":"The Latte mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#eff1f5\",\"surface\":\"#e6e9ef\",\"text\":\"#4c4f69\",\"muted\":\"#5c5f77\",\"accent\":\"#8839ef\",\"accentText\":\"#eff1f5\",\"border\":\"#bcc0cc\"}}"}},
  {"id":"catppuccin-frappe","manifest":{"format":1,"id":"catppuccin-frappe","name":"Frappé","type":"mood","family":"Catppuccin","request":"The Frappé mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"dream\",\"colors\":{\"background\":\"#303446\",\"surface\":\"#292c3c\",\"text\":\"#c6d0f5\",\"muted\":\"#a5adce\",\"accent\":\"#ca9ee6\",\"accentText\":\"#232634\",\"border\":\"#51576d\"}}"}},
  {"id":"catppuccin-macchiato","manifest":{"format":1,"id":"catppuccin-macchiato","name":"Macchiato","type":"mood","family":"Catppuccin","request":"The Macchiato mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#24273a\",\"surface\":\"#1e2030\",\"text\":\"#cad3f5\",\"muted\":\"#a5adcb\",\"accent\":\"#c6a0f6\",\"accentText\":\"#181926\",\"border\":\"#494d64\"}}"}},
  {"id":"catppuccin-mocha","manifest":{"format":1,"id":"catppuccin-mocha","name":"Mocha","type":"mood","family":"Catppuccin","request":"The Mocha mood of Catppuccin.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#1e1e2e\",\"surface\":\"#181825\",\"text\":\"#cdd6f4\",\"muted\":\"#a6adc8\",\"accent\":\"#cba6f7\",\"accentText\":\"#11111b\",\"border\":\"#45475a\"}}"}},
  {"id":"everforest-dark","manifest":{"format":1,"id":"everforest-dark","name":"Dark","type":"mood","family":"Everforest","request":"The Dark mood of Everforest.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#2D353B\",\"surface\":\"#232A2E\",\"text\":\"#D3C6AA\",\"muted\":\"#9DA9A0\",\"accent\":\"#A7C080\",\"accentText\":\"#2D353B\",\"border\":\"#475258\"}}"}},
  {"id":"flexoki-light","manifest":{"format":1,"id":"flexoki-light","name":"Light","type":"mood","family":"Flexoki","request":"The Light mood of Flexoki.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#FFFCF0\",\"surface\":\"#F2F0E5\",\"text\":\"#100F0F\",\"muted\":\"#575653\",\"accent\":\"#205EA6\",\"accentText\":\"#FFFCF0\",\"border\":\"#CECDC3\"}}"}},
  {"id":"flexoki-dark","manifest":{"format":1,"id":"flexoki-dark","name":"Dark","type":"mood","family":"Flexoki","request":"The Dark mood of Flexoki.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#100F0F\",\"surface\":\"#1C1B1A\",\"text\":\"#CECDC3\",\"muted\":\"#878580\",\"accent\":\"#4385BE\",\"accentText\":\"#100F0F\",\"border\":\"#403E3C\"}}"}},
  {"id":"kanagawa-wave","manifest":{"format":1,"id":"kanagawa-wave","name":"Wave","type":"mood","family":"Kanagawa","request":"The Wave mood of Kanagawa.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"calm\",\"colors\":{\"background\":\"#1F1F28\",\"surface\":\"#2A2A37\",\"text\":\"#DCD7BA\",\"muted\":\"#C8C093\",\"accent\":\"#7E9CD8\",\"accentText\":\"#16161D\",\"border\":\"#54546D\"}}"}},
  {"id":"kanagawa-dragon","manifest":{"format":1,"id":"kanagawa-dragon","name":"Dragon","type":"mood","family":"Kanagawa","request":"The Dragon mood of Kanagawa.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"focus\",\"colors\":{\"background\":\"#181616\",\"surface\":\"#282727\",\"text\":\"#c5c9c5\",\"muted\":\"#a6a69c\",\"accent\":\"#c4b28a\",\"accentText\":\"#0d0c0c\",\"border\":\"#625e5a\"}}"}},
  {"id":"kanagawa-lotus","manifest":{"format":1,"id":"kanagawa-lotus","name":"Lotus","type":"mood","family":"Kanagawa","request":"The Lotus mood of Kanagawa.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"light\",\"face\":\"bright\",\"colors\":{\"background\":\"#f2ecbc\",\"surface\":\"#e5ddb0\",\"text\":\"#43436c\",\"muted\":\"#545464\",\"accent\":\"#624c83\",\"accentText\":\"#f2ecbc\",\"border\":\"#8a8980\"}}"}},
  {"id":"rose-pine-main","manifest":{"format":1,"id":"rose-pine-main","name":"Main","type":"mood","family":"Rosé Pine","request":"The Main mood of Rosé Pine.","contract":"^1.0"},"files":{"mood.json":"{\"scheme\":\"dark\",\"face\":\"dream\",\"colors\":{\"background\":\"#191724\",\"surface\":\"#1f1d2e\",\"text\":\"#e0def4\",\"muted\":\"#908caa\",\"accent\":\"#ebbcba\",\"accentText\":\"#191724\",\"border\":\"#6e6a86\"}}"}},
];

/**
 * The example moods of some families, by name: `moodsFrom("Moods", "Catppuccin")`.
 * @param {...string} families
 */
export function moodsFrom(...families) {
  const ids = new Set(FAMILIES.filter((f) => families.includes(f.name)).flatMap((f) => f.moods));
  return EXAMPLES.filter((m) => ids.has(m.id ?? ""));
}
