import * as React from "react";
import { MINIMUM_WORD_LENGTH, MAXIMUM_WORD_LENGTH } from "~/constants";
import type { PuzzleData } from "~/types";
import { useLayoutEffect } from "~/lib/use-layout-effect";
import type { PuzzleState as PuzzleStateInternal } from "./puzzle-game-types";

export function usePuzzleState({
  optionalLetters,
  requiredLetter,
  solutions,
}: PuzzleData): [PuzzleStateExternal, PuzzleStateActions] {
  let refs: PuzzleStateContextInternal["refs"] = React.useRef({
    minWordLength: MINIMUM_WORD_LENGTH,
    optionalLetters,
    requiredLetter,
    solutions,
  });
  useLayoutEffect(() => {
    refs.current.minWordLength = MINIMUM_WORD_LENGTH;
    refs.current.optionalLetters = optionalLetters;
    refs.current.requiredLetter = requiredLetter;
    refs.current.solutions = solutions;
  });

  let [[state, effects], send] = React.useReducer(
    reducer,
    { refs },
    getInitialState
  );

  React.useEffect(() => {
    let cleanup: any[] = [];
    for (let effect of effects) {
      cleanup.push(effect());
    }
    return () => {
      cleanup.forEach((c) => c?.());
    };
  }, [effects]);

  let actions: PuzzleStateActions = React.useMemo(
    () => ({
      input(input: string, flash: Executor) {
        send({ type: "INPUT", input, flash });
      },
      submit(flash: Executor) {
        send({ type: "SUBMIT", flash });
      },
      reset() {
        send({ type: "RESET" });
      },
      backspace() {
        send({ type: "BACKSPACE" });
      },
      requestNewPuzzle() {
        send({ type: "REQUEST_NEW_PUZZLE" });
      },
      revealSolutions() {
        send({ type: "REVEAL_SOLUTIONS" });
      },
    }),
    []
  );

  return [state, actions];
}

function getInitialState({
  refs,
}: {
  refs: PuzzleStateContextInternal["refs"];
}): [PuzzleStateInternal, Effects] {
  return [
    {
      value: "INIT",
      context: {
        touched: false,
        input: "",
        foundWords: [],
        warning: "",
        refs,
      },
    },
    [],
  ];
}

function getResetState({
  refs,
  foundWords,
}: {
  refs: PuzzleStateContextInternal["refs"];
  foundWords?: string[];
}): PuzzleStateInternal {
  return {
    value: "INIT",
    context: {
      touched: true,
      input: "",
      foundWords: foundWords && foundWords.length === 0 ? foundWords : [],
      warning: "",
      refs,
    },
  };
}

function reducer(
  curr: [PuzzleStateInternal, Effects],
  event: StateEvent
): [PuzzleStateInternal, Effects] {
  let effects: Effects = [];
  let [state] = curr;
  let ctx = state.context;
  let refs = ctx.refs.current;

  function exec(effect: Effects[number]) {
    effects.push(effect);
  }

  switch (state.value) {
    case "INIT": {
      switch (event.type) {
        case "INPUT": {
          let nextValue = state.context.input + event.input;
          return [getStateOnInput(nextValue, { exec, event, state }), effects];
        }
        case "SUBMIT": {
          return [
            getWarningState("Please enter a word!", { exec, event, state }),
            effects,
          ];
        }
        case "RESET": {
          return [
            getResetState({ refs: ctx.refs, foundWords: ctx.foundWords }),
            effects,
          ];
        }
        case "REQUEST_NEW_PUZZLE": {
          return [getCreatingState({ state }), effects];
        }
        case "REVEAL_SOLUTIONS": {
          return [getCompletedState({ state }), effects];
        }
        default:
          return curr;
      }
    }
    case "VALID": {
      switch (event.type) {
        case "INPUT": {
          let nextValue = state.context.input + event.input;
          return [getStateOnInput(nextValue, { exec, event, state }), effects];
        }
        case "SUBMIT": {
          let { input } = ctx;
          let { minWordLength, solutions } = refs;
          if (input.length < minWordLength) {
            return [
              getWarningState("Word is too short!", { exec, event, state }),
              effects,
            ];
          }
          if (!solutions.includes(input)) {
            return [
              getWarningState("Not in word list!", { exec, event, state }),
              effects,
            ];
          }
          if (ctx.foundWords.includes(input)) {
            return [
              getWarningState("Already found!", { exec, event, state }),
              effects,
            ];
          }
          let foundWords = [...state.context.foundWords, input];
          return [
            foundWords.length === refs.solutions.length
              ? getCompletedState({ state })
              : {
                  value: "INIT",
                  context: {
                    ...state.context,
                    input: "",
                    foundWords,
                  },
                },
            effects,
          ];
        }
        case "RESET": {
          return [
            getResetState({ refs: ctx.refs, foundWords: ctx.foundWords }),
            effects,
          ];
        }
        case "REQUEST_NEW_PUZZLE": {
          return [getCreatingState({ state }), effects];
        }
        case "BACKSPACE": {
          let { input } = ctx;
          let nextValue = input && input.slice(0, -1);
          return [getStateOnInput(nextValue, { exec, event, state }), effects];
        }
        case "REVEAL_SOLUTIONS": {
          return [getCompletedState({ state }), effects];
        }
        default:
          return curr;
      }
    }
    case "INVALID": {
      switch (event.type) {
        case "INPUT": {
          let nextValue = ctx.input + event.input;
          return [getStateOnInput(nextValue, { exec, event, state }), effects];
        }
        case "SUBMIT": {
          let { input } = ctx;
          let { minWordLength, requiredLetter } = refs;
          if (input.length < minWordLength) {
            return [
              getWarningState("Word is too short!", { exec, event, state }),
              effects,
            ];
          }
          if (!input.includes(requiredLetter)) {
            return [
              getWarningState("Missing center letter!", { exec, event, state }),
              effects,
            ];
          }
          return [
            getWarningState("Contains invalid letters!", {
              exec,
              event,
              state,
            }),
            effects,
          ];
        }
        case "RESET": {
          return [
            getResetState({ refs: ctx.refs, foundWords: ctx.foundWords }),
            effects,
          ];
        }
        case "REQUEST_NEW_PUZZLE": {
          return [getCreatingState({ state }), effects];
        }
        case "BACKSPACE": {
          let { input } = ctx;
          let nextValue = input && input.slice(0, -1);
          return [getStateOnInput(nextValue, { exec, event, state }), effects];
        }
        case "REVEAL_SOLUTIONS": {
          return [getCompletedState({ state }), effects];
        }
        default:
          return curr;
      }
    }
    case "CREATING_NEW_GAME": {
      switch (event.type) {
        case "RESET": {
          return [
            getResetState({ refs: ctx.refs, foundWords: ctx.foundWords }),
            effects,
          ];
        }
        default:
          return curr;
      }
    }
    case "COMPLETE": {
      switch (event.type) {
        case "RESET": {
          return [
            getResetState({ refs: ctx.refs, foundWords: ctx.foundWords }),
            effects,
          ];
        }
        case "REQUEST_NEW_PUZZLE": {
          return [getCreatingState({ state }), effects];
        }
        default:
          return curr;
      }
    }
    default:
      return curr;
  }
}

function isValidInput(input: string, ctx: PuzzleStateContextInternal) {
  let { minWordLength, optionalLetters, requiredLetter } = ctx.refs.current;
  if (input.length < minWordLength) {
    return false;
  }
  let validLetterRegexp = new RegExp(
    `^[${optionalLetters.join("") + requiredLetter}]*$`,
    "i"
  );
  return validLetterRegexp.test(input);
}

function getCompletedState({
  state,
}: {
  state: PuzzleStateInternal;
}): PuzzleStateInternal {
  return {
    value: "COMPLETE",
    context: {
      ...state.context,
      input: "",
      foundWords: state.context.refs.current.solutions,
    },
  };
}

function getCreatingState({
  state,
}: {
  state: PuzzleStateInternal;
}): PuzzleStateInternal {
  return {
    value: "CREATING_NEW_GAME",
    context: state.context,
  };
}

function getStateOnInput(
  input: string,
  {
    exec,
    event,
    state,
  }: {
    exec: (effect: Effects[number]) => void;
    event: StateEvent;
    state: PuzzleStateInternal;
  }
): PuzzleStateInternal {
  if (!input) {
    return {
      value: "INIT",
      context: { ...state.context, input: "" },
    };
  }
  if (input.length > MAXIMUM_WORD_LENGTH) {
    return getWarningState("Word is too long!", { exec, event, state });
  }
  return {
    value: isValidInput(input, state.context) ? "VALID" : "INVALID",
    context: { ...state.context, input },
  };
}

function getWarningState(
  warning: string,
  {
    exec,
    event,
    state,
  }: {
    exec: (effect: Effects[number]) => void;
    event: StateEvent;
    state: PuzzleStateInternal;
  }
): PuzzleStateInternal {
  if (warning && "flash" in event) {
    exec(event.flash);
  }
  return {
    value: "INIT",
    context: {
      ...state.context,
      input: "",
      warning,
    },
  };
}

type PuzzleStateContextInternal = PuzzleStateInternal["context"];
type PuzzleStateContextExternal = Readonly<
  Omit<PuzzleStateContextInternal, "refs">
>;
interface PuzzleStateExternal {
  readonly value: PuzzleStateInternal["value"];
  readonly context: PuzzleStateContextExternal;
}

type Executor = () => undefined | void | (() => void);

type StateEvent =
  | { type: "INPUT"; input: string; flash: Executor }
  | { type: "SUBMIT"; flash: Executor }
  | { type: "RESET" }
  | { type: "REQUEST_NEW_PUZZLE" }
  | { type: "BACKSPACE" }
  | { type: "REVEAL_SOLUTIONS" };

type Effects = Executor[];

export interface PuzzleStateActions {
  input(input: string, flash: Executor): void;
  submit(flash: Executor): void;
  reset(): void;
  backspace(): void;
  requestNewPuzzle(): void;
  revealSolutions(): void;
}

export type { PuzzleStateExternal as PuzzleState };
