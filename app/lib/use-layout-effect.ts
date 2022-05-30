import { useLayoutEffect } from "react";
import { canUseDOM } from "~/lib/dom";

const useIsomorphicLayoutEffect = canUseDOM ? useLayoutEffect : () => {};

export { useIsomorphicLayoutEffect as useLayoutEffect };
