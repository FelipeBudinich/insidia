import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';

export const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIRECTORY = path.join(ROOT_DIRECTORY, 'public');

export function readPublic(relativePath) {
  return readFile(path.join(PUBLIC_DIRECTORY, relativePath), 'utf8');
}

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT_DIRECTORY, relativePath), 'utf8'));
}

export async function createProductionPresentationContext() {
  const nomenclature = validateNomenclature(await readJson('public/config/nomenclature.json'));
  return createPresentationContext({
    nomenclatureResult: { schemaVersion: nomenclature.schemaVersion, nomenclature }
  });
}

export function createFixedPathFetch({
  expectedPath,
  value,
  origin = 'https://example.test',
  ok = true,
  responseUrl,
  jsonError,
  onRequest = () => {},
  onParse = () => {}
}) {
  return async (url, options) => {
    const parsed = new URL(url);
    if (parsed.origin !== origin || parsed.pathname !== expectedPath) {
      throw new Error(`Unexpected configuration URL: ${url}`);
    }
    onRequest({ url, options });
    return {
      ok,
      url: responseUrl ?? `${origin}${expectedPath}`,
      async json() {
        onParse();
        if (jsonError) throw jsonError;
        return structuredClone(value);
      }
    };
  };
}

function dataAttributeNameToProperty(name) {
  return name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

export class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.href = '';
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') this.id = stringValue;
    if (name === 'class') this.className = stringValue;
    if (name.startsWith('data-')) this.dataset[dataAttributeNameToProperty(name)] = stringValue;
    this[name] = stringValue;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[dataAttributeNameToProperty(name)];
    delete this[name];
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
    this.textContent = '';
  }
}

export function createNavigationDocument() {
  const navigation = new FakeElement('nav');
  navigation.dataset.navigation = '';
  return {
    navigation,
    documentRoot: {
      createElement(tagName) {
        return new FakeElement(tagName);
      },
      querySelector(selector) {
        return selector === '[data-navigation]' ? navigation : null;
      }
    }
  };
}

export function createBootstrapDocument() {
  const { documentRoot, navigation } = createNavigationDocument();
  const documentElement = new FakeElement('html');
  const body = new FakeElement('body');
  const metaDescription = new FakeElement('meta');
  documentRoot.documentElement = documentElement;
  documentRoot.body = body;
  documentRoot.title = '';
  const navigationQuery = documentRoot.querySelector.bind(documentRoot);
  documentRoot.querySelector = (selector) => {
    if (selector === 'meta[name="description"]') return metaDescription;
    return navigationQuery(selector);
  };
  documentRoot.querySelectorAll = () => [];
  return { documentRoot, navigation, metaDescription };
}
