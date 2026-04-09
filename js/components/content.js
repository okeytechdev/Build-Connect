import {
  DEFAULT_SECTOR_CARDS,
  getCardsForSector,
  getSectorBreadcrumb,
  isDhoSector,
} from '../services/navigation.service.js';
import { refreshLucideIcons } from '../services/icons.service.js';
import {
  MODULE_SOURCE_LABELS,
  loadModuleContent,
} from '../services/integrations.service.js';
import { loadActiveUsers } from '../services/users.service.js';

const VIEW_EXIT_DURATION_MS = 180;
const MODULE_CARD_IDS = new Set([...DEFAULT_SECTOR_CARDS, ...getCardsForSector('dho')].map((card) => card.id));
const MODULE_STATE_BY_SECTOR = new Map();
const MODULE_REQUEST_TOKENS = new Map();
const MODULE_UI_DEFAULTS = Object.freeze({
  query: '',
  sort: 'az',
  view: 'grid',
});
const EVALUATION_PERIODS = Object.freeze([
  { id: '7', label: '7 dias' },
  { id: '14', label: '14 dias' },
  { id: '21', label: '21 dias' },
]);
const EVALUATION_CRITERIA = Object.freeze([
  { id: 'disciplina', title: 'Disciplina', description: 'Obediência às normas da empresa e ordens recebidas.' },
  { id: 'iniciativa', title: 'Iniciativa', description: 'Fazer o que tem de ser feito sem esperar ordens.' },
  { id: 'assiduidade', title: 'Assiduidade', description: 'Não faltar ao trabalho.' },
  { id: 'pontualidade', title: 'Pontualidade', description: 'Não chegar atrasado e cumprir o horário da empresa.' },
  { id: 'apresentacao', title: 'Apresentação pessoal', description: 'Asseio pessoal, roupa e organização do local de trabalho.' },
  { id: 'sociabilidade', title: 'Sociabilidade', description: 'Facilidade para trabalhar em grupo.' },
  { id: 'cooperacao', title: 'Cooperação', description: 'Contribuição com os outros visando objetivos comuns.' },
  { id: 'dinamismo', title: 'Dinamismo', description: 'Capacidade de agilizar o processo produtivo.' },
  { id: 'lideranca', title: 'Liderança', description: 'Capacidade de conduzir os outros a objetivos comuns.' },
  { id: 'responsabilidade', title: 'Responsabilidade', description: 'Comprometer-se a realizar tudo aquilo que é de sua atribuição.' },
  { id: 'eficiencia', title: 'Eficiência', description: 'Realização de atribuições dentro dos prazos e critérios estabelecidos.' },
  { id: 'eficacia', title: 'Eficácia / Produtividade', description: 'Qualidade do trabalho apresentado dentro dos critérios de qualidade.' },
  { id: 'potencialidade', title: 'Potencialidade', description: 'Aptidão para exercício de outras atribuições ou funções.' },
  { id: 'criatividade', title: 'Criatividade', description: 'Capacidade de encontrar soluções diferentes para os mesmos acontecimentos.' },
  { id: 'simpatia', title: 'Simpatia', description: 'Habilidade de expressar alegria e felicidade.' },
  { id: 'resultado', title: 'Foco no resultado', description: 'Capacidade de olhar para os processos como um todo, focando não na tarefa, mas no resultado.' },
]);
const EVALUATION_UI_DEFAULTS = Object.freeze({
  selectedEvaluateeId: '',
  evaluateeQuery: '',
  isEvaluateeListOpen: false,
  evaluationScores: {},
  evaluationNotes: '',
});
const FEEDBACK_UI_DEFAULTS = Object.freeze({
  selectedTargetUserId: '',
  targetUserQuery: '',
  isTargetUserListOpen: false,
  feedbackMessage: '',
});

const WELCOME_VIDEO = Object.freeze({
  title: 'Vídeo institucional Build.Connect',
  embedUrl: 'https://www.youtube.com/embed/QPzoygOAs1U',
});

let currentRenderToken = 0;
let revealObserver = null;
let activeOverlayModal = null;
let activeEscapeHandler = null;

export function renderContentView(rootElement, viewState, options = {}) {
  const { animate = true } = options;
  const nextToken = ++currentRenderToken;
  const currentPanel = rootElement.querySelector('.content-panel');

  closeActiveOverlayModal();

  if (animate && currentPanel) {
    currentPanel.classList.add('is-view-exit');

    window.setTimeout(() => {
      if (nextToken !== currentRenderToken) {
        return;
      }

      mountView(rootElement, viewState);
    }, VIEW_EXIT_DURATION_MS);

    return;
  }

  mountView(rootElement, viewState);
}

function mountView(rootElement, viewState) {
  disconnectRevealObserver();
  rootElement.innerHTML = getViewMarkup(viewState);
  refreshLucideIcons(rootElement);
  activateViewTransition(rootElement);
  activateRevealAnimations(rootElement);
  bindContentInteractions(rootElement, viewState);
}

function bindContentInteractions(rootElement, viewState) {
  const sector = viewState.selectedItem;

  if (rootElement.__buildConnectContentClickHandler) {
    rootElement.removeEventListener('click', rootElement.__buildConnectContentClickHandler);
    delete rootElement.__buildConnectContentClickHandler;
  }

  if (rootElement.__buildConnectContentInputHandler) {
    rootElement.removeEventListener('input', rootElement.__buildConnectContentInputHandler);
    delete rootElement.__buildConnectContentInputHandler;
  }

  if (rootElement.__buildConnectContentChangeHandler) {
    rootElement.removeEventListener('change', rootElement.__buildConnectContentChangeHandler);
    delete rootElement.__buildConnectContentChangeHandler;
  }

  if (!viewState.shouldRenderCards || !sector?.id) {
    return;
  }

  const clickHandler = (event) => {
    const cardButton = event.target.closest('[data-module-card]');

    if (cardButton) {
      event.preventDefault();
      const moduleId = cardButton.dataset.moduleId;

      if (!moduleId || !MODULE_CARD_IDS.has(moduleId)) {
        return;
      }

      handleModuleSelection(rootElement, sector, moduleId, viewState.authenticatedUser);
      return;
    }

    const retryButton = event.target.closest('[data-module-retry]');

    if (retryButton) {
      event.preventDefault();
      const moduleId = retryButton.dataset.moduleId;

      if (moduleId) {
        handleModuleSelection(rootElement, sector, moduleId, viewState.authenticatedUser, { forceRefresh: true });
      }

      return;
    }

    const sortButton = event.target.closest('[data-module-sort]');

    if (sortButton) {
      event.preventDefault();
      toggleModuleSort(rootElement, sector);
      return;
    }

    const viewButton = event.target.closest('[data-module-view]');

    if (viewButton) {
      event.preventDefault();
      setModuleView(rootElement, sector, viewButton.dataset.moduleView || 'grid');
      return;
    }

    const videoButton = event.target.closest('[data-video-embed-url]');

    if (videoButton) {
      event.preventDefault();
      openVideoModal({
        title: videoButton.dataset.videoTitle || 'Vídeo de treinamento',
        embedUrl: videoButton.dataset.videoEmbedUrl || '',
      });
      return;
    }

    const documentButton = event.target.closest('[data-document-preview-url]');

    if (documentButton) {
      event.preventDefault();
      openDocumentModal({
        title: documentButton.dataset.documentTitle || 'Documento',
        previewUrl: documentButton.dataset.documentPreviewUrl || '',
      });
      return;
    }

    const evaluateeToggle = event.target.closest('[data-evaluatee-toggle]');

    if (evaluateeToggle) {
      event.preventDefault();
      toggleEvaluationDropdown(rootElement, sector);
      return;
    }

    const evaluateeOption = event.target.closest('[data-evaluatee-option]');

    if (evaluateeOption) {
      event.preventDefault();
      selectEvaluationUser(rootElement, sector, evaluateeOption.dataset.userId || '');
      return;
    }

    const feedbackTargetToggle = event.target.closest('[data-feedback-target-toggle]');

    if (feedbackTargetToggle) {
      event.preventDefault();
      toggleFeedbackDropdown(rootElement, sector);
      return;
    }

    const feedbackTargetOption = event.target.closest('[data-feedback-target-option]');

    if (feedbackTargetOption) {
      event.preventDefault();
      selectFeedbackUser(rootElement, sector, feedbackTargetOption.dataset.userId || '');
      return;
    }

    if (!event.target.closest('[data-evaluation-picker]')) {
      closeEvaluationDropdown(rootElement, sector);
    }

    if (!event.target.closest('[data-feedback-picker]')) {
      closeFeedbackDropdown(rootElement, sector);
    }
  };

  const inputHandler = (event) => {
    const searchInput = event.target.closest('[data-module-search]');

    if (searchInput) {
      updateModuleQuery(rootElement, sector, searchInput.value || '');
      return;
    }

    const evaluateeSearchInput = event.target.closest('[data-evaluatee-search]');

    if (evaluateeSearchInput) {
      updateEvaluationSearch(rootElement, sector, evaluateeSearchInput.value || '');
      return;
    }

    const feedbackSearchInput = event.target.closest('[data-feedback-target-search]');

    if (feedbackSearchInput) {
      updateFeedbackSearch(rootElement, sector, feedbackSearchInput.value || '');
      return;
    }

    const notesInput = event.target.closest('[data-evaluation-notes]');

    if (notesInput) {
      updateEvaluationNotes(rootElement, sector, notesInput.value || '');
      return;
    }

    const feedbackMessageInput = event.target.closest('[data-feedback-message]');

    if (feedbackMessageInput) {
      updateFeedbackField(rootElement, sector, 'feedbackMessage', feedbackMessageInput.value || '');
    }
  };

  const changeHandler = (event) => {
    const scoreInput = event.target.closest('[data-evaluation-score]');

    if (scoreInput) {
      updateEvaluationScore(
        rootElement,
        sector,
        scoreInput.dataset.criterionId || '',
        scoreInput.dataset.period || '',
        scoreInput.value || '',
      );
      return;
    }

    const feedbackCategorySelect = event.target.closest('[data-feedback-category]');

    if (feedbackCategorySelect) {
      updateFeedbackField(rootElement, sector, 'feedbackCategory', feedbackCategorySelect.value || '');
    }
  };

  rootElement.__buildConnectContentClickHandler = clickHandler;
  rootElement.__buildConnectContentInputHandler = inputHandler;
  rootElement.__buildConnectContentChangeHandler = changeHandler;
  rootElement.addEventListener('click', clickHandler);
  rootElement.addEventListener('input', inputHandler);
  rootElement.addEventListener('change', changeHandler);
}

function getViewMarkup(viewState) {
  if (viewState.isWelcome) {
    return getWelcomeViewMarkup(viewState.authenticatedUser);
  }

  if (viewState.shouldRenderCards) {
    return getSectorCardsViewMarkup(viewState.selectedItem);
  }

  return getWelcomeViewMarkup(viewState.authenticatedUser);
}

function getWelcomeViewMarkup(authenticatedUser) {
  const greeting = getWelcomeGreeting(authenticatedUser);

  return `
    <section class="content-panel" aria-labelledby="content-title" data-view-panel>
      <div class="welcome-header reveal-item" data-reveal>
        <p class="eyebrow">Mensagem de boas-vindas</p>
        <h1 id="content-title">${sanitizeText(greeting.title)}</h1>
        <p class="content-description">${sanitizeText(greeting.description)}</p>
      </div>

      <section class="welcome-showcase reveal-item" data-reveal aria-label="Painel principal de boas-vindas">
        <article class="welcome-video-card">
          <div class="welcome-video-frame">
            <iframe
              src="${sanitizeAttribute(WELCOME_VIDEO.embedUrl)}"
              title="${sanitizeAttribute(WELCOME_VIDEO.title)}"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </article>

        <article class="welcome-copy-card">
          <p class="eyebrow">Hub de integração</p>
          <h2 class="welcome-section-title">Seja bem-vindo(a) ao Build.Connect</h2>
          <div class="welcome-copy-flow">
            <p>Este ambiente foi preparado para centralizar os conteúdos essenciais de integração, padronizar o acesso às informações e apoiar sua jornada em cada setor da empresa.</p>
            <p>Aqui você encontrará documentos, instruções escritas, vídeos e materiais de acompanhamento que ajudam a entender processos, rotinas e responsabilidades com mais clareza.</p>
            <p>Use a navegação lateral para acessar os setores e consulte este painel inicial sempre que precisar retomar a visão geral do projeto.</p>
          </div>
        </article>
      </section>
    </section>
  `;
}

function getWelcomeGreeting(authenticatedUser) {
  const normalizedName = String(authenticatedUser?.nome || '').trim();

  if (!normalizedName) {
    return {
      title: 'Bem-vindo ao Build.Connect',
      description: 'Acompanhe os conteúdos de integração e acesse as informações principais de cada setor em um único lugar.',
    };
  }

  const firstName = normalizedName.split(/\s+/)[0];
  const hour = new Date().getHours();
  const period = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return {
    title: `${period}, ${firstName}.`,
    description: 'Sua central de integração está pronta para apoiar sua navegação pelos setores e conteúdos institucionais.',
  };
}

function getSectorCardsViewMarkup(sector) {
  const breadcrumb = getSectorBreadcrumb(sector);
  const stageState = getModuleState(sector.id);
  const cards = getCardsForSector(sector.id);
  const cardsLabel = isDhoSector(sector.id) ? 'Cards do setor DHO' : 'Cards padrão do setor';

  return `
    <section class="content-panel" aria-labelledby="content-title" data-view-panel>
      <div class="content-header">
        <div>
          <p class="eyebrow reveal-item" data-reveal>Setor selecionado</p>
          <h1 id="content-title" class="reveal-item" data-reveal>${breadcrumb}</h1>
          <p class="content-description reveal-item" data-reveal>${sector.description}</p>
        </div>
      </div>

      <div class="cards-grid" aria-label="${cardsLabel}">
        ${cards.map((card) => renderFeatureCard(card, breadcrumb, stageState.selectedModuleId)).join('')}
      </div>

      <section class="module-stage reveal-item" data-reveal aria-live="polite" data-module-stage data-sector-id="${sector.id}">
        ${getModuleStageMarkup(sector, stageState)}
      </section>
    </section>
  `;
}

function renderFeatureCard(card, sectorName, selectedModuleId) {
  const isSelected = selectedModuleId === card.id;

  return `
    <button
      type="button"
      class="feature-card feature-card-button reveal-item ${isSelected ? 'is-selected' : ''}"
      data-reveal
      data-module-card
      data-module-id="${card.id}"
      aria-pressed="${String(isSelected)}"
      aria-label="Abrir módulo ${card.title} do setor ${sectorName}"
    >
      <span class="card-icon" aria-hidden="true">
        <i data-lucide="${card.icon}"></i>
      </span>
      <h2 class="card-title">${card.title}</h2>
      <p class="card-description">${card.getDescription(sectorName)}</p>
      <div class="feature-card-footer">
        <span class="feature-card-status">Padrão</span>
        <span class="feature-card-hint">${card.hint}</span>
      </div>
    </button>
  `;
}

function getModuleStageMarkup(sector, stageState) {
  if (!stageState.selectedModuleId) {
    return `
      <div class="module-shell is-empty" data-module-shell>
        <div class="module-shell-header">
          <div>
            <p class="module-eyebrow">Conteúdo do módulo</p>
            <h2 class="module-title">Selecione um card para continuar</h2>
            <p class="module-description">
              Escolha um dos módulos acima para abrir documentos, instruções ou vídeos relacionados ao setor ${sector.label}.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  const selectedCard = getCardsForSector(sector.id).find((card) => card.id === stageState.selectedModuleId);

  if (!selectedCard) {
    return '';
  }

  if (stageState.status === 'loading') {
    return getModuleLoadingMarkup(selectedCard);
  }

  if (stageState.status === 'error') {
    return getModuleErrorMarkup(selectedCard, stageState.errorMessage);
  }

  if (stageState.selectedModuleId === 'instrucoes-video') {
    return getVideoModuleMarkup(selectedCard, stageState.moduleData, stageState.ui);
  }

  if (stageState.selectedModuleId === 'documentos' || stageState.selectedModuleId === 'instrucoes-escritas') {
    return getDocumentModuleMarkup(selectedCard, stageState.moduleData, stageState.ui);
  }

  if (stageState.selectedModuleId === 'avaliacao') {
    return getEvaluationModuleMarkup(selectedCard, stageState.moduleData, stageState.ui);
  }

  if (stageState.selectedModuleId === 'feedback') {
    return getFeedbackModuleMarkup(selectedCard, stageState.moduleData, stageState.ui);
  }

  return getInternalModuleMarkup(selectedCard);
}

function getModuleLoadingMarkup(card) {
  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header">
        <div>
          <p class="module-eyebrow">Carregando conteúdo</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Estamos buscando os itens deste módulo.</p>
        </div>
      </div>

      <div class="module-items-grid" aria-hidden="true">
        ${Array.from({ length: card.id === 'instrucoes-video' ? 4 : 6 }, (_, index) => getSkeletonCardMarkup(index)).join('')}
      </div>
    </div>
  `;
}

function getModuleErrorMarkup(card, message) {
  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header">
        <div>
          <p class="module-eyebrow">Falha ao carregar</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">${message}</p>
        </div>
      </div>

      <div class="empty-state is-compact">
        <span class="empty-state-icon" aria-hidden="true">
          <i data-lucide="wifi-off"></i>
        </span>
        <div>
          <h3 class="card-title">Não foi possível concluir a consulta</h3>
          <p class="card-description">Verifique a configuração da integração e tente novamente.</p>
        </div>
        <button type="button" class="module-action-button" data-module-retry data-module-id="${card.id}">
          <i data-lucide="refresh-cw"></i>
          <span>Tentar novamente</span>
        </button>
      </div>
    </div>
  `;
}

function getDocumentModuleMarkup(card, moduleData, moduleUi) {
  const items = Array.isArray(moduleData?.items) ? moduleData.items : [];

  if (!items.length) {
    return getModuleEmptyMarkup(card, moduleData?.emptyMessage || 'Nenhum arquivo foi encontrado para este módulo.');
  }

  const preparedItems = prepareModuleItems(items, moduleUi, 'document');

  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header module-shell-header--stacked">
        <div>
          <p class="module-eyebrow">Conteúdo carregado</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Arquivos listados automaticamente a partir do Google Drive.</p>
        </div>

        ${getModuleToolbarMarkup(card.id, moduleUi, items.length, preparedItems.length, 'Busque por nome do arquivo')}
      </div>

      <div class="module-items-grid module-items-grid-docs ${moduleUi.view === 'list' ? 'is-list-view' : 'is-grid-view'}" data-module-items-container>
        ${preparedItems.length ? preparedItems.map(renderDocumentItemCard).join('') : getModuleSearchEmptyMarkup()}
      </div>
    </div>
  `;
}

function renderDocumentItemCard(item) {
  const extension = sanitizeText(item.extension || 'Arquivo').toUpperCase();
  const modifiedLabel = formatDateLabel(item.modifiedAt);
  const sizeLabel = sanitizeText(item.sizeLabel || '');
  const metadata = [extension, modifiedLabel, sizeLabel].filter(Boolean);
  const previewUrl = resolveDocumentPreviewUrl(item);
  const canPreview = Boolean(previewUrl);

  return `
    <article class="module-item-card" data-module-entry>
      <div class="module-item-header">
        <span class="card-icon module-item-icon" aria-hidden="true">
          <i data-lucide="file-text"></i>
        </span>
        <div class="module-item-copy">
          <h3 class="module-item-title">${sanitizeText(item.name || 'Arquivo sem nome')}</h3>
          <p class="module-item-meta">${metadata.join(' • ')}</p>
        </div>
      </div>

      <div class="module-item-actions">
        <button
          type="button"
          class="module-link-button"
          data-document-preview-url="${sanitizeAttribute(previewUrl)}"
          data-document-title="${sanitizeAttribute(item.name || 'Documento')}"
          ${canPreview ? '' : 'disabled'}
        >
          <i data-lucide="external-link"></i>
          <span>Abrir</span>
        </button>
      </div>
    </article>
  `;
}

function getVideoModuleMarkup(card, moduleData, moduleUi) {
  const items = Array.isArray(moduleData?.items) ? moduleData.items : [];

  if (!items.length) {
    return getModuleEmptyMarkup(card, moduleData?.emptyMessage || 'Nenhum vídeo foi encontrado para este módulo.');
  }

  const preparedItems = prepareModuleItems(items, moduleUi, 'video');

  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header module-shell-header--stacked">
        <div>
          <p class="module-eyebrow">Conteúdo carregado</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Vídeos carregados automaticamente a partir da playlist configurada no YouTube.</p>
        </div>

        ${getModuleToolbarMarkup(card.id, moduleUi, items.length, preparedItems.length, 'Busque por título do vídeo')}
      </div>

      <div class="module-items-grid module-items-grid-video ${moduleUi.view === 'list' ? 'is-list-view' : 'is-grid-view'}" data-module-items-container>
        ${preparedItems.length ? preparedItems.map(renderVideoItemCard).join('') : getModuleSearchEmptyMarkup()}
      </div>
    </div>
  `;
}

function renderVideoItemCard(item) {
  const thumbnail = sanitizeAttribute(item.thumbnailUrl || '');
  const title = sanitizeText(item.title || 'Vídeo sem título');
  const embedUrl = sanitizeAttribute(item.embedUrl || '');

  return `
    <article class="module-item-card is-video" data-module-entry>
      <div class="video-thumb-wrap">
        <img class="video-thumb" src="${thumbnail}" alt="Thumbnail do vídeo ${title}" loading="lazy" />
        <span class="video-duration-badge">${sanitizeText(item.durationLabel || '00:00')}</span>
      </div>

      <div class="module-item-copy">
        <h3 class="module-item-title">${title}</h3>
      </div>

      <div class="module-item-actions">
        <button
          type="button"
          class="module-link-button"
          data-video-embed-url="${embedUrl}"
          data-video-title="${sanitizeAttribute(item.title || 'Vídeo de treinamento')}"
        >
          <i data-lucide="play"></i>
          <span>Assistir</span>
        </button>
      </div>
    </article>
  `;
}

function getInternalModuleMarkup(card) {
  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header">
        <div>
          <p class="module-eyebrow">Fluxo interno</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Este módulo está pronto para receber a lógica interna do Build.Connect em uma próxima etapa.</p>
        </div>
      </div>

      <div class="empty-state is-compact">
        <span class="empty-state-icon" aria-hidden="true">
          <i data-lucide="sparkles"></i>
        </span>
        <div>
          <h3 class="card-title">Módulo preparado</h3>
          <p class="card-description">A estrutura deste card já foi criada e pode receber a implementação específica quando você solicitar.</p>
        </div>
      </div>
    </div>
  `;
}

function getModuleEmptyMarkup(card, message) {
  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header">
        <div>
          <p class="module-eyebrow">Sem itens disponíveis</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">${message}</p>
        </div>
      </div>

      <div class="empty-state is-compact">
        <span class="empty-state-icon" aria-hidden="true">
          <i data-lucide="folder-search"></i>
        </span>
        <div>
          <h3 class="card-title">Nenhum conteúdo encontrado</h3>
          <p class="card-description">Assim que houver itens configurados para este setor, eles aparecerão aqui automaticamente.</p>
        </div>
      </div>
    </div>
  `;
}

function getModuleToolbarMarkup(moduleId, moduleUi, totalCount, filteredCount, searchPlaceholder) {
  const sortLabel = moduleUi.sort === 'az' ? 'A-Z' : 'Z-A';

  return `
    <div class="module-toolbar" aria-label="Controles de visualização do módulo">
      <button type="button" class="module-control-button" data-module-sort data-module-id="${moduleId}" aria-label="Alternar ordenação alfabética">
        <i data-lucide="arrow-up-down"></i>
        <span>${sortLabel}</span>
      </button>

      <div class="module-view-toggle" role="group" aria-label="Alternar visualização do conteúdo">
        <button type="button" class="module-view-button ${moduleUi.view === 'grid' ? 'is-active' : ''}" data-module-view="grid" aria-pressed="${String(moduleUi.view === 'grid')}">
          <i data-lucide="layout-grid"></i>
          <span class="visually-hidden">Visualização em grade</span>
        </button>
        <button type="button" class="module-view-button ${moduleUi.view === 'list' ? 'is-active' : ''}" data-module-view="list" aria-pressed="${String(moduleUi.view === 'list')}">
          <i data-lucide="list"></i>
          <span class="visually-hidden">Visualização em lista</span>
        </button>
      </div>

      <label class="module-search-shell" aria-label="Pesquisar itens do módulo">
        <i data-lucide="search"></i>
        <input type="search" value="${sanitizeAttribute(moduleUi.query)}" placeholder="${sanitizeAttribute(searchPlaceholder)}" data-module-search autocomplete="off" />
      </label>

      <span class="module-results-count">${filteredCount}/${totalCount}</span>
    </div>
  `;
}

function getModuleSearchEmptyMarkup() {
  return `
    <div class="empty-state is-compact is-search-empty">
      <span class="empty-state-icon" aria-hidden="true">
        <i data-lucide="search-x"></i>
      </span>
      <div>
        <h3 class="card-title">Nenhum item encontrado</h3>
        <p class="card-description">Ajuste a pesquisa ou altere a ordenação para localizar o conteúdo desejado.</p>
      </div>
    </div>
  `;
}

function getSkeletonCardMarkup(index) {
  return `
    <article class="module-item-card is-skeleton" data-skeleton-index="${index}">
      <div class="skeleton-line skeleton-line-thumb"></div>
      <div class="skeleton-line skeleton-line-title"></div>
      <div class="skeleton-line skeleton-line-meta"></div>
      <div class="skeleton-actions">
        <div class="skeleton-line skeleton-line-action"></div>
        <div class="skeleton-line skeleton-line-action"></div>
      </div>
    </article>
  `;
}

function isInternalModule(sectorId, moduleId) {
  if (isDhoSector(sectorId)) {
    return true;
  }

  return moduleId === 'avaliacao' || moduleId === 'feedback';
}

function requiresActiveUsers(moduleId) {
  return moduleId === 'avaliacao' || moduleId === 'feedback';
}

async function handleModuleSelection(rootElement, sector, moduleId, authenticatedUser, options = {}) {
  const { forceRefresh = false } = options;
  const currentState = getModuleState(sector.id);

  if (!forceRefresh && currentState.selectedModuleId === moduleId && currentState.status === 'success') {
    return;
  }

  setModuleState(sector.id, {
    selectedModuleId: moduleId,
    status: 'loading',
    moduleData: null,
    errorMessage: '',
    ui: { ...MODULE_UI_DEFAULTS },
  });
  renderModuleStage(rootElement, sector);

  if (requiresActiveUsers(moduleId)) {
    const defaultUi = moduleId === 'avaliacao'
      ? { ...MODULE_UI_DEFAULTS, ...EVALUATION_UI_DEFAULTS }
      : { ...MODULE_UI_DEFAULTS, ...FEEDBACK_UI_DEFAULTS };

    try {
      const usersResponse = await loadActiveUsers({ forceRefresh });

      if (!usersResponse.success) {
        setModuleState(sector.id, {
          selectedModuleId: moduleId,
          status: 'error',
          moduleData: null,
          errorMessage: usersResponse.message || 'Não foi possível carregar os usuários ativos.',
          ui: defaultUi,
        });
        renderModuleStage(rootElement, sector);
        return;
      }

      setModuleState(sector.id, {
        selectedModuleId: moduleId,
        status: 'success',
        moduleData: {
          module: { id: moduleId, source: MODULE_SOURCE_LABELS[moduleId] || 'Build.Connect' },
          respondent: authenticatedUser || null,
          users: Array.isArray(usersResponse.users) ? usersResponse.users : [],
        },
        errorMessage: '',
        ui: defaultUi,
      });
      renderModuleStage(rootElement, sector);
      return;
    } catch (error) {
      setModuleState(sector.id, {
        selectedModuleId: moduleId,
        status: 'error',
        moduleData: null,
        errorMessage: error?.message || 'Não foi possível carregar os usuários ativos.',
        ui: defaultUi,
      });
      renderModuleStage(rootElement, sector);
      return;
    }
  }

  if (isInternalModule(sector.id, moduleId)) {
    setModuleState(sector.id, {
      selectedModuleId: moduleId,
      status: 'success',
      moduleData: {
        module: { id: moduleId, source: MODULE_SOURCE_LABELS[moduleId] || 'Build.Connect' },
        items: [],
      },
      errorMessage: '',
      ui: { ...MODULE_UI_DEFAULTS },
    });
    renderModuleStage(rootElement, sector);
    return;
  }

  const requestToken = `${sector.id}:${moduleId}:${Date.now()}`;
  MODULE_REQUEST_TOKENS.set(sector.id, requestToken);

  try {
    const response = await loadModuleContent({ sectorId: sector.id, moduleId, forceRefresh });

    if (MODULE_REQUEST_TOKENS.get(sector.id) !== requestToken) {
      return;
    }

    if (response.success) {
      setModuleState(sector.id, {
        selectedModuleId: moduleId,
        status: 'success',
        moduleData: response,
        errorMessage: '',
        ui: currentState.selectedModuleId === moduleId ? currentState.ui || { ...MODULE_UI_DEFAULTS } : { ...MODULE_UI_DEFAULTS },
      });
    } else {
      setModuleState(sector.id, {
        selectedModuleId: moduleId,
        status: 'error',
        moduleData: null,
        errorMessage: response.message,
        ui: currentState.selectedModuleId === moduleId ? currentState.ui || { ...MODULE_UI_DEFAULTS } : { ...MODULE_UI_DEFAULTS },
      });
    }
  } catch (error) {
    if (MODULE_REQUEST_TOKENS.get(sector.id) !== requestToken) {
      return;
    }

    setModuleState(sector.id, {
      selectedModuleId: moduleId,
      status: 'error',
      moduleData: null,
      errorMessage: error?.message || 'Não foi possível carregar o conteúdo deste módulo.',
      ui: currentState.selectedModuleId === moduleId ? currentState.ui || { ...MODULE_UI_DEFAULTS } : { ...MODULE_UI_DEFAULTS },
    });
  }

  renderModuleStage(rootElement, sector);
}

function toggleModuleSort(rootElement, sector) {
  const state = getModuleState(sector.id);

  if (!state.selectedModuleId) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...MODULE_UI_DEFAULTS,
      ...(state.ui || {}),
      sort: state.ui?.sort === 'az' ? 'za' : 'az',
    },
  });

  renderModuleStage(rootElement, sector);
}

function setModuleView(rootElement, sector, view) {
  if (view !== 'grid' && view !== 'list') {
    return;
  }

  const state = getModuleState(sector.id);

  if (!state.selectedModuleId) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...MODULE_UI_DEFAULTS,
      ...(state.ui || {}),
      view,
    },
  });

  renderModuleStage(rootElement, sector);
}

function updateModuleQuery(rootElement, sector, query) {
  const state = getModuleState(sector.id);

  if (!state.selectedModuleId) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...MODULE_UI_DEFAULTS,
      ...(state.ui || {}),
      query,
    },
  });

  renderModuleStage(rootElement, sector);

  const searchInput = rootElement.querySelector('[data-module-search]');

  if (searchInput) {
    const caretPosition = query.length;
    searchInput.focus();
    searchInput.setSelectionRange(caretPosition, caretPosition);
  }
}

function renderModuleStage(rootElement, sector) {
  const cards = rootElement.querySelectorAll('[data-module-card]');
  const stageElement = rootElement.querySelector('[data-module-stage]');
  const stageState = getModuleState(sector.id);

  cards.forEach((cardElement) => {
    const isSelected = cardElement.dataset.moduleId === stageState.selectedModuleId;
    cardElement.classList.toggle('is-selected', isSelected);
    cardElement.setAttribute('aria-pressed', String(isSelected));
  });

  if (!stageElement) {
    return;
  }

  stageElement.innerHTML = getModuleStageMarkup(sector, stageState);
  stageElement.classList.remove('is-module-stage-visible');

  refreshLucideIcons(stageElement);

  requestAnimationFrame(() => {
    stageElement.classList.add('is-module-stage-visible');
  });
}

function getModuleState(sectorId) {
  return MODULE_STATE_BY_SECTOR.get(sectorId) || {
    selectedModuleId: '',
    status: 'idle',
    moduleData: null,
    errorMessage: '',
    ui: { ...MODULE_UI_DEFAULTS },
  };
}

function setModuleState(sectorId, state) {
  MODULE_STATE_BY_SECTOR.set(sectorId, state);
}

function prepareModuleItems(items, moduleUi, itemType) {
  const query = String(moduleUi?.query || '').trim().toLowerCase();
  const prepared = [...items]
    .filter((item) => {
      if (!query) {
        return true;
      }

      const haystack = itemType === 'video'
        ? `${item.title || ''} ${item.durationLabel || ''}`
        : `${item.name || ''} ${item.extension || ''} ${item.sizeLabel || ''}`;

      return haystack.toLowerCase().includes(query);
    })
    .sort((itemA, itemB) => {
      const valueA = String(itemType === 'video' ? itemA.title || '' : itemA.name || '').toLocaleLowerCase('pt-BR');
      const valueB = String(itemType === 'video' ? itemB.title || '' : itemB.name || '').toLocaleLowerCase('pt-BR');
      return moduleUi?.sort === 'za' ? valueB.localeCompare(valueA, 'pt-BR') : valueA.localeCompare(valueB, 'pt-BR');
    });

  return prepared;
}


function getEvaluationModuleMarkup(card, moduleData, moduleUi) {
  const users = Array.isArray(moduleData?.users) ? moduleData.users : [];
  const respondent = moduleData?.respondent || null;
  const evaluationUi = getEvaluationUiState(moduleUi);
  const filteredUsers = getFilteredEvaluationUsers(users, evaluationUi.evaluateeQuery, evaluationUi.selectedEvaluateeId);
  const selectedUser = users.find((user) => user.id === evaluationUi.selectedEvaluateeId) || null;
  const totals = getEvaluationTotals(evaluationUi.evaluationScores);

  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header module-shell-header--stacked">
        <div>
          <p class="module-eyebrow">Avaliação</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Antes de responder o questionário, confirme quem está preenchendo a avaliação e selecione o colaborador ativo que será avaliado.</p>
        </div>
      </div>

      <div class="evaluation-meta-grid">
        <div class="evaluation-meta-card">
          <span class="evaluation-meta-label">Respondente</span>
          <strong class="evaluation-meta-value">${sanitizeText(respondent?.id || 'Não identificado')}</strong>
          <span class="evaluation-meta-subvalue">${sanitizeText(respondent?.nome || 'Faça login novamente para identificar o usuário.')}</span>
        </div>

        <div class="evaluation-picker-block">
          <span class="evaluation-meta-label">Colaborador avaliado</span>
          <div class="evaluation-picker" data-evaluation-picker>
            <label class="module-search-shell evaluation-search-shell" aria-label="Pesquisar colaborador ativo">
              <i data-lucide="search"></i>
              <input
                type="search"
                value="${sanitizeAttribute(evaluationUi.evaluateeQuery)}"
                placeholder="Pesquise por ID ou nome do colaborador"
                data-evaluatee-search
                autocomplete="off"
              />
            </label>
            <button type="button" class="module-control-button" data-evaluatee-toggle aria-label="Abrir lista de colaboradores ativos" aria-expanded="${String(evaluationUi.isEvaluateeListOpen)}">
              <i data-lucide="chevrons-up-down"></i>
            </button>
            ${evaluationUi.isEvaluateeListOpen ? getEvaluationUsersDropdownMarkup(filteredUsers) : ''}
          </div>
          <span class="evaluation-picker-feedback">${selectedUser ? `Avaliação direcionada para ${sanitizeText(selectedUser.nome)}.` : 'Selecione um colaborador ativo para liberar o questionário.'}</span>
        </div>
      </div>

      ${selectedUser ? `
        <div class="evaluation-table-wrap">
          <table class="evaluation-table">
            <thead>
              <tr>
                <th>Critérios de avaliação</th>
                ${EVALUATION_PERIODS.map((period) => `<th>${period.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${EVALUATION_CRITERIA.map((criterion, index) => getEvaluationCriterionRowMarkup(criterion, index, evaluationUi.evaluationScores)).join('')}
              <tr>
                <th>Total</th>
                ${EVALUATION_PERIODS.map((period) => `<td class="evaluation-total-cell">${totals[period.id] || 0}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <label class="form-field evaluation-notes-field">
          <span class="form-label">Observações</span>
          <textarea class="evaluation-notes-textarea" rows="4" data-evaluation-notes placeholder="Registre observações importantes sobre a avaliação.">${sanitizeText(evaluationUi.evaluationNotes)}</textarea>
        </label>
      ` : `
        <div class="empty-state is-compact">
          <span class="empty-state-icon" aria-hidden="true">
            <i data-lucide="users"></i>
          </span>
          <div>
            <h3 class="card-title">Selecione o colaborador avaliado</h3>
            <p class="card-description">O questionário é liberado depois que você escolher um usuário ativo na busca acima.</p>
          </div>
        </div>
      `}
    </div>
  `;
}

function getEvaluationUsersDropdownMarkup(users) {
  if (!users.length) {
    return `
      <div class="evaluation-users-dropdown">
        <div class="evaluation-users-empty">Nenhum usuário ativo encontrado para esta pesquisa.</div>
      </div>
    `;
  }

  return `
    <div class="evaluation-users-dropdown">
      ${users.map((user) => `
        <button type="button" class="evaluation-user-option" data-evaluatee-option data-user-id="${sanitizeAttribute(user.id)}">
          <span class="evaluation-user-option-id">${sanitizeText(user.id)}</span>
          <span class="evaluation-user-option-name">${sanitizeText(user.nome)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function getEvaluationCriterionRowMarkup(criterion, index, scores) {
  return `
    <tr>
      <th>
        <span class="evaluation-criterion-index">${String(index + 1).padStart(2, '0')}.</span>
        <strong>${sanitizeText(criterion.title)}</strong>
        <span class="evaluation-criterion-description">${sanitizeText(criterion.description)}</span>
      </th>
      ${EVALUATION_PERIODS.map((period) => `
        <td>
          <div class="evaluation-score-group" role="radiogroup" aria-label="${sanitizeAttribute(criterion.title)} em ${period.label}">
            ${[1, 2, 3, 4, 5].map((score) => {
              const scoreKey = getEvaluationScoreKey(criterion.id, period.id);
              const isChecked = String(scores[scoreKey] || '') === String(score);
              return `
                <label class="evaluation-score-option">
                  <input
                    type="radio"
                    name="evaluation-${sanitizeAttribute(criterion.id)}-${sanitizeAttribute(period.id)}"
                    value="${score}"
                    data-evaluation-score
                    data-criterion-id="${sanitizeAttribute(criterion.id)}"
                    data-period="${sanitizeAttribute(period.id)}"
                    ${isChecked ? 'checked' : ''}
                  />
                  <span>${score}</span>
                </label>
              `;
            }).join('')}
          </div>
        </td>
      `).join('')}
    </tr>
  `;
}

function getEvaluationUiState(moduleUi) {
  return {
    ...MODULE_UI_DEFAULTS,
    ...EVALUATION_UI_DEFAULTS,
    ...(moduleUi || {}),
    evaluationScores: { ...(moduleUi?.evaluationScores || {}) },
  };
}

function getFilteredEvaluationUsers(users, query, selectedEvaluateeId) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');

  if (!normalizedQuery) {
    return users;
  }

  return users.filter((user) => {
    const haystack = `${user.id || ''} ${user.nome || ''}`.toLocaleLowerCase('pt-BR');
    if (user.id === selectedEvaluateeId) {
      return true;
    }
    return haystack.includes(normalizedQuery);
  });
}

function getEvaluationTotals(scores) {
  return EVALUATION_PERIODS.reduce((accumulator, period) => {
    accumulator[period.id] = EVALUATION_CRITERIA.reduce((total, criterion) => {
      const value = Number(scores[getEvaluationScoreKey(criterion.id, period.id)] || 0);
      return total + value;
    }, 0);
    return accumulator;
  }, {});
}

function getEvaluationScoreKey(criterionId, periodId) {
  return `${criterionId}:${periodId}`;
}

function toggleEvaluationDropdown(rootElement, sector) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao') {
    return;
  }

  const nextUi = getEvaluationUiState(state.ui);
  nextUi.isEvaluateeListOpen = !nextUi.isEvaluateeListOpen;

  setModuleState(sector.id, {
    ...state,
    ui: nextUi,
  });

  renderModuleStage(rootElement, sector);
}

function closeEvaluationDropdown(rootElement, sector) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao' || !state.ui?.isEvaluateeListOpen) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getEvaluationUiState(state.ui),
      isEvaluateeListOpen: false,
    },
  });

  renderModuleStage(rootElement, sector);
}

function updateEvaluationSearch(rootElement, sector, query) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao') {
    return;
  }

  const currentUi = getEvaluationUiState(state.ui);
  const selectedUser = (state.moduleData?.users || []).find((user) => user.id === currentUi.selectedEvaluateeId) || null;
  const shouldKeepSelection = selectedUser && `${selectedUser.id} — ${selectedUser.nome}` === query;

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...currentUi,
      evaluateeQuery: query,
      selectedEvaluateeId: shouldKeepSelection ? currentUi.selectedEvaluateeId : '',
      isEvaluateeListOpen: true,
    },
  });

  renderModuleStage(rootElement, sector);

  const input = rootElement.querySelector('[data-evaluatee-search]');

  if (input) {
    const caret = query.length;
    input.focus();
    input.setSelectionRange(caret, caret);
  }
}

function selectEvaluationUser(rootElement, sector, userId) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao') {
    return;
  }

  const user = (state.moduleData?.users || []).find((item) => item.id === userId);

  if (!user) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getEvaluationUiState(state.ui),
      selectedEvaluateeId: user.id,
      evaluateeQuery: `${user.id} — ${user.nome}`,
      isEvaluateeListOpen: false,
    },
  });

  renderModuleStage(rootElement, sector);
}

function updateEvaluationScore(rootElement, sector, criterionId, periodId, value) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao' || !criterionId || !periodId) {
    return;
  }

  const nextUi = getEvaluationUiState(state.ui);
  nextUi.evaluationScores[getEvaluationScoreKey(criterionId, periodId)] = String(value || '');

  setModuleState(sector.id, {
    ...state,
    ui: nextUi,
  });

  renderModuleStage(rootElement, sector);
}

function updateEvaluationNotes(rootElement, sector, notes) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'avaliacao') {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getEvaluationUiState(state.ui),
      evaluationNotes: notes,
    },
  });
}


function getFeedbackModuleMarkup(card, moduleData, moduleUi) {
  const users = Array.isArray(moduleData?.users) ? moduleData.users : [];
  const respondent = moduleData?.respondent || null;
  const feedbackUi = getFeedbackUiState(moduleUi);
  const filteredUsers = getFilteredFeedbackUsers(users, feedbackUi.targetUserQuery, feedbackUi.selectedTargetUserId);
  const selectedUser = users.find((user) => user.id === feedbackUi.selectedTargetUserId) || null;
  const isReadyToWrite = Boolean(selectedUser);

  return `
    <div class="module-shell" data-module-shell>
      <div class="module-shell-header module-shell-header--stacked">
        <div>
          <p class="module-eyebrow">Feedback</p>
          <h2 class="module-title">${card.title}</h2>
          <p class="module-description">Antes de registrar o feedback, confirme quem está preenchendo e selecione o colaborador relacionado.</p>
        </div>
      </div>

      <div class="evaluation-meta-grid">
        <div class="evaluation-meta-card">
          <span class="evaluation-meta-label">Respondente</span>
          <strong class="evaluation-meta-value">${sanitizeText(respondent?.id || 'Não identificado')}</strong>
          <span class="evaluation-meta-subvalue">${sanitizeText(respondent?.nome || 'Faça login novamente para identificar o usuário.')}</span>
        </div>

        <div class="evaluation-picker-block">
          <span class="evaluation-meta-label">Colaborador relacionado</span>
          <div class="evaluation-picker" data-feedback-picker>
            <label class="module-search-shell evaluation-search-shell" aria-label="Pesquisar colaborador ativo para o feedback">
              <i data-lucide="search"></i>
              <input
                type="search"
                value="${sanitizeAttribute(feedbackUi.targetUserQuery)}"
                placeholder="Pesquise por ID ou nome do colaborador"
                data-feedback-target-search
                autocomplete="off"
              />
            </label>
            <button type="button" class="module-control-button" data-feedback-target-toggle aria-label="Abrir lista de colaboradores ativos" aria-expanded="${String(feedbackUi.isTargetUserListOpen)}">
              <i data-lucide="chevrons-up-down"></i>
            </button>
            ${feedbackUi.isTargetUserListOpen ? getFeedbackUsersDropdownMarkup(filteredUsers) : ''}
          </div>
          <span class="evaluation-picker-feedback">${selectedUser ? `Feedback vinculado a ${sanitizeText(selectedUser.nome)}.` : 'Selecione um colaborador ativo para continuar.'}</span>
        </div>
      </div>

      ${isReadyToWrite ? `
        <label class="form-field evaluation-notes-field">
          <span class="form-label">Feedback</span>
          <textarea class="evaluation-notes-textarea" rows="5" data-feedback-message placeholder="Escreva aqui o feedback com os detalhes necessários.">${sanitizeText(feedbackUi.feedbackMessage)}</textarea>
        </label>
      ` : `
        <div class="empty-state is-compact feedback-empty-state">
          <span class="empty-state-icon" aria-hidden="true">
            <i data-lucide="messages-square"></i>
          </span>
          <div>
            <h3 class="card-title">Selecione o colaborador relacionado</h3>
            <p class="card-description">Escolha um usuário ativo na busca acima para liberar o campo de escrita do feedback.</p>
          </div>
        </div>
      `}
    </div>
  `;
}

function getFeedbackUsersDropdownMarkup(users) {
  if (!users.length) {
    return `
      <div class="evaluation-users-dropdown">
        <div class="evaluation-users-empty">Nenhum usuário ativo encontrado para esta pesquisa.</div>
      </div>
    `;
  }

  return `
    <div class="evaluation-users-dropdown">
      ${users.map((user) => `
        <button type="button" class="evaluation-user-option" data-feedback-target-option data-user-id="${sanitizeAttribute(user.id)}">
          <span class="evaluation-user-option-id">${sanitizeText(user.id)}</span>
          <span class="evaluation-user-option-name">${sanitizeText(user.nome)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function getFeedbackUiState(moduleUi) {
  return {
    ...MODULE_UI_DEFAULTS,
    ...FEEDBACK_UI_DEFAULTS,
    ...(moduleUi || {}),
  };
}

function getFilteredFeedbackUsers(users, query, selectedTargetUserId) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');

  if (!normalizedQuery) {
    return users;
  }

  return users.filter((user) => {
    const haystack = `${user.id || ''} ${user.nome || ''}`.toLocaleLowerCase('pt-BR');
    if (user.id === selectedTargetUserId) {
      return true;
    }
    return haystack.includes(normalizedQuery);
  });
}

function toggleFeedbackDropdown(rootElement, sector) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'feedback') {
    return;
  }

  const nextUi = getFeedbackUiState(state.ui);
  nextUi.isTargetUserListOpen = !nextUi.isTargetUserListOpen;

  setModuleState(sector.id, {
    ...state,
    ui: nextUi,
  });

  renderModuleStage(rootElement, sector);
}

function closeFeedbackDropdown(rootElement, sector) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'feedback' || !state.ui?.isTargetUserListOpen) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getFeedbackUiState(state.ui),
      isTargetUserListOpen: false,
    },
  });

  renderModuleStage(rootElement, sector);
}

function updateFeedbackSearch(rootElement, sector, query) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'feedback') {
    return;
  }

  const currentUi = getFeedbackUiState(state.ui);
  const selectedUser = (state.moduleData?.users || []).find((user) => user.id === currentUi.selectedTargetUserId) || null;
  const shouldKeepSelection = selectedUser && `${selectedUser.id} — ${selectedUser.nome}` === query;

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...currentUi,
      targetUserQuery: query,
      selectedTargetUserId: shouldKeepSelection ? currentUi.selectedTargetUserId : '',
      isTargetUserListOpen: true,
    },
  });

  renderModuleStage(rootElement, sector);
}

function selectFeedbackUser(rootElement, sector, userId) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'feedback') {
    return;
  }

  const selectedUser = (state.moduleData?.users || []).find((user) => user.id === userId);

  if (!selectedUser) {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getFeedbackUiState(state.ui),
      selectedTargetUserId: selectedUser.id,
      targetUserQuery: `${selectedUser.id} — ${selectedUser.nome}`,
      isTargetUserListOpen: false,
    },
  });

  renderModuleStage(rootElement, sector);
}

function updateFeedbackField(rootElement, sector, field, value) {
  const state = getModuleState(sector.id);

  if (state.selectedModuleId !== 'feedback') {
    return;
  }

  setModuleState(sector.id, {
    ...state,
    ui: {
      ...getFeedbackUiState(state.ui),
      [field]: value,
    },
  });

  renderModuleStage(rootElement, sector);
}

function openVideoModal(video) {
  if (!video.embedUrl) {
    return;
  }

  openOverlayModal({
    title: video.title,
    frameUrl: `${video.embedUrl}?autoplay=1&rel=0`,
    closeLabel: 'Fechar vídeo',
    modalClassName: 'video-modal',
    frameWrapClassName: 'video-modal-frame-wrap',
    frameClassName: 'video-modal-frame',
  });
}

function openDocumentModal(documentItem) {
  if (!documentItem.previewUrl) {
    return;
  }

  openOverlayModal({
    title: resolveDocumentTitle(documentItem),
    frameUrl: documentItem.previewUrl,
    closeLabel: 'Fechar documento',
    modalClassName: 'video-modal document-modal',
    frameWrapClassName: 'video-modal-frame-wrap document-modal-frame-wrap',
    frameClassName: 'video-modal-frame document-modal-frame',
  });
}

function openOverlayModal({ title, frameUrl, closeLabel, modalClassName, frameWrapClassName, frameClassName }) {
  closeActiveOverlayModal();

  const overlay = document.createElement('div');
  overlay.className = 'video-modal-backdrop';
  overlay.innerHTML = `
    <div class="${sanitizeAttribute(modalClassName)}" role="dialog" aria-modal="true" aria-label="${sanitizeText(title)}">
      <div class="video-modal-head">
        <strong class="video-modal-title">${sanitizeText(title)}</strong>
        <button type="button" class="video-modal-close" aria-label="${sanitizeAttribute(closeLabel)}">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="${sanitizeAttribute(frameWrapClassName)}">
        <iframe
          class="${sanitizeAttribute(frameClassName)}"
          src="${sanitizeAttribute(frameUrl)}"
          title="${sanitizeAttribute(title)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;

  const closeButton = overlay.querySelector('.video-modal-close');
  const dialog = overlay.querySelector('[role="dialog"]');

  function handleBackdropClick(event) {
    if (!dialog.contains(event.target)) {
      closeActiveOverlayModal();
    }
  }

  activeEscapeHandler = (event) => {
    if (event.key === 'Escape') {
      closeActiveOverlayModal();
    }
  };

  closeButton?.addEventListener('click', closeActiveOverlayModal);
  overlay.addEventListener('click', handleBackdropClick);
  document.addEventListener('keydown', activeEscapeHandler);
  document.body.appendChild(overlay);
  document.body.classList.add('has-video-modal');
  refreshLucideIcons(overlay);
  activeOverlayModal = overlay;
}

function closeActiveOverlayModal() {
  if (activeEscapeHandler) {
    document.removeEventListener('keydown', activeEscapeHandler);
    activeEscapeHandler = null;
  }

  if (!activeOverlayModal) {
    document.body.classList.remove('has-video-modal');
    return;
  }

  activeOverlayModal.remove();
  activeOverlayModal = null;
  document.body.classList.remove('has-video-modal');
}

function resolveDocumentTitle(item) {
  const documentName = String(item?.name || item?.title || item?.fileName || '').trim();
  return documentName || 'Arquivo sem nome';
}

function resolveDocumentPreviewUrl(item) {
  const directPreviewUrl = String(item?.previewUrl || '').trim();

  if (directPreviewUrl) {
    return directPreviewUrl;
  }

  const openUrl = String(item?.openUrl || '').trim();

  if (!openUrl) {
    return '';
  }

  const driveFileMatch = openUrl.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  const docMatch = openUrl.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/]+)/i);
  if (docMatch) {
    return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
  }

  return openUrl;
}

function activateViewTransition(rootElement) {
  const panel = rootElement.querySelector('[data-view-panel]');

  if (!panel) {
    return;
  }

  if (prefersReducedMotion()) {
    panel.classList.add('is-view-active');
    return;
  }

  panel.classList.add('is-view-entering');

  requestAnimationFrame(() => {
    panel.classList.add('is-view-active');
    panel.classList.remove('is-view-entering');
  });
}

function activateRevealAnimations(rootElement) {
  const revealItems = [...rootElement.querySelectorAll('[data-reveal]')];

  revealItems.forEach((item, index) => {
    item.style.setProperty('--reveal-index', String(index));
  });

  if (!revealItems.length) {
    return;
  }

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-visible');
        revealObserver?.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: '0px 0px -10% 0px',
    },
  );

  revealItems.forEach((item) => revealObserver?.observe(item));
}

function disconnectRevealObserver() {
  if (!revealObserver) {
    return;
  }

  revealObserver.disconnect();
  revealObserver = null;
}

function formatDateLabel(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeAttribute(value) {
  return sanitizeText(value);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
