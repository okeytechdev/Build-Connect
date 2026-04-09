import { renderContentView } from './components/content.js';
import { renderLoginView } from './components/login.js';
import { renderSidebar } from './components/sidebar.js';
import {
  clearAuthenticatedUser,
  loginUser,
  persistAuthenticatedUser,
} from './services/auth.service.js';
import {
  NAVIGATION_ITEMS,
  findItemById,
  getInitialNavigationState,
  getNavigationItemsForAccess,
  isHomeItem,
  persistNavigationState,
  sanitizeActiveItemForNavigation,
  shouldRenderDefaultSectorCards,
  shouldStartProductionExpandedForAccess,
} from './services/navigation.service.js';
import { applyTheme, getInitialTheme, toggleTheme } from './utils/theme.js';

const authRoot = document.getElementById('auth-root');
const sidebarRoot = document.getElementById('sidebar-root');
const appShell = document.getElementById('app-shell');
const contentRoot = document.getElementById('content');

const state = {
  ...getInitialNavigationState(),
  authenticatedUser: null,
};

const loginState = {
  isLoading: false,
  errorMessage: '',
};

let currentTheme = getInitialTheme();

bootstrap();

function bootstrap() {
  clearAuthenticatedUser();
  state.authenticatedUser = null;
  resetNavigationToHome();
  applyTheme(currentTheme);
  showLoginScreen();
}

function getAccessibleNavigationItems() {
  return getNavigationItemsForAccess(state.authenticatedUser?.setor || 'all');
}

function renderApp() {
  renderSidebar(
    sidebarRoot,
    state,
    {
      onSidebarToggle: handleSidebarToggle,
      onThemeToggle: handleThemeToggle,
      onNavigate: handleNavigation,
      onGroupToggle: handleGroupToggle,
      onLogout: handleLogout,
    },
    getAccessibleNavigationItems(),
    currentTheme,
  );
}

function renderCurrentView(options = {}) {
  const navigationItems = getAccessibleNavigationItems();
  const selectedItem = findItemById(state.activeItemId, navigationItems) ?? findItemById('inicio', navigationItems);

  renderContentView(
    contentRoot,
    {
      selectedItem,
      isWelcome: isHomeItem(state.activeItemId),
      shouldRenderCards: shouldRenderDefaultSectorCards(state.activeItemId),
      authenticatedUser: state.authenticatedUser,
    },
    options,
  );
}

function renderLoginScreen() {
  renderLoginView(authRoot, loginState, {
    onSubmit: handleLoginSubmit,
  });
}

async function handleLoginSubmit(credentials) {
  loginState.errorMessage = '';
  loginState.isLoading = true;
  renderLoginScreen();

  try {
    const response = await loginUser(credentials.id, credentials.password);

    if (response.success) {
      loginState.isLoading = false;
      state.authenticatedUser = response.user;
      persistAuthenticatedUser(response.user);
      resetNavigationForAccess(response.user?.setor);
      showAuthenticatedApplication();
      return;
    }

    loginState.errorMessage = response.message;
  } catch {
    loginState.errorMessage = 'Não foi possível concluir o login.';
  }

  loginState.isLoading = false;
  renderLoginScreen();
}

function handleLogout() {
  clearAuthenticatedUser();
  state.authenticatedUser = null;
  state.activeItemId = 'inicio';
  state.isProductionExpanded = false;
  loginState.errorMessage = '';
  persistNavigationState(state);
  showLoginScreen();
}

function handleSidebarToggle() {
  state.isSidebarCollapsed = !state.isSidebarCollapsed;

  if (state.isSidebarCollapsed) {
    state.isProductionExpanded = false;
  }

  persistAndRender({ shouldRenderContent: false });
}

function handleThemeToggle() {
  currentTheme = toggleTheme();

  if (state.authenticatedUser) {
    renderApp();
    return;
  }

  renderLoginScreen();
}

function handleNavigation(itemId) {
  const previousItemId = state.activeItemId;
  state.activeItemId = itemId;

  if (itemId === 'inicio') {
    state.isProductionExpanded = false;
    persistAndRender({ shouldRenderContent: previousItemId !== itemId, animateContent: true });
    return;
  }

  const selectedItem = findItemById(itemId, getAccessibleNavigationItems());

  if (selectedItem?.parentId === 'producao') {
    state.isProductionExpanded = true;
  }

  persistAndRender({ shouldRenderContent: previousItemId !== itemId, animateContent: true });
}

function handleGroupToggle(groupId) {
  if (groupId !== 'producao') {
    return;
  }

  if (state.isSidebarCollapsed) {
    state.isSidebarCollapsed = false;
    state.isProductionExpanded = false;
    persistNavigationState(state);
    syncAppShellState();
    renderApp();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.isProductionExpanded = true;
        persistNavigationState(state);
        syncProductionAccordionDOM();
      });
    });
    return;
  }

  state.isProductionExpanded = !state.isProductionExpanded;
  persistNavigationState(state);
  syncProductionAccordionDOM();
}

function syncProductionAccordionDOM() {
  const navGroup = sidebarRoot.querySelector('.nav-group');
  const groupButton = sidebarRoot.querySelector('[data-nav-group-toggle="producao"]');
  const submenu = sidebarRoot.querySelector('#submenu-producao');

  if (!navGroup || !groupButton || !submenu) {
    renderApp();
    return;
  }

  navGroup.dataset.expanded = String(state.isProductionExpanded);
  groupButton.classList.toggle('is-expanded', state.isProductionExpanded);
  groupButton.setAttribute('aria-expanded', String(state.isProductionExpanded));
  submenu.setAttribute('aria-hidden', String(!state.isProductionExpanded));
  submenu.style.setProperty('--submenu-height', `${submenu.scrollHeight}px`);
}

function persistAndRender({ shouldRenderContent = true, animateContent = false } = {}) {
  persistNavigationState(state);
  syncAppShellState();
  renderApp();

  if (shouldRenderContent) {
    renderCurrentView({ animate: animateContent });
  }
}


function resetNavigationToHome() {
  resetNavigationForAccess('all');
}

function resetNavigationForAccess(sectorAccess) {
  const navigationItems = getNavigationItemsForAccess(sectorAccess);
  state.activeItemId = sanitizeActiveItemForNavigation('inicio', navigationItems);
  state.isProductionExpanded = shouldStartProductionExpandedForAccess(sectorAccess);
  persistNavigationState(state);
}

function syncAppShellState() {
  appShell.classList.toggle('is-sidebar-collapsed', state.isSidebarCollapsed);
}

function showAuthenticatedApplication() {
  const navigationItems = getAccessibleNavigationItems();
  state.activeItemId = sanitizeActiveItemForNavigation(state.activeItemId, navigationItems);
  document.body.classList.remove('is-auth-view');
  authRoot.hidden = true;
  appShell.hidden = false;
  syncAppShellState();
  renderApp();
  renderCurrentView({ animate: false });
}

function showLoginScreen() {
  document.body.classList.add('is-auth-view');
  appShell.hidden = true;
  authRoot.hidden = false;
  contentRoot.innerHTML = '';
  renderLoginScreen();
}
