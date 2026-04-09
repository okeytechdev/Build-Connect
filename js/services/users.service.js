const USERS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyNBAJy1nrKG1_alpIfa4NBj_VGsF5BgJ9RK4dBHRgTuFoojcZjslQvTKPFWN6WQS5I/exec';
const USERS_BRIDGE_MESSAGE_TYPE = 'BUILD_CONNECT_USERS_RESULT';
const USERS_REQUEST_TIMEOUT_MS = 15000;

let activeUsersCache = null;

export async function loadActiveUsers({ forceRefresh = false } = {}) {
  if (!forceRefresh && Array.isArray(activeUsersCache)) {
    return {
      success: true,
      code: 'USERS_CACHE_OK',
      users: activeUsersCache,
    };
  }

  const response = await requestUsersViaBridge();

  if (response?.success) {
    activeUsersCache = Array.isArray(response.users) ? response.users : [];
    return {
      success: true,
      code: response.code || 'USERS_LIST_OK',
      users: activeUsersCache,
      message: response.message || '',
    };
  }

  return {
    success: false,
    code: response?.code || 'USERS_LIST_ERROR',
    users: [],
    message: response?.message || 'Não foi possível carregar os usuários ativos.',
  };
}

function requestUsersViaBridge() {
  if (!USERS_WEB_APP_URL) {
    return Promise.reject(new Error('URL do Web App não configurada para carregar usuários ativos.'));
  }

  return new Promise((resolve, reject) => {
    const requestId = `users-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('A busca pelos usuários ativos demorou mais que o esperado.'));
    }, USERS_REQUEST_TIMEOUT_MS);

    iframe.name = `build-connect-users-iframe-${requestId}`;
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.display = 'none';

    form.method = 'POST';
    form.action = USERS_WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    form.noValidate = true;

    appendHiddenField(form, 'action', 'list-active-users');
    appendHiddenField(form, 'bridge', 'iframe-post-message');
    appendHiddenField(form, 'messageType', USERS_BRIDGE_MESSAGE_TYPE);
    appendHiddenField(form, 'requestId', requestId);
    appendHiddenField(form, 'origin', getParentOrigin());

    function handleMessage(event) {
      if (!isAllowedBridgeOrigin(event.origin)) {
        return;
      }

      const message = parseBridgeMessage(event.data);

      if (!message || message.type !== USERS_BRIDGE_MESSAGE_TYPE || message.requestId !== requestId) {
        return;
      }

      cleanup();
      resolve(message.payload);
    }

    function handleIframeError() {
      cleanup();
      reject(new Error('Não foi possível carregar a bridge de usuários ativos.'));
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
