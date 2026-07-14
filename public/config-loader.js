export async function loadJsonConfiguration({ path, resourceName, fetchFn, baseUrl }) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw new TypeError('Configuration path must be a fixed absolute path');
  }
  if (typeof resourceName !== 'string' || resourceName.trim() === '') {
    throw new TypeError('Configuration resourceName must be a non-empty string');
  }
  if (typeof fetchFn !== 'function') {
    throw new TypeError(`${resourceName} fetchFn must be a function`);
  }

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new TypeError(`${resourceName} base URL must be a valid URL`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(`${resourceName} base URL must use HTTP or HTTPS`);
  }
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    throw new Error(`${resourceName} file must be same-origin`);
  }

  const response = await fetchFn(url.href, {
    cache: 'no-cache',
    redirect: 'error'
  });
  if (!response?.ok) throw new Error(`Unable to load ${resourceName}: ${url.pathname}`);
  if (response.url && new URL(response.url, url).origin !== base.origin) {
    throw new Error(`${resourceName} response must be same-origin`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`Malformed JSON: ${url.pathname}`);
  }
}
