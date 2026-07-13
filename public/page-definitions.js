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
  }),
  'page-04': Object.freeze({
    id: 'page-04',
    route: '/personage.html',
    descriptionTemplateKey: 'document.page-04Description'
  }),
  'page-05': Object.freeze({
    id: 'page-05',
    route: '/pensamentos.html',
    descriptionTemplateKey: 'document.page-05Description'
  }),
  'page-06': Object.freeze({
    id: 'page-06',
    route: '/commandamento.html',
    descriptionTemplateKey: 'document.page-06Description'
  }),
  'page-07': Object.freeze({
    id: 'page-07',
    route: '/mappa.html',
    descriptionTemplateKey: 'document.page-07Description'
  })
});

export const PAGE_IDS = Object.freeze(Object.keys(PAGE_DEFINITIONS));

export const PAGE_SECTION_IDS = Object.freeze([
  'page-section-01',
  'page-section-02',
  'page-section-03',
  'page-section-04',
  'page-section-05',
  'page-section-06',
  'page-section-07',
  'page-section-08',
  'page-section-09',
  'page-section-10',
  'page-section-11',
  'page-section-12'
]);

export function getPageDefinition(pageId) {
  const definition = PAGE_DEFINITIONS[pageId];
  if (!definition) throw new Error(`Unknown page ID: ${pageId}`);
  return definition;
}
