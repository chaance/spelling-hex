export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

// https://github.com/adobe/react-spectrum/blob/27e4e682528fc182fd0b45d5033a87844d255888/packages/%40react-aria/focus/src/focusSafely.ts#L20

let currentModality: Modality = null!;
let supportsPreventScrollCached: boolean = null!;

// We store a global list of elements that are currently transitioning, mapped
// to a set of CSS properties that are transitioning for that element. This is
// necessary rather than a simple count of transitions because of browser bugs,
// e.g. Chrome sometimes fires both transitionend and transitioncancel rather
// than one or the other. So we need to track what's actually transitioning so
// that we can ignore these duplicate events.
let transitionsByElement = new Map<EventTarget, Set<string>>();

// A list of callbacks to call once there are no transitioning elements.
let transitionCallbacks = new Set<() => void>();

export function focusSafely(element: HTMLElement) {
  // If the user is interacting with a virtual cursor, e.g. screen reader, then
  // wait until after any animated transitions that are currently occurring on
  // the page before shifting focus. This avoids issues with VoiceOver on iOS
  // causing the page to scroll when moving focus if the element is
  // transitioning from off the screen.
  if (getInteractionModality() === "virtual") {
    let lastFocusedElement = document.activeElement;
    runAfterTransition(() => {
      // If focus did not move and the element is still in the document, focus it.
      if (
        document.activeElement === lastFocusedElement &&
        document.contains(element)
      ) {
        focusWithoutScrolling(element);
      }
    });
  } else {
    focusWithoutScrolling(element);
  }
}

export function getInteractionModality(): Modality {
  return currentModality;
}

type Modality = "keyboard" | "pointer" | "virtual";

export function runAfterTransition(fn: () => void) {
  // Wait one frame to see if an animation starts, e.g. a transition on mount.
  requestAnimationFrame(() => {
    // If no transitions are running, call the function immediately.
    // Otherwise, add it to a list of callbacks to run at the end of the animation.
    if (transitionsByElement.size === 0) {
      fn();
    } else {
      transitionCallbacks.add(fn);
    }
  });
}

export function focusWithoutScrolling(element: HTMLElement | SVGElement) {
  if (supportsPreventScroll()) {
    element.focus({ preventScroll: true });
  } else {
    let scrollableElements = getScrollableElements(element);
    element.focus();
    restoreScrollPosition(scrollableElements);
  }
}

function supportsPreventScroll() {
  if (supportsPreventScrollCached == null) {
    supportsPreventScrollCached = false;
    try {
      let focusElem = document.createElement("div");
      focusElem.focus({
        get preventScroll() {
          supportsPreventScrollCached = true;
          return true;
        },
      });
    } catch (e) {}
  }
  return supportsPreventScrollCached;
}

function getScrollableElements(
  element: HTMLElement | SVGElement
): ScrollableElement[] {
  let parent = element.parentNode;
  let scrollableElements: ScrollableElement[] = [];
  let rootScrollingElement =
    document.scrollingElement || document.documentElement;

  while (parent instanceof HTMLElement && parent !== rootScrollingElement) {
    if (
      parent.offsetHeight < parent.scrollHeight ||
      parent.offsetWidth < parent.scrollWidth
    ) {
      scrollableElements.push({
        element: parent,
        scrollTop: parent.scrollTop,
        scrollLeft: parent.scrollLeft,
      });
    }
    parent = parent.parentNode;
  }

  if (rootScrollingElement instanceof HTMLElement) {
    scrollableElements.push({
      element: rootScrollingElement,
      scrollTop: rootScrollingElement.scrollTop,
      scrollLeft: rootScrollingElement.scrollLeft,
    });
  }

  return scrollableElements;
}

function restoreScrollPosition(scrollableElements: ScrollableElement[]) {
  for (let { element, scrollTop, scrollLeft } of scrollableElements) {
    element.scrollTop = scrollTop;
    element.scrollLeft = scrollLeft;
  }
}

interface ScrollableElement {
  element: HTMLElement | SVGElement;
  scrollTop: number;
  scrollLeft: number;
}

////////////////////////////////////////////////////////////////////////////////

export function composeEventHandlers<
  EventType extends { defaultPrevented: boolean }
>(
  ...handlers: Array<((event: EventType) => any) | undefined>
): (event: EventType) => any {
  return (event) => {
    for (let handler of handlers) {
      handler?.(event);
      if (event.defaultPrevented) {
        break;
      }
    }
  };
}

/**
 * Get an element's owner document. Useful when components are used in iframes
 * or other environments like dev tools.
 *
 * @param element
 */
export function getOwnerDocument<T extends Element>(
  element: T | null | undefined
): Document {
  if (!canUseDOM) {
    throw new Error(
      "You can only access `document` or `window` in a browser environment"
    );
  }
  return element ? element.ownerDocument : document;
}

export function getOwnerWindow<T extends Element>(
  element: T | null | undefined
): Window & typeof globalThis {
  return getOwnerDocument(element).defaultView || window;
}

export function getComputedStyles(
  element: Element,
  pseudoElt?: string | null | undefined
): CSSStyleDeclaration | null {
  return getOwnerWindow(element).getComputedStyle(element, pseudoElt || null);
}

/**
 * Get the size of the working document minus the scrollbar offset.
 *
 * @param element
 */
export function getDocumentDimensions(
  element?: HTMLElement | null | undefined
) {
  let ownerDocument = getOwnerDocument(element)!;
  let ownerWindow = ownerDocument.defaultView || window;
  if (!ownerDocument) {
    return {
      width: 0,
      height: 0,
    };
  }

  return {
    width: ownerDocument.documentElement.clientWidth ?? ownerWindow.innerWidth,
    height:
      ownerDocument.documentElement.clientHeight ?? ownerWindow.innerHeight,
  };
}

/**
 * Get the scoll position of the global window object relative to a given node.
 *
 * @param element
 */
export function getScrollPosition(element?: HTMLElement | null | undefined) {
  let ownerWindow = getOwnerWindow(element);
  if (!ownerWindow) {
    return {
      scrollX: 0,
      scrollY: 0,
    };
  }

  return {
    scrollX: ownerWindow.scrollX,
    scrollY: ownerWindow.scrollY,
  };
}

export function isRightClick(
  nativeEvent: MouseEvent | PointerEvent | TouchEvent
) {
  return "which" in nativeEvent
    ? nativeEvent.which === 3
    : "button" in nativeEvent
    ? (nativeEvent as any).button === 2
    : false;
}

export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
  // JAWS/NVDA with Firefox.
  if ((event as any).mozInputSource === 0 && event.isTrusted) {
    return true;
  }
  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

export function getFocusableElements(parent: Element) {
  let focusableElementsMaybe = parent.querySelectorAll<HTMLElement>(
    [
      "a[href]",
      "area[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "button:not([disabled])",
      "iframe",
      "object",
      "embed",
      '[tabindex]:not([tabindex="-1"])',
      "[contenteditable]",
      "audio[controls]",
      "video[controls]",
      "summary",
    ].join(",")
  );
  return Array.from(focusableElementsMaybe).filter(
    (el) => el.tabIndex !== -1 && !el.hidden
  );
}
