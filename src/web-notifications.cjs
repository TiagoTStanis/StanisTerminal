'use strict';

function originOf(value) {
  try {
    const url = new URL(value);
    const secure = url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    return secure && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

function isGranted(settings, origin) {
  return settings?.webNotifications === true && !!origin && settings.webNotificationPermissions?.[origin] === true;
}

function remember(settings, origin, allowed) {
  const key = originOf(origin);
  if (!key || typeof allowed !== 'boolean') return false;
  const rules = settings.webNotificationPermissions && typeof settings.webNotificationPermissions === 'object'
    ? settings.webNotificationPermissions : {};
  const entries = Object.entries(rules).filter(([saved]) => originOf(saved));
  if (entries.length >= 100 && !Object.hasOwn(rules, key)) entries.shift();
  settings.webNotificationPermissions = Object.fromEntries([...entries.filter(([saved]) => saved !== key), [key, allowed]]);
  return true;
}

module.exports = { originOf, isGranted, remember };
