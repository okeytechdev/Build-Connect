let hasQueuedLoadListener = false;

export function refreshLucideIcons(rootElement = document) {
  if (!window.lucide?.createIcons) {
    queueIconRefresh(rootElement);
    return;
  }

  window.lucide.createIcons({
    root: rootElement,
    attrs: {
      width: 20,
      height: 20,
      'stroke-width': 2,
    },
  });
}

function queueIconRefresh(rootElement) {
  if (hasQueuedLoadListener) {
    return;
  }

  hasQueuedLoadListener = true;

  window.addEventListener(
    'load',
    () => {
      hasQueuedLoadListener = false;
      refreshLucideIcons(rootElement);
    },
    { once: true },
  );
}
