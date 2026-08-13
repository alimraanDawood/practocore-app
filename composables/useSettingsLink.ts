// Settings has two presentations of the same sections: on desktop (lg+) each one
// is a tab panel on /main/settings (`?tab=<section>`), while the standalone
// /main/settings/<section> pages are the mobile drill-downs. Linking a desktop
// surface straight at a standalone page renders the mobile layout inside the
// desktop shell — so every link routes by viewport through here.
//
// `organisation` deliberately isn't listed: it has no tab, only a page.
export type SettingsSection =
  | 'profile'
  | 'notifications'
  | 'ai'
  | 'billing'
  | 'eccmis'
  | 'documentation'
  | 'support';

export function useSettingsLink() {
  // The same breakpoint pages/main/settings/index.vue splits its two layouts on.
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Read during render, so a link re-resolves if the viewport crosses `lg`.
  function settingsPath(section: SettingsSection): string {
    return isDesktop.value ? `/main/settings?tab=${section}` : `/main/settings/${section}`;
  }

  return { settingsPath, isDesktop };
}
