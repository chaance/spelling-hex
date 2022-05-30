import type * as React from "react";

type StateValue =
  | "INIT"
  | "VALID"
  | "INVALID"
  | "COMPLETE"
  | "CREATING_NEW_GAME";

interface StateContext {
  input: string;
  warning: null | string;
  foundWords: string[];
  touched: boolean;
  refs: React.MutableRefObject<{
    optionalLetters: string[];
    solutions: string[];
    minWordLength: number;
    requiredLetter: string;
  }>;
}

export interface PuzzleState {
  context: StateContext;
  value: StateValue;
}
