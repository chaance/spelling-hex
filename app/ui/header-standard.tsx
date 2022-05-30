import * as React from "react";
import cx from "clsx";
import { Container } from "~/ui/container";
import { NavLink } from "@remix-run/react";
import { useMatchMedia } from "~/lib/use-match-media";

const ID_BASIS = "header-standard";
const NAV_BUTTON_ID = `${ID_BASIS}-nav-button`;
const NAV_MENU_ID = `${ID_BASIS}-nav-menu`;
const ROOT_CLASS = `ui--${ID_BASIS}`;

const HeaderContext = React.createContext({
  shouldUseMenuRole: false,
  navIsOpen: false,
  setNavIsOpen: (() => {
    console.error("Not implemented");
  }) as React.Dispatch<React.SetStateAction<boolean>>,
});

export function HeaderStandard({ className }: { className?: string }) {
  let [navIsOpen, setNavIsOpen] = React.useState(false);
  let [animateReady, setAnimateReady] = React.useState(false);

  let isMediumScreen = useMatchMedia("screen and (min-width: 768px)");
  let shouldUseMenuRole = !isMediumScreen;
  React.useEffect(() => {
    setNavIsOpen(false);
  }, [isMediumScreen]);

  React.useEffect(() => {
    setAnimateReady(false);
    let tid = window.setTimeout(() => {
      setAnimateReady(true);
    }, 100);
    return () => {
      window.clearTimeout(tid);
    };
  }, [isMediumScreen]);

  return (
    <header className={cx(className, ROOT_CLASS)}>
      <div className={`${ROOT_CLASS}__inner`}>
        <Container className={`${ROOT_CLASS}__container`} screen="xs">
          <HeaderContext.Provider
            value={{ shouldUseMenuRole, navIsOpen, setNavIsOpen }}
          >
            <MenuButton />
            <div className={`${ROOT_CLASS}__title`}>
              <NavLink to="/">Spelling Hex</NavLink>
            </div>
            <nav
              className={cx(`${ROOT_CLASS}__nav`, {
                [`${ROOT_CLASS}__nav--expanded`]: navIsOpen,
                [`${ROOT_CLASS}__nav--animate-ready`]: animateReady,
              })}
              aria-label="Main"
            >
              <MenuList>
                <MenuItem to="/puzzle">Play</MenuItem>
                <MenuItem to="/solve">Solve</MenuItem>
              </MenuList>
            </nav>
          </HeaderContext.Provider>
        </Container>
      </div>
    </header>
  );
}

function MenuList({ children }: React.PropsWithChildren<{}>) {
  let className = `${ROOT_CLASS}__nav-list`;
  let [lockFocus, setLockFocus] = React.useState(false);
  let { shouldUseMenuRole, navIsOpen } = React.useContext(HeaderContext);
  let menuRef = React.useRef<HTMLUListElement | null>(null);

  React.useEffect(() => {
    setLockFocus(shouldUseMenuRole && navIsOpen);
  }, [shouldUseMenuRole, navIsOpen]);

  if (shouldUseMenuRole) {
    return (
      <ul
        role="menu"
        aria-labelledby={NAV_BUTTON_ID}
        aria-label="Navigation menu"
        aria-hidden={!navIsOpen || undefined}
        className={cx(className, {
          [`${className}--expanded`]: navIsOpen,
        })}
        ref={menuRef}
        onKeyDown={() => {}}
        tabIndex={-1}
        onBlur={(event) => {
          let currentTarget = event.currentTarget as HTMLUListElement;
          let relatedTarget = event.relatedTarget as HTMLElement;
          if (lockFocus && !currentTarget.contains(relatedTarget)) {
            let focusableElementsMaybe =
              currentTarget.querySelectorAll<HTMLElement>(
                [
                  "a[href]",
                  "area[href]",
                  'input:not([disabled]):not([type="hidden"])',
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
            let focusableElements = Array.from(focusableElementsMaybe).filter(
              (el) => el.tabIndex !== -1
            );
            window.queueMicrotask(() => {
              if (focusableElements[0]) {
                focusableElements[0].focus();
              } else {
                menuRef.current?.focus();
              }
            });
          }
        }}
      >
        {children}
      </ul>
    );
  }
  return <ul className={className}>{children}</ul>;
}

function MenuItem({
  children,
  to,
  tabIndex,
}: React.PropsWithChildren<{
  to?: React.ComponentProps<typeof NavLink>["to"];
  tabIndex?: number;
}>) {
  let { shouldUseMenuRole } = React.useContext(HeaderContext);
  let className = `${ROOT_CLASS}__nav-item`;
  let linkClassName = `${ROOT_CLASS}__nav-link`;
  if (shouldUseMenuRole) {
    if (to) {
      return (
        <li className={className} role="none">
          <NavLink
            className={linkClassName}
            to={to}
            role="menuitem"
            tabIndex={tabIndex}
          >
            {children}
          </NavLink>
        </li>
      );
    }
    return (
      <li className={className} role="menuitem" tabIndex={tabIndex}>
        {children}
      </li>
    );
  }

  if (to) {
    return (
      <li className={className}>
        <NavLink className={linkClassName} to={to}>
          {children}
        </NavLink>
      </li>
    );
  }
  return <li className={className}>{children}</li>;
}

function MenuButton() {
  let { navIsOpen, setNavIsOpen } = React.useContext(HeaderContext);
  return (
    <button
      type="button"
      aria-label="Navigation menu button"
      aria-controls={NAV_MENU_ID}
      aria-haspopup
      aria-expanded={navIsOpen}
      className={cx(`${ROOT_CLASS}__nav-button`, "sm:hidden", {
        [`${ROOT_CLASS}__nav-button--active`]: navIsOpen,
      })}
      id={NAV_BUTTON_ID}
      onClick={() => {
        setNavIsOpen((s) => !s);
      }}
    >
      <span className={`${ROOT_CLASS}__nav-button-outer`}>
        <span
          className={cx(`${ROOT_CLASS}__nav-button-inner`, {
            [`${ROOT_CLASS}__nav-button-inner--active`]: navIsOpen,
          })}
        ></span>
      </span>
    </button>
  );
}
