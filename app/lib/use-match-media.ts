import * as React from "react";

export function useMatchMedia(query: string, defaultMatches: boolean = false) {
  let [matches, setMatches] = React.useState(defaultMatches);
  React.useEffect(() => {
    try {
      let mql = window.matchMedia(query);
      let listener = (evt: MediaQueryListEvent) => setMatches(evt.matches);
      mql.addEventListener("change", listener);
      setMatches(mql.matches);
      return () => {
        mql.removeEventListener("change", listener);
      };
    } catch (err) {
      console.error("Invalid media query. Using default.");
    }
  }, [query]);

  return matches;
}
