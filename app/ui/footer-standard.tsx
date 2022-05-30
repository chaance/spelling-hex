import * as React from "react";
import cx from "clsx";
import { Container } from "~/ui/container";
import { NavLink } from "@remix-run/react";

export function FooterStandard({ className }: { className?: string }) {
  return (
    <footer className={cx(className, "ui--footer-standard")}>
      <Container className="ui--footer-standard__container">
        <div>Spelling Hex</div>
        <nav className="ui--footer-standard__nav">
          <ul className="ui--footer-standard__nav-list">
            <li className="ui--footer-standard__nav-item">
              <NavLink
                className="ui--footer-standard__nav-link"
                to="/puzzle/archive"
              >
                Puzzle Archive
              </NavLink>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
