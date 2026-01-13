import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const handler = createMiddleware(routing);

export const proxy = handler;

export default handler;

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
