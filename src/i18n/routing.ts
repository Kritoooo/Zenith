import { defineRouting } from "next-intl/routing";

import { defaultLocale, locales } from "@/i18n/config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
