const AUTH_STORAGE_KEY = 'build.connect.auth-user';
const AUTH_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyNBAJy1nrKG1_alpIfa4NBj_VGsF5BgJ9RK4dBHRgTuFoojcZjslQvTKPFWN6WQS5I/exec';
const AUTH_BRIDGE_MESSAGE_TYPE = 'BUILD_CONNECT_AUTH_RESULT';
const AUTH_REQUEST_TIMEOUT_MS = 15000;

export function loginUser(id, password) {
  const normalizedId = String(id ?? '').trim();
  const normalizedPassword = String(password ?? '');

  if (!normalizedId || !normalizedPassword) {
    return Promise.resolve({
      success: false,
      code: 'INVALID_INPUT',
      message: 'Informe o ID e a senha para continuar.',
    });
  }

  return loginViaAppsScriptBridge(normalizedId, normalizedPassword)
    .then((response) => normalizeAuthResponse(response))
    .catch((error) => ({
      success: false,
      code: 'NETWORK_ERROR',
      message: error?.message || 'Falha ao comunicar com o servidor de autenticação.',
    }));
}

export function getAuthenticatedUser() {
  try {
    const storedValue = sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);

    if (!parsedValue?.id || !parsedValue?.nome || !parsedValue?.nivel) {
      return null;
    }

    return {
      ...parsedValue,
      setor: typeof parsedValue?.setor === 'string' ? parsedValue.setor : '',
      setorLabel: typeof parsedValue?.setorLabel === 'string' ? parsedValue.setorLabel : '',
    };
  } catch {
    return null;
  }
}

export function persistAuthenticatedUser(user) {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // noop
  }
}

export function clearAuthenticatedUser() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // noop
  }
}

function loginViaAppsScriptBridge(id, password) {
  if (!AUTH_WEB_APP_URL) {
    return Promise.reject(new Error('URL do Web App do Apps Script não configurada.'));
  }

  return new Promise((resolve, reject) => {
    const requestId = `auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('A autenticação demorou mais que o esperado. Tente novamente.'));
    }, AUTH_REQUEST_TIMEOUT_MS);

    iframe.name = `build-connect-auth-iframe-${requestId}`;
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.display = 'none';

    form.method = 'POST';
    form.action = AUTH_WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    form.noValidate = true;

    appendHiddenField(form, 'action', 'login');
    appendHiddenField(form, 'bridge', 'iframe-post-message');
    appendHiddenField(form, 'requestId', requestId);
    appendHiddenField(form, 'origin', getParentOrigin());
    appendHiddenField(form, 'id', id);
    appendHiddenField(form, 'password', password);

    function handleMessage(event) {
      if (!isAllowedBridgeOrigin(event.origin)) {
        return;
      }

      const message = parseBridgeMessage(event.data);

      if (!message || message.type !== AUTH_BRIDGE_MESSAGE_TYPE || message.requestId !== requestId) {
        return;
      }

      cleanup();
      resolve(message.payload);
    }

    function handleIframeError() {
      cleanup();
      reject(new Error('Não foi possível carregar a bridge de autenticação do Apps Script.'));
    }

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('error', handleIframeError);
      form.remove();
      iframe.remove();
    }

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('error', handleIframeError);

    document.body.append(iframe, form);
    form.submit();
  });
}

function appendHiddenField(form, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = String(value ?? '');
  form.appendChild(input);
}

function getParentOrigin() {
  const origin = window.location.origin;
  return !origin || origin === 'null' ? '*' : origin;
}

function isAllowedBridgeOrigin(origin) {
  if (!origin) {
    return false;
  }

  return origin === 'https://script.google.com' || /https:\/\/[\w.-]*googleusercontent\.com$/.test(origin);
}

function parseBridgeMessage(data) {
  if (!data) {
    return null;
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (typeof data === 'object') {
    return data;
  }

  return null;
}

function normalizeAuthResponse(response) {
  if (response?.success) {
    return {
      success: true,
      code: response.code || 'AUTH_OK',
      message: response.message || 'Acesso liberado.',
      user: {
        ...response.user,
        setor: typeof response.user?.setor === 'string' ? response.user.setor : '',
        setorLabel: typeof response.user?.setorLabel === 'string' ? response.user.setorLabel : '',
      },
    };
  }

  return {
    success: false,
    code: response?.code || 'AUTH_FAILED',
    message: response?.message || getFallbackMessage(response?.code),
  };
}

function getFallbackMessage(code) {
  switch (code) {
    case 'USER_INACTIVE':
      return 'Usuário inativo. Procure um administrador.';
    case 'INVALID_PASSWORD':
      return 'Senha incorreta.';
    case 'ID_NOT_FOUND':
      return 'ID não encontrado.';
    case 'INVALID_SECTOR':
      return 'Setor de acesso inválido na planilha Usuarios.';
    case 'NETWORK_ERROR':
      return 'Falha de comunicação com o servidor de autenticação.';
    default:
      return 'Não foi possível concluir o login.';
  }
}
