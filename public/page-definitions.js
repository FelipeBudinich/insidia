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
    route: '/identitate.html',
    descriptionTemplateKey: 'document.page-04Description'
  }),
  'page-05': Object.freeze({
    id: 'page-05',
    route: '/inventario.html',
    descriptionTemplateKey: 'document.page-05Description'
  }),
  'page-06': Object.freeze({
    id: 'page-06',
    route: '/subordinatos.html',
    descriptionTemplateKey: 'document.page-06Description'
  }),
  'page-07': Object.freeze({
    id: 'page-07',
    route: '/locus.html',
    descriptionTemplateKey: 'document.page-07Description'
  }),
  'page-08': Object.freeze({
    id: 'page-08',
    route: '/rutas.html',
    descriptionTemplateKey: 'document.page-08Description'
  }),
  'page-09': Object.freeze({
    id: 'page-09',
    route: '/explorar.html',
    descriptionTemplateKey: 'document.page-09Description'
  }),
  'page-10': Object.freeze({
    id: 'page-10',
    route: '/observationes.html',
    descriptionTemplateKey: 'document.page-10Description'
  }),
  'page-11': Object.freeze({
    id: 'page-11',
    route: '/decisiones.html',
    descriptionTemplateKey: 'document.page-11Description'
  })
});

export const PAGE_IDS = Object.freeze(Object.keys(PAGE_DEFINITIONS));

export const NAVIGATION_GROUP_IDS = Object.freeze([
  'navigation-group-01',
  'navigation-group-02',
  'navigation-group-03'
]);

export const PAGE_SECTION_IDS = Object.freeze([
  'page-section-01',
  'page-section-02',
  'page-section-03',
  'page-section-04',
  'page-section-09',
  'page-section-11',
  'page-section-12',
  'page-section-13'
]);

export function getPageDefinition(pageId) {
  const definition = PAGE_DEFINITIONS[pageId];
  if (!definition) throw new Error(`Unknown page ID: ${pageId}`);
  return definition;
}
