// The four moods every app with the plugin can ship: Calm, Focus, Dream and Bright.
// Written by `pnpm moods` from the folders in ../moods/. Change those, not this file.

/** @type {import("./compile.js").ModInput[]} */
export const MOODS = [
  {
    "id": "calm",
    "manifest": {
      "format": 1,
      "id": "calm",
      "name": "Calm",
      "type": "mood",
      "request": "The Calm mood: eyes closed, soft smile.",
      "contract": "^1.0"
    },
    "files": {
      "mood.json": "{\"scheme\":\"dark\",\"colors\":{\"background\":\"#102126\",\"surface\":\"#17323B\",\"text\":\"#DCEFEF\",\"muted\":\"#8FB3B6\",\"accent\":\"#6FD3C5\",\"accentText\":\"#0B1F1D\",\"border\":\"#28505A\"}}"
    }
  },
  {
    "id": "focus",
    "manifest": {
      "format": 1,
      "id": "focus",
      "name": "Focus",
      "type": "mood",
      "request": "The Focus mood: eyes wide open, straight mouth.",
      "contract": "^1.0"
    },
    "files": {
      "mood.json": "{\"scheme\":\"dark\",\"colors\":{\"background\":\"#1B1611\",\"surface\":\"#2B2219\",\"text\":\"#F5E8D5\",\"muted\":\"#B39C84\",\"accent\":\"#F2B544\",\"accentText\":\"#1B1611\",\"border\":\"#44372A\"}}"
    }
  },
  {
    "id": "dream",
    "manifest": {
      "format": 1,
      "id": "dream",
      "name": "Dream",
      "type": "mood",
      "request": "The Dream mood: sleepy eyes, little round mouth.",
      "contract": "^1.0"
    },
    "files": {
      "mood.json": "{\"scheme\":\"dark\",\"colors\":{\"background\":\"#161329\",\"surface\":\"#231F40\",\"text\":\"#E8E4FB\",\"muted\":\"#A39CCC\",\"accent\":\"#A99BFF\",\"accentText\":\"#161329\",\"border\":\"#3A3363\"}}"
    }
  },
  {
    "id": "bright",
    "manifest": {
      "format": 1,
      "id": "bright",
      "name": "Bright",
      "type": "mood",
      "request": "The Bright mood: eyes open, big smile.",
      "contract": "^1.0"
    },
    "files": {
      "mood.json": "{\"scheme\":\"light\",\"colors\":{\"background\":\"#FFF8EF\",\"surface\":\"#FFFFFF\",\"text\":\"#2A211E\",\"muted\":\"#6B5C54\",\"accent\":\"#F0603F\",\"accentText\":\"#1E1B24\",\"border\":\"#E6D8C8\"}}"
    }
  }
];
