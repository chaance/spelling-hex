/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// Portions of the code in this file are based on code from react.
// Original licensing for the following can be found in the
// NOTICE file in the root directory of this source tree.
// See https://github.com/facebook/react/tree/cc7c1aece46a6b69b41958d731e0fd27c94bfc6c/packages/react-interactions

import { isIOS } from "~/lib/platform";
import {
  runAfterTransition,
  focusWithoutScrolling,
  isVirtualClick,
} from "~/lib/dom";
import { useGlobalListeners } from "~/lib/use-global-listeners";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLayoutEffect } from "./use-layout-effect";
import cx from "clsx";

// Safari on iOS starts selecting text on long press. The only way to avoid this, it seems,
// is to add user-select: none to the entire page. Adding it to the pressable element prevents
// that element from being selected, but nearby elements may still receive selection. We add
// user-select: none on touch start, and remove it again on touch end to prevent this.
// This must be implemented using global state to avoid race conditions between multiple elements.

// There are three possible states due to the delay before removing user-select: none after
// pointer up. The 'default' state always transitions to the 'disabled' state, which transitions
// to 'restoring'. The 'restoring' state can either transition back to 'disabled' or 'default'.

// For non-iOS devices, we apply user-select: none to the pressed element instead to avoid possible
// performance issues that arise from applying and removing user-select: none to the entire page
// (see https://github.com/adobe/react-spectrum/issues/1609).
type State = "default" | "disabled" | "restoring";

// Note that state only matters here for iOS. Non-iOS gets user-select: none applied to the target element
// rather than at the document level so we just need to apply/remove user-select: none for each pressed element individually
let state: State = "default";
let savedUserSelect = "";
let modifiedElementMap = new WeakMap<HTMLElement | SVGElement, string>();

export function disableTextSelection(target?: HTMLElement | SVGElement) {
  if (isIOS()) {
    if (state === "default") {
      savedUserSelect = document.documentElement.style.webkitUserSelect;
      document.documentElement.style.webkitUserSelect = "none";
    }

    state = "disabled";
  } else if (target) {
    // If not iOS, store the target's original user-select and change to user-select: none
    // Ignore state since it doesn't apply for non iOS
    modifiedElementMap.set(target, target.style.userSelect);
    target.style.userSelect = "none";
  }
}

export function restoreTextSelection(target?: HTMLElement | SVGElement | null) {
  if (isIOS()) {
    // If the state is already default, there's nothing to do.
    // If it is restoring, then there's no need to queue a second restore.
    if (state !== "disabled") {
      return;
    }

    state = "restoring";

    // There appears to be a delay on iOS where selection still might occur
    // after pointer up, so wait a bit before removing user-select.
    setTimeout(() => {
      // Wait for any CSS transitions to complete so we don't recompute style
      // for the whole page in the middle of the animation and cause jank.
      runAfterTransition(() => {
        // Avoid race conditions
        if (state === "restoring") {
          if (document.documentElement.style.webkitUserSelect === "none") {
            document.documentElement.style.webkitUserSelect =
              savedUserSelect || "";
          }

          savedUserSelect = "";
          state = "default";
        }
      });
    }, 300);
  } else {
    // If not iOS, restore the target's original user-select if any
    // Ignore state since it doesn't apply for non iOS
    if (target && modifiedElementMap.has(target)) {
      let targetOldUserSelect = modifiedElementMap.get(target);
      if (targetOldUserSelect && target.style.userSelect === "none") {
        target.style.userSelect = targetOldUserSelect;
      }
      if (target.getAttribute("style") === "") {
        target.removeAttribute("style");
      }
      modifiedElementMap.delete(target);
    }
  }
}

export interface PressProps extends PressEvents {
  /** Whether the target is in a controlled press state (e.g. an overlay it triggers is open). */
  isPressed?: boolean;
  /** Whether the press events should be disabled. */
  isDisabled?: boolean;
  /** Whether the target should not receive focus on press. */
  preventFocusOnPress?: boolean;
  /**
   * Whether press events should be canceled when the pointer leaves the target while pressed.
   * By default, this is `false`, which means if the pointer returns back over the target while
   * still pressed, onPressStart will be fired again. If set to `true`, the press is canceled
   * when the pointer leaves the target and onPressStart will not be fired if the pointer returns.
   */
  shouldCancelOnPointerExit?: boolean;
  /** Whether text selection should be enabled on the pressable element. */
  allowTextSelectionOnPress?: boolean;
}

export interface PressHookProps extends PressProps {
  /** A ref to the target element. */
  ref?: React.RefObject<HTMLElement | SVGElement>;
}

export interface PressState {
  isPressed: boolean;
  ignoreEmulatedMouseEvents: boolean;
  ignoreClickAfterPress: boolean;
  didFirePressStart: boolean;
  activePointerId: any;
  target: HTMLElement | SVGElement | null;
  isOverTarget: boolean;
  pointerType: PointerType | null;
  userSelect?: string;
}

interface EventBase {
  currentTarget: EventTarget | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export interface PressResult {
  /** Whether the target is currently pressed. */
  isPressed: boolean;
  /** Props to spread on the target element. */
  pressProps: React.HTMLAttributes<HTMLElement | SVGElement>;
}

/**
 * Handles press interactions across mouse, touch, keyboard, and screen readers.
 * It normalizes behavior across browsers and platforms, and handles many nuances
 * of dealing with pointer and keyboard events.
 */
export function usePress(props: PressHookProps): PressResult {
  let {
    onPress,
    onPressChange,
    onPressStart,
    onPressEnd,
    onPressUp,
    isDisabled,
    isPressed: isPressedProp,
    preventFocusOnPress,
    shouldCancelOnPointerExit,
    allowTextSelectionOnPress,
    ref: _,
    ...domProps
  } = props;

  let refProps: PressHookProps = {
    onPress,
    onPressChange,
    onPressStart,
    onPressEnd,
    onPressUp,
    isDisabled,
    shouldCancelOnPointerExit,
  };
  let propsRef = useRef<PressHookProps>(refProps);
  useLayoutEffect(() => {
    propsRef.current = refProps;
  });

  let [isPressed, setPressed] = useState(false);
  let ref = useRef<PressState>({
    isPressed: false,
    ignoreEmulatedMouseEvents: false,
    ignoreClickAfterPress: false,
    didFirePressStart: false,
    activePointerId: null,
    target: null,
    isOverTarget: false,
    pointerType: null,
  });

  let { addGlobalListener, removeAllGlobalListeners } = useGlobalListeners();

  let pressProps = useMemo(() => {
    let state = ref.current;
    let triggerPressStart = (
      originalEvent: EventBase,
      pointerType: PointerType | null
    ) => {
      let { onPressStart, onPressChange, isDisabled } = propsRef.current;
      if (isDisabled || state.didFirePressStart) {
        return;
      }

      if (onPressStart) {
        onPressStart({
          type: "pressstart",
          pointerType,
          target: originalEvent.currentTarget as HTMLElement,
          shiftKey: originalEvent.shiftKey,
          metaKey: originalEvent.metaKey,
          ctrlKey: originalEvent.ctrlKey,
          altKey: originalEvent.altKey,
        });
      }

      if (onPressChange) {
        onPressChange(true);
      }

      state.didFirePressStart = true;
      setPressed(true);
    };

    let triggerPressEnd = (
      originalEvent: EventBase,
      pointerType: PointerType | null,
      wasPressed = true
    ) => {
      let { onPressEnd, onPressChange, onPress, isDisabled } = propsRef.current;
      if (!state.didFirePressStart) {
        return;
      }

      state.ignoreClickAfterPress = true;
      state.didFirePressStart = false;

      if (onPressEnd) {
        onPressEnd({
          type: "pressend",
          pointerType,
          target: originalEvent.currentTarget as HTMLElement,
          shiftKey: originalEvent.shiftKey,
          metaKey: originalEvent.metaKey,
          ctrlKey: originalEvent.ctrlKey,
          altKey: originalEvent.altKey,
        });
      }

      if (onPressChange) {
        onPressChange(false);
      }

      setPressed(false);

      if (onPress && wasPressed && !isDisabled) {
        onPress({
          type: "press",
          pointerType,
          target: originalEvent.currentTarget as HTMLElement,
          shiftKey: originalEvent.shiftKey,
          metaKey: originalEvent.metaKey,
          ctrlKey: originalEvent.ctrlKey,
          altKey: originalEvent.altKey,
        });
      }
    };

    let triggerPressUp = (
      originalEvent: EventBase,
      pointerType: PointerType | null
    ) => {
      let { onPressUp, isDisabled } = propsRef.current;
      if (isDisabled) {
        return;
      }

      if (onPressUp) {
        onPressUp({
          type: "pressup",
          pointerType,
          target: originalEvent.currentTarget as HTMLElement,
          shiftKey: originalEvent.shiftKey,
          metaKey: originalEvent.metaKey,
          ctrlKey: originalEvent.ctrlKey,
          altKey: originalEvent.altKey,
        });
      }
    };

    let cancel = (e: EventBase) => {
      if (state.isPressed) {
        if (state.isOverTarget) {
          triggerPressEnd(
            createEvent(state.target, e),
            state.pointerType,
            false
          );
        }
        state.isPressed = false;
        state.isOverTarget = false;
        state.activePointerId = null;
        state.pointerType = null;
        removeAllGlobalListeners();
        if (!allowTextSelectionOnPress) {
          restoreTextSelection(state.target);
        }
      }
    };

    let pressProps: React.HTMLAttributes<HTMLElement | SVGElement> = {
      onKeyDown(e) {
        if (
          isValidKeyboardEvent(e.nativeEvent) &&
          e.currentTarget.contains(e.target as HTMLElement)
        ) {
          if (shouldPreventDefaultKeyboard(e.target as Element)) {
            e.preventDefault();
          }
          e.stopPropagation();

          // If the event is repeating, it may have started on a different element
          // after which focus moved to the current element. Ignore these events and
          // only handle the first key down event.
          if (!state.isPressed && !e.repeat) {
            state.target = e.currentTarget as HTMLElement;
            state.isPressed = true;
            triggerPressStart(e, "keyboard");

            // Focus may move before the key up event, so register the event on the document
            // instead of the same element where the key down event occurred.
            addGlobalListener(document, "keyup", onKeyUp, false);
          }
        }
      },
      onKeyUp(e) {
        if (
          isValidKeyboardEvent(e.nativeEvent) &&
          !e.repeat &&
          e.currentTarget.contains(e.target as HTMLElement)
        ) {
          triggerPressUp(createEvent(state.target, e), "keyboard");
        }
      },
      onClick(e) {
        if (e && !e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        if (e && e.button === 0) {
          e.stopPropagation();
          if (isDisabled) {
            e.preventDefault();
          }

          // If triggered from a screen reader or by using element.click(),
          // trigger as if it were a keyboard click.
          if (
            !state.ignoreClickAfterPress &&
            !state.ignoreEmulatedMouseEvents &&
            (state.pointerType === "virtual" || isVirtualClick(e.nativeEvent))
          ) {
            // Ensure the element receives focus (VoiceOver on iOS does not do this)
            if (!isDisabled && !preventFocusOnPress) {
              focusWithoutScrolling(e.currentTarget);
            }

            triggerPressStart(e, "virtual");
            triggerPressUp(e, "virtual");
            triggerPressEnd(e, "virtual");
          }

          state.ignoreEmulatedMouseEvents = false;
          state.ignoreClickAfterPress = false;
        }
      },
    };

    let onKeyUp = (e: KeyboardEvent) => {
      if (state.isPressed && isValidKeyboardEvent(e)) {
        if (shouldPreventDefaultKeyboard(e.target as Element)) {
          e.preventDefault();
        }
        e.stopPropagation();

        state.isPressed = false;
        let target = e.target as HTMLElement;
        triggerPressEnd(
          createEvent(state.target, e),
          "keyboard",
          state.target?.contains(target)
        );
        removeAllGlobalListeners();

        // If the target is a link, trigger the click method to open the URL,
        // but defer triggering pressEnd until onClick event handler.
        if (
          (state.target?.contains(target) && isHTMLAnchorLink(state.target)) ||
          state.target?.getAttribute("role") === "link"
        ) {
          if ("click" in state.target) {
            state.target.click();
          } else if ("dispatchEvent" in state.target) {
            let event = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            state.target.dispatchEvent(event);
          }
        }
      }
    };

    if (typeof PointerEvent !== "undefined") {
      pressProps.onPointerDown = (e) => {
        // Only handle left clicks, and ignore events that bubbled through portals.
        if (
          e.button !== 0 ||
          !e.currentTarget.contains(e.target as HTMLElement)
        ) {
          return;
        }

        // iOS safari fires pointer events from VoiceOver with incorrect coordinates/target.
        // Ignore and let the onClick handler take care of it instead.
        // https://bugs.webkit.org/show_bug.cgi?id=222627
        // https://bugs.webkit.org/show_bug.cgi?id=223202
        if (isVirtualPointerEvent(e.nativeEvent)) {
          state.pointerType = "virtual";
          return;
        }

        // Due to browser inconsistencies, especially on mobile browsers, we prevent
        // default on pointer down and handle focusing the pressable element ourselves.
        if (shouldPreventDefault(e.currentTarget as HTMLElement)) {
          e.preventDefault();
        }

        state.pointerType = e.pointerType;

        e.stopPropagation();
        if (!state.isPressed) {
          state.isPressed = true;
          state.isOverTarget = true;
          state.activePointerId = e.pointerId;
          state.target = e.currentTarget;

          if (!isDisabled && !preventFocusOnPress) {
            focusWithoutScrolling(e.currentTarget);
          }

          if (!allowTextSelectionOnPress) {
            disableTextSelection(state.target);
          }

          triggerPressStart(e, state.pointerType);

          addGlobalListener(document, "pointermove", onPointerMove, false);
          addGlobalListener(document, "pointerup", onPointerUp, false);
          addGlobalListener(document, "pointercancel", onPointerCancel, false);
        }
      };

      pressProps.onMouseDown = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        if (e.button === 0) {
          // Chrome and Firefox on touch Windows devices require mouse down events
          // to be canceled in addition to pointer events, or an extra asynchronous
          // focus event will be fired.
          if (shouldPreventDefault(e.currentTarget as HTMLElement)) {
            e.preventDefault();
          }

          e.stopPropagation();
        }
      };

      pressProps.onPointerUp = (e) => {
        // iOS fires pointerup with zero width and height, so check the pointerType recorded during pointerdown.
        if (
          !e.currentTarget.contains(e.target as HTMLElement) ||
          state.pointerType === "virtual"
        ) {
          return;
        }

        // Only handle left clicks
        // Safari on iOS sometimes fires pointerup events, even
        // when the touch isn't over the target, so double check.
        if (e.button === 0 && isOverTarget(e, e.currentTarget)) {
          triggerPressUp(e, state.pointerType || e.pointerType);
        }
      };

      // Safari on iOS < 13.2 does not implement pointerenter/pointerleave events correctly.
      // Use pointer move events instead to implement our own hit testing.
      // See https://bugs.webkit.org/show_bug.cgi?id=199803
      let onPointerMove = (e: PointerEvent) => {
        if (e.pointerId !== state.activePointerId) {
          return;
        }

        if (isOverTarget(e, state.target)) {
          if (!state.isOverTarget) {
            state.isOverTarget = true;
            triggerPressStart(createEvent(state.target, e), state.pointerType);
          }
        } else if (state.isOverTarget) {
          state.isOverTarget = false;
          triggerPressEnd(
            createEvent(state.target, e),
            state.pointerType,
            false
          );
          if (propsRef.current.shouldCancelOnPointerExit) {
            cancel(e);
          }
        }
      };

      let onPointerUp = (e: PointerEvent) => {
        if (
          e.pointerId === state.activePointerId &&
          state.isPressed &&
          e.button === 0
        ) {
          if (isOverTarget(e, state.target)) {
            triggerPressEnd(createEvent(state.target, e), state.pointerType);
          } else if (state.isOverTarget) {
            triggerPressEnd(
              createEvent(state.target, e),
              state.pointerType,
              false
            );
          }

          state.isPressed = false;
          state.isOverTarget = false;
          state.activePointerId = null;
          state.pointerType = null;
          removeAllGlobalListeners();
          if (!allowTextSelectionOnPress) {
            restoreTextSelection(state.target);
          }
        }
      };

      let onPointerCancel = (e: PointerEvent) => {
        cancel(e);
      };

      pressProps.onDragStart = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        // Safari does not call onPointerCancel when a drag starts, whereas Chrome and Firefox do.
        cancel(e);
      };
    } else {
      pressProps.onMouseDown = (e) => {
        // Only handle left clicks
        if (
          e.button !== 0 ||
          !e.currentTarget.contains(e.target as HTMLElement)
        ) {
          return;
        }

        // Due to browser inconsistencies, especially on mobile browsers, we prevent
        // default on mouse down and handle focusing the pressable element ourselves.
        if (shouldPreventDefault(e.currentTarget as HTMLElement)) {
          e.preventDefault();
        }

        e.stopPropagation();
        if (state.ignoreEmulatedMouseEvents) {
          return;
        }

        state.isPressed = true;
        state.isOverTarget = true;
        state.target = e.currentTarget;
        state.pointerType = isVirtualClick(e.nativeEvent) ? "virtual" : "mouse";

        if (!isDisabled && !preventFocusOnPress) {
          focusWithoutScrolling(e.currentTarget);
        }

        triggerPressStart(e, state.pointerType);

        addGlobalListener(document, "mouseup", onMouseUp, false);
      };

      pressProps.onMouseEnter = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        if (state.isPressed && !state.ignoreEmulatedMouseEvents) {
          state.isOverTarget = true;
          triggerPressStart(e, state.pointerType);
        }
      };

      pressProps.onMouseLeave = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        if (state.isPressed && !state.ignoreEmulatedMouseEvents) {
          state.isOverTarget = false;
          triggerPressEnd(e, state.pointerType, false);
          if (propsRef.current.shouldCancelOnPointerExit) {
            cancel(e);
          }
        }
      };

      pressProps.onMouseUp = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        if (!state.ignoreEmulatedMouseEvents && e.button === 0) {
          triggerPressUp(e, state.pointerType);
        }
      };

      let onMouseUp = (e: MouseEvent) => {
        // Only handle left clicks
        if (e.button !== 0) {
          return;
        }

        state.isPressed = false;
        removeAllGlobalListeners();

        if (state.ignoreEmulatedMouseEvents) {
          state.ignoreEmulatedMouseEvents = false;
          return;
        }

        if (isOverTarget(e, state.target)) {
          triggerPressEnd(createEvent(state.target, e), state.pointerType);
        } else if (state.isOverTarget) {
          triggerPressEnd(
            createEvent(state.target, e),
            state.pointerType,
            false
          );
        }

        state.isOverTarget = false;
      };

      pressProps.onTouchStart = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        let touch = getTouchFromEvent(e.nativeEvent);
        if (!touch) {
          return;
        }
        state.activePointerId = touch.identifier;
        state.ignoreEmulatedMouseEvents = true;
        state.isOverTarget = true;
        state.isPressed = true;
        state.target = e.currentTarget;
        state.pointerType = "touch";

        // Due to browser inconsistencies, especially on mobile browsers, we prevent default
        // on the emulated mouse event and handle focusing the pressable element ourselves.
        if (!isDisabled && !preventFocusOnPress) {
          focusWithoutScrolling(e.currentTarget);
        }

        if (!allowTextSelectionOnPress) {
          disableTextSelection(state.target);
        }

        triggerPressStart(e, state.pointerType);

        addGlobalListener(window, "scroll", onScroll, true);
      };

      pressProps.onTouchMove = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        if (!state.isPressed) {
          return;
        }

        let touch = getTouchById(e.nativeEvent, state.activePointerId);
        if (touch && isOverTarget(touch, e.currentTarget)) {
          if (!state.isOverTarget) {
            state.isOverTarget = true;
            triggerPressStart(e, state.pointerType);
          }
        } else if (state.isOverTarget) {
          state.isOverTarget = false;
          triggerPressEnd(e, state.pointerType, false);
          if (propsRef.current.shouldCancelOnPointerExit) {
            cancel(e);
          }
        }
      };

      pressProps.onTouchEnd = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        if (!state.isPressed) {
          return;
        }

        let touch = getTouchById(e.nativeEvent, state.activePointerId);
        if (touch && isOverTarget(touch, e.currentTarget)) {
          triggerPressUp(e, state.pointerType);
          triggerPressEnd(e, state.pointerType);
        } else if (state.isOverTarget) {
          triggerPressEnd(e, state.pointerType, false);
        }

        state.isPressed = false;
        state.activePointerId = null;
        state.isOverTarget = false;
        state.ignoreEmulatedMouseEvents = true;
        if (!allowTextSelectionOnPress) {
          restoreTextSelection(state.target);
        }
        removeAllGlobalListeners();
      };

      pressProps.onTouchCancel = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        e.stopPropagation();
        if (state.isPressed) {
          cancel(e);
        }
      };

      let onScroll = (e: Event) => {
        if (
          state.isPressed &&
          (e.target as HTMLElement).contains(state.target)
        ) {
          cancel({
            currentTarget: state.target,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
          });
        }
      };

      pressProps.onDragStart = (e) => {
        if (!e.currentTarget.contains(e.target as HTMLElement)) {
          return;
        }

        cancel(e);
      };
    }

    return pressProps;
  }, [
    addGlobalListener,
    isDisabled,
    preventFocusOnPress,
    removeAllGlobalListeners,
    allowTextSelectionOnPress,
  ]);

  // Remove user-select: none in case component unmounts immediately after pressStart
  // eslint-disable-next-line arrow-body-style
  useEffect(() => {
    return () => {
      if (!allowTextSelectionOnPress) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        restoreTextSelection(ref.current.target);
      }
    };
  }, [allowTextSelectionOnPress]);

  return {
    isPressed: isPressedProp || isPressed,
    pressProps: mergeProps(domProps, pressProps),
  };
}

function isHTMLAnchorLink(target: Element): target is HTMLAnchorElement {
  return target.tagName === "A" && target.hasAttribute("href");
}

function isValidKeyboardEvent(event: KeyboardEvent): boolean {
  const { key, code, target } = event;
  const element = target as HTMLElement;
  const { tagName, isContentEditable } = element;
  const role = element.getAttribute("role");
  // Accessibility for keyboards. Space and Enter only.
  // "Spacebar" is for IE 11
  return (
    (key === "Enter" ||
      key === " " ||
      key === "Spacebar" ||
      code === "Space") &&
    tagName !== "INPUT" &&
    tagName !== "TEXTAREA" &&
    isContentEditable !== true &&
    // A link with a valid href should be handled natively,
    // unless it also has role='button' and was triggered using Space.
    (!isHTMLAnchorLink(element) || (role === "button" && key !== "Enter")) &&
    // An element with role='link' should only trigger with Enter key
    !(role === "link" && key !== "Enter")
  );
}

function getTouchFromEvent(event: TouchEvent): Touch | null {
  let { targetTouches } = event;
  if (targetTouches.length > 0) {
    return targetTouches[0];
  }
  return null;
}

function getTouchById(
  event: TouchEvent,
  pointerId: null | number
): null | Touch {
  const changedTouches = event.changedTouches;
  for (let i = 0; i < changedTouches.length; i++) {
    const touch = changedTouches[i];
    if (touch.identifier === pointerId) {
      return touch;
    }
  }
  return null;
}

function createEvent(
  target: HTMLElement | SVGElement | null,
  e: EventBase
): EventBase {
  return {
    currentTarget: target,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
  };
}

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface EventPoint {
  clientX: number;
  clientY: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
}

function getPointClientRect(point: EventPoint): Rect {
  let offsetX = (point.width ?? 0) / 2 || point.radiusX || 0;
  let offsetY = (point.height ?? 0) / 2 || point.radiusY || 0;

  return {
    top: point.clientY - offsetY,
    right: point.clientX + offsetX,
    bottom: point.clientY + offsetY,
    left: point.clientX - offsetX,
  };
}

function areRectanglesOverlapping(a: Rect, b: Rect) {
  // check if they cannot overlap on x axis
  if (a.left > b.right || b.left > a.right) {
    return false;
  }
  // check if they cannot overlap on y axis
  if (a.top > b.bottom || b.top > a.bottom) {
    return false;
  }
  return true;
}

function isOverTarget(
  point: EventPoint,
  target: HTMLElement | SVGElement | null
) {
  let rect = target?.getBoundingClientRect();
  let pointRect = getPointClientRect(point);
  return rect ? areRectanglesOverlapping(rect, pointRect) : false;
}

function shouldPreventDefault(target: HTMLElement | SVGElement) {
  // We cannot prevent default if the target is a draggable element.
  return "draggable" in target ? !target.draggable : true;
}

function shouldPreventDefaultKeyboard(target: Element) {
  return !(
    (target.tagName === "INPUT" || target.tagName === "BUTTON") &&
    (target as HTMLButtonElement | HTMLInputElement).type === "submit"
  );
}

function isVirtualPointerEvent(event: PointerEvent) {
  // If the pointer size is zero, then we assume it's from a screen reader.
  // Android TalkBack double tap will sometimes return a event with width and height of 1
  // and pointerType === 'mouse' so we need to check for a specific combination of event attributes.
  // Cannot use "event.pressure === 0" as the sole check due to Safari pointer events always returning pressure === 0
  // instead of .5, see https://bugs.webkit.org/show_bug.cgi?id=206216. event.pointerType === 'mouse' is to distingush
  // Talkback double tap from Windows Firefox touch screen press
  return (
    (event.width === 0 && event.height === 0) ||
    (event.width === 1 &&
      event.height === 1 &&
      event.pressure === 0 &&
      event.detail === 0 &&
      event.pointerType === "mouse")
  );
}

type PointerType = "mouse" | "pen" | "touch" | "keyboard" | "virtual";

interface PressEvents {
  /** Handler that is called when the press is released over the target. */
  onPress?: (e: PressEvent) => void;
  /** Handler that is called when a press interaction starts. */
  onPressStart?: (e: PressEvent) => void;
  /**
   * Handler that is called when a press interaction ends, either
   * over the target or when the pointer leaves the target.
   */
  onPressEnd?: (e: PressEvent) => void;
  /** Handler that is called when the press state changes. */
  onPressChange?: (isPressed: boolean) => void;
  /**
   * Handler that is called when a press is released over the target, regardless of
   * whether it started on the target or not.
   */
  onPressUp?: (e: PressEvent) => void;
}

export interface PressEvent {
  /** The type of press event being fired. */
  type: "pressstart" | "pressend" | "pressup" | "press";
  /** The pointer type that triggered the press event. */
  pointerType: PointerType | null;
  /** The target element of the press event. */
  target: HTMLElement | SVGElement;
  /** Whether the shift keyboard modifier was held during the press event. */
  shiftKey: boolean;
  /** Whether the ctrl keyboard modifier was held during the press event. */
  ctrlKey: boolean;
  /** Whether the meta keyboard modifier was held during the press event. */
  metaKey: boolean;
  /** Whether the alt keyboard modifier was held during the press event. */
  altKey: boolean;
}

interface Props {
  [key: string]: any;
}

export function mergeProps<T extends Props[]>(
  ...args: T
): UnionToIntersection<TupleTypes<T>> {
  // Start with a base clone of the first argument. This is a lot faster than starting
  // with an empty object and adding properties as we go.
  let result: Props = { ...args[0] };
  for (let i = 1; i < args.length; i++) {
    let props = args[i];
    for (let key in props) {
      let a = result[key];
      let b = props[key];

      // Chain events
      if (
        typeof a === "function" &&
        typeof b === "function" &&
        // This is a lot faster than a regex.
        key[0] === "o" &&
        key[1] === "n" &&
        key.charCodeAt(2) >= /* 'A' */ 65 &&
        key.charCodeAt(2) <= /* 'Z' */ 90
      ) {
        result[key] = chain(a, b);

        // Merge classnames, sometimes classNames are empty string which eval to
        // false, so we just need to do a type check
      } else if (
        (key === "className" || key === "UNSAFE_className") &&
        typeof a === "string" &&
        typeof b === "string"
      ) {
        result[key] = cx(a, b);
      } else {
        result[key] = b !== undefined ? b : a;
      }
    }
  }

  return result as UnionToIntersection<TupleTypes<T>>;
}

// taken from: https://stackoverflow.com/questions/51603250/typescript-3-parameter-list-intersection-type/51604379#51604379
type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V }
  ? V
  : never;
// eslint-disable-next-line no-undef, @typescript-eslint/no-unused-vars
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

function chain(...callbacks: any[]): (...args: any[]) => void {
  return (...args: any[]) => {
    for (let callback of callbacks) {
      if (typeof callback === "function") {
        callback(...args);
      }
    }
  };
}
