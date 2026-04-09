import { refreshLucideIcons } from '../services/icons.service.js';

export function renderLoginView(rootElement, loginState, handlers) {
  rootElement.innerHTML = `
    <section class="auth-shell" aria-labelledby="login-title">
      <div class="auth-background" aria-hidden="true">
        <span class="auth-glow auth-glow-left"></span>
        <span class="auth-glow auth-glow-right"></span>
      </div>

      <div class="login-panel">
        <div class="login-head">
          <h1 id="login-title" class="login-title">
            <span class="brand-title-accent">Build</span><span class="brand-title-dot">.</span>Connect
          </h1>
          <p class="login-subtitle">Acesse sua central de integração com segurança.</p>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <label class="form-field" for="login-id">
            <span class="form-label">Seu ID</span>
            <div class="input-shell is-auth-input">
              <span class="input-icon" aria-hidden="true">
                <i data-lucide="badge-check"></i>
              </span>
              <input
                id="login-id"
                name="loginId"
                type="text"
                inputmode="text"
                autocomplete="username"
                placeholder="Digite seu ID"
                required
              />
            </div>
          </label>

          <label class="form-field" for="login-password">
            <span class="form-label">Senha</span>
            <div class="input-shell is-auth-input has-action">
              <span class="input-icon" aria-hidden="true">
                <i data-lucide="lock"></i>
              </span>
              <input
                id="login-password"
                name="loginPassword"
                type="password"
                autocomplete="current-password"
                placeholder="Digite sua senha"
                required
              />
              <button
                class="login-password-toggle"
                id="login-password-toggle"
                type="button"
                aria-label="Exibir senha"
                aria-pressed="false"
              >
                <i data-lucide="eye"></i>
              </button>
            </div>
          </label>

          <div class="login-alert ${loginState.errorMessage ? 'is-visible is-error' : ''}" role="alert" aria-live="assertive">
            ${loginState.errorMessage ?? ''}
          </div>

          <button class="login-submit" type="submit" ${loginState.isLoading ? 'disabled' : ''}>
            <span class="login-submit-icon" aria-hidden="true">
              <i data-lucide="log-in"></i>
            </span>
            <span>${loginState.isLoading ? 'Validando...' : 'Entrar'}</span>
          </button>
        </form>

        <p class="login-hint">Dica: pressione Enter para entrar.</p>
        <p class="login-footnote">© Build.Connect</p>
      </div>
    </section>
  `;

  refreshLucideIcons(rootElement);
  bindLoginEvents(rootElement, handlers);
}

function bindLoginEvents(rootElement, handlers) {
  const form = rootElement.querySelector('#login-form');
  const passwordInput = rootElement.querySelector('#login-password');
  const toggleButton = rootElement.querySelector('#login-password-toggle');

  toggleButton?.addEventListener('click', () => {
    const isPasswordVisible = passwordInput?.type === 'text';
    const nextIsVisible = !isPasswordVisible;

    if (passwordInput) {
      passwordInput.type = nextIsVisible ? 'text' : 'password';
    }

    toggleButton.setAttribute('aria-pressed', String(nextIsVisible));
    toggleButton.setAttribute('aria-label', nextIsVisible ? 'Ocultar senha' : 'Exibir senha');
    toggleButton.innerHTML = `<i data-lucide="${nextIsVisible ? 'eye-off' : 'eye'}"></i>`;
    refreshLucideIcons(toggleButton);
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const loginId = String(formData.get('loginId') ?? '').trim();
    const loginPassword = String(formData.get('loginPassword') ?? '');

    handlers.onSubmit({
      id: loginId,
      password: loginPassword,
    });
  });
}
