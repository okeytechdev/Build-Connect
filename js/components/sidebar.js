import { refreshLucideIcons } from '../services/icons.service.js';

export function renderSidebar(rootElement, state, handlers, navigationItems, theme) {
  rootElement.innerHTML = `
    <div class="sidebar-panel">
      <div class="sidebar-header">
        <div class="brand" aria-label="Build.Connect">
          <div class="brand-copy">
            <strong class="brand-title">
              <span class="brand-title-accent">Build</span><span class="brand-title-dot">.</span>Connect
            </strong>
            <span class="brand-subtitle">Hub de integração</span>
          </div>
        </div>

        <button
          class="sidebar-toggle"
          type="button"
          id="sidebar-toggle"
          data-collapsed="${state.isSidebarCollapsed ? 'true' : 'false'}"
          aria-label="${state.isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}"
          title="${state.isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}"
        >
          <i data-lucide="chevron-left"></i>
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Setores">
        ${navigationItems.map((item) => renderNavigationItem(item, state)).join('')}
      </nav>

      <div class="sidebar-footer" aria-label="Ações rápidas">
        <button
          class="footer-icon-button"
          type="button"
          id="theme-switch"
          aria-label="Alternar entre modo claro e modo escuro"
          title="Alternar tema"
        >
          <span class="nav-icon" aria-hidden="true">
            <i data-lucide="${theme === 'dark' ? 'moon-star' : 'sun-medium'}"></i>
          </span>
          <span class="item-tooltip">${theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        <button
          class="footer-icon-button"
          type="button"
          id="logout-button"
          aria-label="Logout"
          title="Logout"
        >
          <span class="nav-icon" aria-hidden="true">
            <i data-lucide="log-out"></i>
          </span>
          <span class="item-tooltip">Logout</span>
        </button>
      </div>
    </div>
  `;

  refreshLucideIcons(rootElement);
  bindSidebarEvents(rootElement, handlers);
}

function renderNavigationItem(item, state) {
  const hasChildren = Boolean(item.children?.length);
  const isActive = state.activeItemId === item.id;
  const commonTooltip = `<span class="item-tooltip">${item.label}</span>`;

  if (!hasChildren) {
    return `
      <button
        class="nav-item ${isActive ? 'is-active' : ''}"
        type="button"
        data-nav-item="${item.id}"
        aria-current="${isActive ? 'page' : 'false'}"
        aria-label="${item.label}"
        title="${item.label}"
      >
        <span class="nav-icon" aria-hidden="true">
          <i data-lucide="${item.icon}"></i>
        </span>
        <span class="nav-text">
          <span class="nav-label">${item.label}</span>
        </span>
        ${commonTooltip}
      </button>
    `;
  }

  const isExpanded = state.isProductionExpanded;

  return `
    <div class="nav-group" data-expanded="${isExpanded}">
      <button
        class="nav-trigger ${isExpanded ? 'is-expanded' : ''}"
        type="button"
        data-nav-group-toggle="${item.id}"
        aria-expanded="${isExpanded}"
        aria-controls="submenu-${item.id}"
        aria-label="${item.label}"
        title="${item.label}"
      >
        <span class="nav-icon" aria-hidden="true">
          <i data-lucide="${item.icon}"></i>
        </span>
        <span class="nav-text">
          <span class="nav-label">${item.label}</span>
        </span>
        <span class="chevron-icon" aria-hidden="true">
          <i data-lucide="chevron-down"></i>
        </span>
        ${commonTooltip}
      </button>

      <div class="submenu" id="submenu-${item.id}" role="group" aria-label="Submenu ${item.label}">
        ${item.children.map((child) => renderSubmenuItem(child, state.activeItemId)).join('')}
      </div>
    </div>
  `;
}

function renderSubmenuItem(item, activeItemId) {
  const isActive = activeItemId === item.id;

  return `
    <button
      class="submenu-item ${isActive ? 'is-active' : ''}"
      type="button"
      data-nav-item="${item.id}"
      aria-current="${isActive ? 'page' : 'false'}"
      aria-label="${item.label}"
      title="${item.label}"
    >
      <span class="nav-icon" aria-hidden="true">
        <i data-lucide="${item.icon}"></i>
      </span>
      <span class="nav-text">
        <span class="submenu-label">${item.label}</span>
      </span>
      <span class="item-tooltip">${item.label}</span>
    </button>
  `;
}

function bindSidebarEvents(rootElement, handlers) {
  const toggleButton = rootElement.querySelector('#sidebar-toggle');
  const themeSwitch = rootElement.querySelector('#theme-switch');
  const logoutButton = rootElement.querySelector('#logout-button');
  const navItems = rootElement.querySelectorAll('[data-nav-item]');
  const groupToggles = rootElement.querySelectorAll('[data-nav-group-toggle]');

  toggleButton?.addEventListener('click', handlers.onSidebarToggle);
  themeSwitch?.addEventListener('click', handlers.onThemeToggle);
  logoutButton?.addEventListener('click', handlers.onLogout);

  navItems.forEach((itemButton) => {
    itemButton.addEventListener('click', () => {
      handlers.onNavigate(itemButton.dataset.navItem);
    });
  });

  groupToggles.forEach((groupButton) => {
    groupButton.addEventListener('click', () => {
      handlers.onGroupToggle(groupButton.dataset.navGroupToggle);
    });
  });
}
