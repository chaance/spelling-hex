export const ALPHABET = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;
export const ALPHABET_END_CHAR_CODE = 122; // "z".charCodeAt(0);
export const ALPHABET_START_CHAR_CODE = 97; // "a".charCodeAt(0);
export const DEFAULT_DICT_ID = "ubuntu-wamerican";
export const MINIMUM_WORD_LENGTH = 4;
export const MAXIMUM_WORD_LENGTH = 19;
export const PERFECT_PANGRAM_SCORE = 3;
export const SECONDS_PER_DAY = 24 * 60 * 60;
export const TOTAL_UNIQUE_LETTERS = 7;

export type AlphaChar = typeof ALPHABET[number];
