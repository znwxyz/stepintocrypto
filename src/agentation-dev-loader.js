const isLocalDevHost = (() => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
})();

if (import.meta.env?.DEV && isLocalDevHost) {
  try {
    const [{ createRoot }, { createElement }, { Agentation }] = await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('agentation'),
    ]);

    if (!document.getElementById('__agentation__')) {
      const el = document.createElement('div');
      el.id = '__agentation__';
      document.body.appendChild(el);
      createRoot(el).render(createElement(Agentation));
      console.info('[Agentation] mounted (loader)');
    }
  } catch (error) {
    console.error('[Agentation] failed to mount (loader)', error);
  }
}
