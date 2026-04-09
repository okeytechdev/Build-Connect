export const STORAGE_KEYS = {
  activeItem: 'build.connect.active-item',
  sidebarCollapsed: 'build.connect.sidebar-collapsed',
  productionExpanded: 'build.connect.production-expanded',
};

export const DEFAULT_SECTOR_CARDS = [
  {
    id: 'documentos',
    title: 'Documentos',
    icon: 'folder-open',
    hint: 'Leitura inicial',
    getDescription: (sectorName) =>
      `Comece por aqui para conhecer os arquivos, regras e registros mais importantes do setor ${sectorName}.`,
  },
  {
    id: 'instrucoes-escritas',
    title: 'Instruções Escritas',
    icon: 'file-text',
    hint: 'Passo a passo',
    getDescription: (sectorName) =>
      `Aqui você encontra orientações claras para entender como as rotinas do setor ${sectorName} funcionam no dia a dia.`,
  },
  {
    id: 'instrucoes-video',
    title: 'Instruções em Vídeo',
    icon: 'video',
    hint: 'Treinamento visual',
    getDescription: (sectorName) =>
      `Assista aos conteúdos em vídeo do setor ${sectorName} para aprender as atividades de forma prática e rápida.`,
  },
  {
    id: 'avaliacao',
    title: 'Avaliação',
    icon: 'clipboard-list',
    hint: 'Acompanhamento',
    getDescription: (sectorName) =>
      `Nesta área ficam os registros de acompanhamento para apoiar seu desenvolvimento no setor ${sectorName}.`,
  },
  {
    id: 'feedback',
    title: 'Feedback',
    icon: 'message-square',
    hint: 'Canal de retorno',
    getDescription: (sectorName) =>
      `Use este espaço para compartilhar dúvidas, sugestões e melhorias relacionadas ao setor ${sectorName}.`,
  },
];

export const DHO_SECTOR_CARDS = [
  {
    id: 'cadastro-usuarios',
    title: 'Cadastro de Usuários',
    icon: 'user-plus',
    hint: 'Acesso inicial',
    getDescription: () =>
      'Cadastre novos utilizadores, organize acessos e mantenha a base de perfis atualizada para uso no Build.Connect.',
  },
  {
    id: 'historico-colaborador',
    title: 'Histórico do Colaborador',
    icon: 'folder-clock',
    hint: 'Acompanhamento',
    getDescription: () =>
      'Consulte o percurso do colaborador, com registros importantes para acompanhar evolução, mudanças e ocorrências.',
  },
  {
    id: 'questionarios',
    title: 'Questionários',
    icon: 'clipboard-check',
    hint: 'Coleta guiada',
    getDescription: () =>
      'Acesse formulários e questionários usados para recolher informações, apoiar avaliações e orientar etapas do processo.',
  },
  {
    id: 'resultado-treinamento',
    title: 'Resultado do Treinamento',
    icon: 'graduation-cap',
    hint: 'Desempenho',
    getDescription: () =>
      'Veja os resultados dos treinamentos e acompanhe o desempenho do colaborador nas etapas concluídas.',
  },
  {
    id: 'qualidade',
    title: 'Qualidade',
    icon: 'badge-check',
    hint: 'Padrão interno',
    getDescription: () =>
      'Reúna verificações, critérios e registros ligados à qualidade para apoiar decisões e manter o padrão esperado.',
  },
];



const PRODUCTION_CHILD_IDS = ['criacao', 'pcp', 'almoxarifado', 'corte', 'acabamento'];

function normalizeSectorAccessKey(value) {
  const normalizedValue = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  if (!normalizedValue) {
    return 'all';
  }

  if (normalizedValue === 'all' || normalizedValue === 'todos') {
    return 'all';
  }

  return normalizedValue;
}

function isProductionChildAccess(accessKey) {
  return PRODUCTION_CHILD_IDS.includes(accessKey);
}

export const NAVIGATION_ITEMS = [
  {
    id: 'inicio',
    label: 'Início',
    icon: 'house',
    description: 'Volte para a visão principal do Build.Connect e retome sua navegação pelos setores.',
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: 'tag',
    description: 'Entenda como o setor Comercial organiza atendimentos, materiais de apoio e rotinas de relacionamento com clientes.',
  },
  {
    id: 'producao',
    label: 'Produção',
    icon: 'cog',
    metaLabel: 'Accordion de setores',
    description: 'Acesse os subsetores da Produção e encontre orientações para cada etapa do fluxo operacional.',
    children: [
      {
        id: 'criacao',
        label: 'Criação',
        icon: 'palette',
        description: 'Conheça o setor de Criação e veja onde ficam as referências, padrões visuais e orientações para desenvolver materiais.',
      },
      {
        id: 'pcp',
        label: 'PCP',
        icon: 'clipboard-list',
        description: 'Aqui você acompanha como o PCP organiza o planejamento da produção e direciona o andamento das atividades.',
      },
      {
        id: 'almoxarifado',
        label: 'Almoxarifado',
        icon: 'package',
        description: 'Encontre as instruções do Almoxarifado para entender recebimento, armazenamento e controle dos insumos.',
      },
      {
        id: 'corte',
        label: 'Corte',
        icon: 'scissors',
        description: 'Veja como o setor de Corte prepara materiais e segue os padrões necessários para iniciar a produção com segurança.',
      },
      {
        id: 'acabamento',
        label: 'Acabamento',
        icon: 'wand-sparkles',
        description: 'Aprenda como o Acabamento organiza os processos finais e garante o padrão esperado antes da entrega.',
      },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: 'shopping-cart',
    description: 'Entenda como o setor de Compras solicita, aprova e acompanha aquisições importantes para a operação.',
  },
  {
    id: 'logistica',
    label: 'Logística',
    icon: 'truck',
    description: 'Conheça os fluxos da Logística para recebimento, movimentação, expedição e entrega de materiais.',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: 'wallet',
    description: 'Aqui você encontra o que precisa para entender controles, processos e materiais de apoio do Financeiro.',
  },
  {
    id: 'dho',
    label: 'DHO',
    icon: 'users-round',
    description: 'Acompanhe os processos de desenvolvimento humano e organizacional, com materiais de apoio ao colaborador e à gestão.',
  },
];


export function getNavigationItemsForAccess(sectorAccess) {
  const accessKey = normalizeSectorAccessKey(sectorAccess);
  const homeItem = NAVIGATION_ITEMS.find((item) => item.id === 'inicio');

  if (accessKey === 'all') {
    return NAVIGATION_ITEMS;
  }

  const baseItems = homeItem ? [homeItem] : [];

  if (accessKey === 'producao') {
    const productionItem = NAVIGATION_ITEMS.find((item) => item.id === 'producao');
    return productionItem ? [...baseItems, productionItem] : baseItems;
  }

  if (isProductionChildAccess(accessKey)) {
    const productionItem = NAVIGATION_ITEMS.find((item) => item.id === 'producao');

    if (!productionItem) {
      return baseItems;
    }

    const allowedChild = (productionItem.children || []).find((child) => child.id === accessKey);

    if (!allowedChild) {
      return baseItems;
    }

    return [
      ...baseItems,
      {
        ...productionItem,
        children: [allowedChild],
      },
    ];
  }

  const directItem = NAVIGATION_ITEMS.find((item) => item.id === accessKey);
  return directItem ? [...baseItems, directItem] : baseItems;
}

export function shouldStartProductionExpandedForAccess(sectorAccess) {
  const accessKey = normalizeSectorAccessKey(sectorAccess);
  return accessKey === 'producao' || isProductionChildAccess(accessKey);
}

export function sanitizeActiveItemForNavigation(itemId, navigationItems) {
  if (!itemId || isGroupItem(itemId) || !findItemById(itemId, navigationItems)) {
    return 'inicio';
  }

  return itemId;
}

export function getCardsForSector(itemId) {
  if (isDhoSector(itemId)) {
    return DHO_SECTOR_CARDS;
  }

  return DEFAULT_SECTOR_CARDS;
}

export function getInitialNavigationState() {
  const storedActiveItem = getStoredValue(STORAGE_KEYS.activeItem, 'inicio');
  const activeItemId = sanitizeActiveItem(storedActiveItem);

  return {
    activeItemId,
    isSidebarCollapsed: getStoredBoolean(STORAGE_KEYS.sidebarCollapsed, false),
    isProductionExpanded: getStoredBoolean(STORAGE_KEYS.productionExpanded, false),
  };
}

export function persistNavigationState(state) {
  localStorage.setItem(STORAGE_KEYS.activeItem, state.activeItemId);
  localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(state.isSidebarCollapsed));
  localStorage.setItem(STORAGE_KEYS.productionExpanded, String(state.isProductionExpanded));
}

export function findItemById(itemId, items = NAVIGATION_ITEMS) {
  for (const item of items) {
    if (item.id === itemId) {
      return item;
    }

    if (item.children?.length) {
      const foundChild = item.children.find((child) => child.id === itemId);

      if (foundChild) {
        return {
          ...foundChild,
          parentId: item.id,
          parentLabel: item.label,
        };
      }
    }
  }

  return null;
}

export function isHomeItem(itemId) {
  return itemId === 'inicio';
}

export function isGroupItem(itemId) {
  return itemId === 'producao';
}

export function isDhoSector(itemId) {
  return itemId === 'dho';
}

export function shouldRenderDefaultSectorCards(itemId, items = NAVIGATION_ITEMS) {
  if (!itemId || isHomeItem(itemId) || isGroupItem(itemId)) {
    return false;
  }

  return Boolean(findItemById(itemId, items));
}

export function getSectorBreadcrumb(item) {
  if (!item) {
    return 'Build.Connect';
  }

  if (item.parentLabel) {
    return `${item.parentLabel} > ${item.label}`;
  }

  return item.label;
}

export function getSectorTypeLabel(item) {
  if (item?.parentId === 'producao') {
    return 'Subsetor de Produção';
  }

  return 'Setor final';
}

function sanitizeActiveItem(itemId) {
  if (!itemId || isGroupItem(itemId) || !findItemById(itemId)) {
    return 'inicio';
  }

  return itemId;
}

function getStoredValue(key, fallbackValue) {
  try {
    return localStorage.getItem(key) ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function getStoredBoolean(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallbackValue;
    }

    return value === 'true';
  } catch {
    return fallbackValue;
  }
}
