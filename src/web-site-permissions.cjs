'use strict';
// Permissões por site das abas de Link (estilo "Configurações do site" do Chrome).
// Estado salvo em settings.webSitePermissions[origem][permissão] = 'allow' | 'block'; ausente = perguntar.
const { originOf } = require('./web-notifications.cjs');

// Permissões que o painel mostra e que podem ser perguntadas na hora.
const LABELS = {
  camera: 'Câmera', microphone: 'Microfone', geolocation: 'Localização', notifications: 'Notificações',
  'clipboard-read': 'Ler a área de transferência', 'display-capture': 'Compartilhar a tela',
  midi: 'Dispositivos MIDI', 'idle-detection': 'Detectar inatividade', 'window-management': 'Gerenciar janelas',
  popups: 'Popups e redirecionamentos'
};
// Sempre liberadas (inofensivas): tela cheia e copiar para a área de transferência.
const ALWAYS = ['fullscreen', 'clipboard-sanitized-write'];
const VALUES = ['allow', 'block'];

// Nome Electron do pedido -> chaves do painel. "media" vira câmera e/ou microfone conforme o pedido.
function keysFor(permission, details) {
  if (permission === 'media') {
    const types = Array.isArray(details?.mediaTypes) ? details.mediaTypes : [];
    const keys = [types.includes('video') && 'camera', types.includes('audio') && 'microphone'].filter(Boolean);
    return keys.length ? keys : ['camera', 'microphone'];
  }
  if (permission === 'midiSysex') return ['midi'];
  return Object.hasOwn(LABELS, permission) ? [permission] : null;
}

function rules(settings, origin) {
  const entry = settings?.webSitePermissions?.[origin];
  return entry && typeof entry === 'object' ? entry : {};
}

// 'allow' | 'block' | 'ask'
function stateOf(settings, origin, key) {
  if (!originOf(origin)) return 'block';
  if (key === 'notifications') {
    const saved = settings?.webNotificationPermissions?.[origin];
    return typeof saved === 'boolean' ? (saved ? 'allow' : 'block') : 'ask';
  }
  const value = rules(settings, origin)[key];
  return VALUES.includes(value) ? value : 'ask';
}

// value: 'allow' | 'block' | 'ask' (ask apaga a regra)
function setState(settings, origin, key, value) {
  const site = originOf(origin);
  if (!site || !Object.hasOwn(LABELS, key) || ![...VALUES, 'ask'].includes(value)) return false;
  if (key === 'notifications') {
    const map = { ...(settings.webNotificationPermissions || {}) };
    if (value === 'ask') delete map[site]; else map[site] = value === 'allow';
    settings.webNotificationPermissions = map; return true;
  }
  const all = settings.webSitePermissions && typeof settings.webSitePermissions === 'object' ? { ...settings.webSitePermissions } : {};
  const entry = { ...(all[site] || {}) };
  if (value === 'ask') delete entry[key]; else entry[key] = value;
  if (Object.keys(entry).length) {
    const sites = Object.keys(all).filter(s => s !== site);
    if (sites.length >= 200) delete all[sites[0]];
    all[site] = entry;
  } else delete all[site];
  settings.webSitePermissions = all; return true;
}

function resetSite(settings, origin) {
  const site = originOf(origin); if (!site) return false;
  if (settings.webSitePermissions) { const all = { ...settings.webSitePermissions }; delete all[site]; settings.webSitePermissions = all; }
  if (settings.webNotificationPermissions) { const map = { ...settings.webNotificationPermissions }; delete map[site]; settings.webNotificationPermissions = map; }
  return true;
}

function snapshot(settings, origin) {
  return Object.keys(LABELS).map(key => ({ key, label: LABELS[key], state: stateOf(settings, origin, key) }));
}

module.exports = { LABELS, ALWAYS, keysFor, stateOf, setState, resetSite, snapshot };
