export function formatTemplate(template, values = {}) {
  if (typeof template !== 'string') throw new TypeError('template must be a string');
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, token) => {
    if (!Object.hasOwn(values, token)) throw new Error(`Missing template value: ${token}`);
    return String(values[token]);
  });
}
