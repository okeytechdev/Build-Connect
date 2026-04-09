const INTEGRATIONS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyNBAJy1nrKG1_alpIfa4NBj_VGsF5BgJ9RK4dBHRgTuFoojcZjslQvTKPFWN6WQS5I/exec';
const INTEGRATIONS_BRIDGE_MESSAGE_TYPE = 'BUILD_CONNECT_MODULE_RESULT';
const MODULE_REQUEST_TIMEOUT_MS = 18000;

const moduleCache = new Map();

export const MODULE_SOURCE_LABELS = {
  documentos: 'Google Drive',
  'instrucoes-escritas': 'Google Drive',
  'instrucoes-video': 'YouTube',
  avaliacao: 'Build.Connect',
  feedback: 'Build.Connect',
};

export function isDynamicExternalModule(moduleId) {
  return moduleId === 'documentos' || moduleId === 'instrucoes-escritas' || moduleId === 'instrucoes-video';
}

export async function loadModuleContent({ sectorId, moduleId, forceRefresh = false }) {
  const cacheKey = `${sectorId}:${moduleId}`;

  if (!forceRefresh && moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey);
  }

  if (!isDynamicExternalModule(moduleId)) {
    const staticPayload = {
      success: true,
      code: 'MODULE_STATIC',
      module: {
        id: moduleId,
        source: MODULE_SOURCE_LABELS[moduleId] || 'Build.Connect',
      },
      items: [],
      emptyMessage: 'Este módulo continua disponível no fluxo interno do Build.Connect.',
    };

    moduleCache.set(cacheKey, staticPayload);
    return staticPayload;
  }

  const response = await requestModuleContentViaBridge({ sectorId, moduleId });
  const normalizedResponse = normalizeModuleResponse(response, moduleId);

  if (normalizedResponse.success) {
    moduleCache.set(cacheKey, normalizedResponse);
  }

  return normalizedResponse;
}

export function clearModuleContentCache() {
  moduleCache.clear();
}

function requestModuleContentViaBridge({ sectorId, moduleId }) {
  if (!INTEGRATIONS_WEB_APP_URL) {
    return Promise.reject(new Error('URL do Web App não configurada para carregar os módulos.'));
  }

  return new Promise((resolve, reject) => {
    const requestId = `module-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('O carregamento do conteúdo demorou mais que o esperado.'));
    }, MODULE_REQUEST_TIMEOUT_MS);

    iframe.name = `build-connect-module-iframe-${requestId}`;
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.display = 'none';

    form.method = 'POST';
    form.action = INTEGRATIONS_WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    form.noValidate = true;

    appendHiddenField(form, 'action', 'module-content');
    appendHiddenField(form, 'bridge', 'iframe-post-message');
    appendHiddenField(form, 'messageType', INTEGRATIONS_BRIDGE_MESSAGE_TYPE);
    appendHiddenField(form, 'requestId', requestId);
    appendHiddenField(form, 'origin', getParentOrigin());
    appendHiddenField(form, 'sectorId', sectorId);
    appendHiddenField(form, 'moduleId', moduleId);

    function handleMessage(event) {
      if (!isAllowedBridgeOrigin(event.origin)) {
        return;
      }

      const message = parseBridgeMessage(event.data);

      if (!message || message.type !== INTEGRATIONS_BRIDGE_MESSAGE_TYPE || message.requestId !== requestId) {
        return;
      }

      cleanup();
      resolve(message.payload);
    }

    function handleIframeError() {
      cleanup();
      reject(new Error('Não foi possível carregar o conteúdo do módulo.'));
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

function normalizeModuleResponse(response, moduleId) {
  if (response?.success) {
    return {
      success: true,
      code: response.code || 'MODULE_DATA_OK',
      module: response.module || { id: moduleId, source: MODULE_SOURCE_LABELS[moduleId] || 'Build.Connect' },
      items: normalizeModuleItems(Array.isArray(response.items) ? response.items : [], moduleId),
      emptyMessage: response.emptyMessage || 'Nenhum conteúdo disponível neste momento.',
      message: response.message || '',
    };
  }

  return {
    success: false,
    code: response?.code || 'MODULE_DATA_ERROR',
    message: response?.message || getModuleFallbackMessage(moduleId),
    module: response?.module || { id: moduleId, source: MODULE_SOURCE_LABELS[moduleId] || 'Build.Connect' },
    items: [],
  };
}

function getModuleFallbackMessage(moduleId) {
  switch (moduleId) {
    case 'documentos':
    case 'instrucoes-escritas':
      return 'Não foi possível carregar os arquivos do Google Drive.';
    case 'instrucoes-video':
      return 'Não foi possível carregar os vídeos do YouTube.';
    default:
      return 'Não foi possível carregar o conteúdo deste módulo.';
  }
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


function normalizeModuleItems(items, moduleId) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (moduleId === 'documentos' || moduleId === 'instrucoes-escritas') {
    return items.map(normalizeDocumentItem);
  }

  return items;
}

function normalizeDocumentItem(item) {
  const normalizedItem = item && typeof item === 'object' ? item : {};
  const name = String(normalizedItem.name || normalizedItem.title || normalizedItem.fileName || '').trim();
  const openUrl = String(
    normalizedItem.openUrl ||
    normalizedItem.webViewLink ||
    normalizedItem.url ||
    normalizedItem.viewUrl ||
    ''
  ).trim();
  const previewUrl = String(
    normalizedItem.previewUrl ||
    normalizedItem.viewUrl ||
    normalizedItem.embedUrl ||
    ''
  ).trim();

  return {
    ...normalizedItem,
    name,
    title: name || String(normalizedItem.title || '').trim(),
    openUrl,
    previewUrl,
  };
}
