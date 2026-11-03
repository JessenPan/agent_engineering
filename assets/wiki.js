// Menu choices are presentation state only; learning progress stays in content.json.
const navigationStorageKey = `leo-wiki:menus:${new URL('../', document.currentScript.src).href}`;
const navigationGroups = new Map();
const navigationOpen = new WeakMap();
let navigationChoices = {};

document.querySelectorAll('.sidebar nav details, .mobile-nav, .mobile-nav nav details').forEach(group => {
  const key = group.matches('.mobile-nav') ? 'mobile'
    : group.dataset.navCategory ? `category:${group.dataset.navCategory}`
    : group.dataset.navUnit ? `unit:${group.dataset.navUnit}`
    : `projects:${group.closest('[data-nav-category]')?.dataset.navCategory || 'root'}`;
  if (!navigationGroups.has(key)) navigationGroups.set(key, []);
  navigationGroups.get(key).push(group);
});

const syncNavigationGroup = (key, open) => {
  navigationGroups.get(key).forEach(group => {
    navigationOpen.set(group, open);
    group.open = open;
  });
};
const restoreNavigation = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(navigationStorageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) navigationChoices = saved;
  } catch {
    // Menus remain usable when browser storage is unavailable.
  }
  navigationGroups.forEach((groups, key) => {
    if (typeof navigationChoices[key] === 'boolean') syncNavigationGroup(key, navigationChoices[key]);
    else groups.forEach(group => navigationOpen.set(group, group.open));
  });
};
const rememberNavigation = (key, open) => {
  navigationChoices[key] = open;
  syncNavigationGroup(key, open);
  try {
    sessionStorage.setItem(navigationStorageKey, JSON.stringify(navigationChoices));
  } catch {
    // Native disclosure controls do not depend on saved state.
  }
};
restoreNavigation();
navigationGroups.forEach((groups, key) => groups.forEach(group => {
  group.addEventListener('toggle', () => {
    if (group.open !== navigationOpen.get(group)) rememberNavigation(key, group.open);
  });
}));
document.querySelectorAll('.sidebar nav a, .mobile-nav nav a').forEach(anchor => {
  anchor.addEventListener('click', () => {
    // Capture the selected path before navigation, even if toggle has not fired yet.
    navigationGroups.forEach((groups, key) => {
      const ancestor = groups.find(group => group.contains(anchor));
      if (!ancestor) return;
      const ownHeading = ancestor.querySelector(':scope > summary')?.contains(anchor);
      if (!ownHeading || ancestor.open !== navigationOpen.get(ancestor)) rememberNavigation(key, ancestor.open);
    });
  });
});
window.addEventListener('pageshow', restoreNavigation);

document.querySelectorAll('[data-filter-root]').forEach(root => {
  const search = root.querySelector('[data-search]');
  const select = root.querySelector('[data-select]');
  const items = [...root.querySelectorAll('[data-search-item]')];
  const count = root.querySelector('[data-result-count]');
  const empty = root.querySelector('[data-empty]');
  const filter = () => {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const item of items) {
      const text = item.dataset.searchText.toLocaleLowerCase();
      item.hidden = !terms.every(term => text.includes(term)) || (select.value !== 'all' && item.dataset.filterValue !== select.value);
      if (!item.hidden) visible += 1;
    }
    count.textContent = `${visible} / ${items.length} 条记录`;
    empty.hidden = visible !== 0;
  };
  search.addEventListener('input', filter);
  select.addEventListener('change', filter);
  filter();
});

const updateProjectNavigation = () => {
  document.querySelectorAll('[data-nav-record]').forEach(item => {
    const target = new URL(item.href);
    const active = target.pathname === location.pathname && (!target.hash || target.hash === location.hash);
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', target.hash ? 'location' : 'page');
    else item.removeAttribute('aria-current');
  });
};
window.addEventListener('hashchange', updateProjectNavigation);
updateProjectNavigation();
