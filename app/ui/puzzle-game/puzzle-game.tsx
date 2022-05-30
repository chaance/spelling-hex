import * as React from "react";
import { useFetcher } from "@remix-run/react";
import cx from "clsx";

import type { PuzzleData } from "~/types";
import { usePress } from "~/lib/use-press";
import { useMatchMedia } from "~/lib/use-match-media";
import type { PressEvent } from "~/lib/use-press";
import { ToastProvider, Toast } from "~/ui/toast";
import confetti from "canvas-confetti";
import type { ToastHandle } from "~/ui/toast";

import { usePuzzleState } from "./puzzle-game-state";
import type { PuzzleState, PuzzleStateActions } from "./puzzle-game-state";
import { useHydrated } from "~/lib/use-hydrated";

interface PuzzleGameContextValue {
  foundWords: string[];
  puzzleBoxRef: React.MutableRefObject<HTMLDivElement | null>;
  actions: PuzzleStateActions;
  puzzleData: PuzzleData;
  state: PuzzleState;
  toastHandleRef: React.MutableRefObject<ToastHandle>;
}

interface PuzzleGameProviderProps {
  puzzleData: PuzzleData;
}

const PuzzleGameContext = React.createContext<null | PuzzleGameContextValue>(
  null
);

function usePuzzleGameContext() {
  let ctx = React.useContext(PuzzleGameContext);
  if (!ctx) {
    throw new Error(
      "usePuzzleGameContext must be used within a PuzzleGameProvider"
    );
  }
  return ctx;
}

function PuzzleGameProvider({
  children,
  puzzleData,
}: React.PropsWithChildren<PuzzleGameProviderProps>) {
  let puzzleBoxRef = React.useRef<HTMLDivElement | null>(null);
  let [state, actions] = usePuzzleState(puzzleData);
  let toastHandleRef = React.useRef<ToastHandle>({ publish() {} });
  let canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  let confettiRef = React.useRef<ReturnType<typeof confetti.create>>();

  React.useEffect(() => {
    if (state.value === "COMPLETE") {
      let canvas = canvasRef.current;
      if (!canvas) return;
      if (!confettiRef.current) {
        confettiRef.current = confetti.create(canvas, {
          resize: true,
        });
      }
      confettiRef.current();
    }
  }, [state.value]);

  return (
    <PuzzleGameContext.Provider
      value={{
        actions,
        foundWords: state.context.foundWords,
        puzzleBoxRef,
        puzzleData,
        state,
        toastHandleRef,
      }}
    >
      {children}
      <canvas
        ref={canvasRef}
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </PuzzleGameContext.Provider>
  );
}

export function PuzzleGame(props: PuzzleData) {
  return (
    <div className="puzzle-game">
      <div className="puzzle-game__container">
        <PuzzleGameProvider puzzleData={props}>
          <ToastProvider swipeDirection="right">
            <PuzzleStatus className="puzzle-game__status" />
            <div className="puzzle-game__control-wrap">
              <PuzzleGameControls />
            </div>
            <PuzzleWarningToast />
          </ToastProvider>
        </PuzzleGameProvider>
      </div>
    </div>
  );
}

export function PuzzleWarningToast() {
  let { state } = usePuzzleGameContext();
  let { toastHandleRef } = usePuzzleGameContext();

  return (
    <Toast
      ref={toastHandleRef}
      message={state.context.warning || ""}
      title="Whoops!"
    />
  );
}

export function PuzzleGameControls() {
  let { puzzleBoxRef, actions, puzzleData, toastHandleRef, state } =
    usePuzzleGameContext();
  let { optionalLetters, requiredLetter } = puzzleData;

  function submit() {
    actions.submit(toastHandleRef.current.publish);
  }

  function input(val: string) {
    actions.input(val, toastHandleRef.current.publish);
  }

  let fetcher = useFetcher();

  let controlsAreDisabled =
    state.value === "COMPLETE" || fetcher.state !== "idle";
  // Ideally we'd keep this in the state machine but I haven't figured out a
  // good model for dealing with this across the server/client boundary
  // || state.value === "CREATING_NEW_GAME";

  React.useEffect(() => {
    if (state.value === "CREATING_NEW_GAME") {
      actions.reset();
    }
  }, [actions, state.value]);

  return (
    <fetcher.Form className="puzzle-controls" method="post">
      <div className="puzzle-controls__input">
        <PuzzleGameInput />
      </div>

      <div className="puzzle-controls__actions">
        <div className="puzzle-controls__action-row">
          <button
            className="puzzle-action puzzle-action--new-puzzle ui--button ui--button--pill"
            // onClick={actions.requestNewPuzzle}
            name="random"
            value="true"
            formAction="/puzzle/create"
          >
            New Puzzle
          </button>
        </div>
        <div className="puzzle-controls__action-row">
          <button
            type="button"
            className="puzzle-action puzzle-action--restart ui--button ui--button--pill"
            onClick={actions.reset}
          >
            Restart
          </button>
          <button
            type="button"
            className="puzzle-action puzzle-action--cheat ui--button ui--button--pill"
            onClick={actions.revealSolutions}
          >
            Cheat
          </button>
        </div>
      </div>
      <div
        tabIndex={0}
        className="puzzle-controls__hex"
        ref={puzzleBoxRef}
        onKeyDown={(e) => {
          if (e.metaKey) {
            return;
          }

          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            submit();
            return;
          }

          if (e.key === "Backspace") {
            if (!e.metaKey) {
              e.preventDefault();
              actions.backspace();
              return;
            }
          }

          if (e.key === "Delete") {
            e.preventDefault();
            actions.backspace();
            return;
          }

          if (e.key.length === 1) {
            if (!/[a-z]/i.test(e.key)) {
              return;
            }
            e.preventDefault();
            input(e.key.toLowerCase());
          }
        }}
      >
        <div className="hex-puzzle">
          <div className="hex-puzzle__wrap" data-dis={controlsAreDisabled}>
            {[requiredLetter, ...optionalLetters].map((letter, i) => {
              return (
                <LetterButton
                  disabled={controlsAreDisabled}
                  key={letter}
                  onPress={() => {
                    input(letter);
                    requestAnimationFrame(() => {
                      puzzleBoxRef.current?.focus();
                    });
                  }}
                  required={letter === requiredLetter}
                >
                  {letter}
                </LetterButton>
              );
            })}
          </div>
        </div>
      </div>
      <div className="puzzle-controls__actions">
        <div className="puzzle-controls__action-row">
          <button
            type="button"
            className="puzzle-action puzzle-action--submit ui--button ui--button--pill"
            onClick={submit}
            disabled={controlsAreDisabled}
            tabIndex={-1}
          >
            Enter
          </button>
          <button
            type="button"
            className="puzzle-action puzzle-action--delete ui--button ui--button--pill"
            onClick={actions.backspace}
            disabled={controlsAreDisabled}
            tabIndex={-1}
          >
            Delete
          </button>

          <button
            className="puzzle-action puzzle-action--shuffle ui--button ui--button--square ui--button--pill"
            disabled={controlsAreDisabled}
            formAction="/puzzle/shuffle"
          >
            <svg
              viewBox="0 0 251 251"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              aria-hidden
            >
              <path d="M34.7417 125.291H0.660034L46.1192 170.751L91.5784 125.291H57.4713C57.4713 87.6894 88.0325 57.1026 125.66 57.1026C137.14 57.1026 148.058 59.9343 157.471 65.0618L174.053 48.4802C160.099 39.6026 143.492 34.373 125.66 34.373C75.4304 34.373 34.7417 75.0618 34.7417 125.291ZM193.849 125.291C193.849 162.893 163.288 193.48 125.66 193.48C114.18 193.48 103.262 190.649 93.8488 185.521L77.2672 202.103C91.2468 210.955 107.828 216.184 125.686 216.184C175.915 216.184 216.604 175.495 216.604 125.266H250.66L205.201 79.8322L159.742 125.291H193.849Z" />
            </svg>
            <span className="sr-only">Shuffle</span>
          </button>
        </div>
      </div>
      <input
        type="hidden"
        hidden
        name="letters"
        value={optionalLetters.join("")}
        readOnly
      />
      <input
        type="hidden"
        hidden
        name="puzzle_id"
        value={puzzleData.id}
        readOnly
      />
      <input
        type="hidden"
        hidden
        name="dict_id"
        value={puzzleData.dictionaryId}
        readOnly
      />
      <input
        type="hidden"
        hidden
        name="created_on"
        value={puzzleData.createdOn}
        readOnly
      />
    </fetcher.Form>
  );
}

export function PuzzleGameInput() {
  let { state, puzzleData } = usePuzzleGameContext();
  let { requiredLetter, optionalLetters } = puzzleData;

  return (
    <div className="puzzle-input">
      {state.context.input.split("").map((letter, i) => {
        let isRequired = letter === requiredLetter;
        let isOptional = optionalLetters.includes(letter);
        let isInvalid = !isRequired && !isOptional;
        return (
          <span
            key={letter + i}
            className={cx("puzzle-input__letter", {
              "puzzle-input__letter--required": isRequired,
              "puzzle-input__letter--optional": isOptional,
              "puzzle-input__letter--invalid": isInvalid,
            })}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}

export function PuzzleSolutions({ className }: { className?: string }) {
  let { foundWords } = usePuzzleGameContext();
  let isHydrated = useHydrated();
  let isMediumScreen = useMatchMedia("screen and (min-width: 768px)", false);
  let OuterComp: "div" | "details" =
    isHydrated && isMediumScreen ? "div" : "details";
  let HeaderComp: "h3" | "summary" =
    isHydrated && isMediumScreen ? "h3" : "summary";
  return (
    <OuterComp className={cx(className, "puzzle-solutions")}>
      <HeaderComp className="puzzle-solutions__heading">
        You have found {foundWords.length} solutions
      </HeaderComp>
      <div className="puzzle-solutions__list-box">
        {foundWords.length > 0 ? (
          <ul className="puzzle-solutions__list word-list">
            {foundWords.map((word, i) => {
              return (
                <li className="word-list__item" key={i}>
                  {word}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </OuterComp>
  );
}

export function PuzzleStatus({ className }: { className?: string }) {
  return (
    <div className={cx(className, "puzzle-status")}>
      <div className="puzzle-status__progress"></div>
      <PuzzleSolutions className="puzzle-status__solutions" />
    </div>
  );
}

function LetterButton({
  children,
  required,
  onPress,
  disabled,
}: {
  children: string;
  required: boolean;
  onPress: ((e: PressEvent) => void) | undefined;
  disabled: boolean;
}) {
  let buttonRef = React.useRef<SVGPolygonElement | null>(null);
  let { pressProps, isPressed } = usePress({
    onPress,
    isDisabled: disabled,
    ref: buttonRef,
  });
  return (
    <div
      className={cx("hex-puzzle__hex-button", {
        "hex-puzzle__hex-button--active": isPressed,
        "hex-puzzle__hex-button--disabled": disabled,
      })}
    >
      <svg
        role="none"
        className={cx("hex-puzzle__cell", {
          "hex-puzzle__cell--required": required,
          "hex-puzzle__cell--active": isPressed,
          "hex-puzzle__cell--disabled": disabled,
        })}
        viewBox="0 0 120 103.92304845413263"
      >
        <polygon
          ref={buttonRef}
          role="button"
          tabIndex={-1}
          {...pressProps}
          aria-label={children}
          aria-disabled={disabled || undefined}
          className={cx("hex-puzzle__cell-fill", {
            "hex-puzzle__cell-fill--required": required,
            "hex-puzzle__cell-fill--active": isPressed,
            "hex-puzzle__cell-fill--disabled": disabled,
          })}
          points="0,51.96152422706631 30,0 90,0 120,51.96152422706631 90,103.92304845413263 30,103.92304845413263"
          stroke="white"
          strokeWidth="7.5"
        />
        <text className="hex-puzzle__cell-letter" x="50%" y="50%" dy="0.35em">
          {children}
        </text>
      </svg>
    </div>
  );
}
