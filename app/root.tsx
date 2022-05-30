import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "@remix-run/react";
import {
  LayoutStandard,
  LayoutStandardBody,
  LayoutStandardFooter,
  LayoutStandardHeader,
} from "~/ui/layout-standard";
import { HeaderStandard } from "~/ui/header-standard";
import { FooterStandard } from "~/ui/footer-standard";

import globalStyles from "~/styles/global.css";

export const meta: MetaFunction = () => {
  return {
    viewport: "width=device-width,initial-scale=1",
    title: "Spelling Hex",
  };
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: globalStyles }];
};

export default function App() {
  let location = useLocation();
  let routeClassRoot = "route--";
  switch (true) {
    case location.pathname === "/":
      routeClassRoot += "home";
      break;
    case location.pathname === "/solve":
      routeClassRoot += "solve";
      break;
    case location.pathname === "/puzzle":
    case /^\/puzzle\/\d{4}\/\d{2}\/\d{2}$/.test(location.pathname):
      routeClassRoot += "puzzle";
      break;
    default:
      routeClassRoot += location.pathname.split("/")[0].toLowerCase();
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        <LayoutStandard className={routeClassRoot}>
          <LayoutStandardHeader className={`${routeClassRoot}__header`}>
            <HeaderStandard />
          </LayoutStandardHeader>
          <LayoutStandardBody className={`${routeClassRoot}__body`}>
            <Outlet />
          </LayoutStandardBody>
          <LayoutStandardFooter className={`${routeClassRoot}__footer`}>
            <FooterStandard />
          </LayoutStandardFooter>
        </LayoutStandard>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
