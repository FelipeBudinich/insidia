export const PAGE_DEFINITIONS = Object.freeze({
  'page-01': Object.freeze({
    id: 'page-01',
    route: '/calendario.html',
    descriptionTemplateKey: 'document.page-01Description'
  }),
  'page-02': Object.freeze({
    id: 'page-02',
    route: '/destino.html',
    descriptionTemplateKey: 'document.page-02Description'
  }),
  'page-03': Object.freeze({
    id: 'page-03',
    route: '/tempore.html',
    descriptionTemplateKey: 'document.page-03Description'
  })
});

export const PAGE_IDS = Object.freeze(Object.keys(PAGE_DEFINITIONS));

export function getPageDefinition(pageId) {
  const definition = PAGE_DEFINITIONS[pageId];
  if (!definition) throw new Error(`Unknown page ID: ${pageId}`);
  return definition;
}
