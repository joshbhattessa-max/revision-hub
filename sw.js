/* The hub's service worker (registered by offline.js from Settings → Offline, for the whole of jbrevision.co.uk).
   All it does is offline mode (offline-sw.js); with that off, every request goes to the network as normal. */
importScripts('/offline-sw.js');
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
