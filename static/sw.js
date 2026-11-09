/*
 * Cyber Place owner web: the service worker (2026-11-09).
 *
 * It does three things and nothing else:
 *   - shows a phone notification when the backend sends a web push
 *     (payload JSON {title, body, url, tag, icon});
 *   - on a tap, brings the app to the front on that notice's screen (or opens it);
 *   - passes page navigations straight to the network, so the browser treats
 *     the site as an installable app.
 *
 * It caches NOTHING. index.html is served `no-cache` and the built files have
 * hashed names, so every deploy reaches the phone on its next load; a cache here
 * would hold an old app back. This file is served `no-cache` too (Caddyfile),
 * so a changed worker is picked up on the next visit.
 *
 * A classic script, not a module: the handlers are plain functions so the tests
 * (tests/serviceWorker.test.ts) run this very file and call them.
 */
"use strict";

var DEFAULT_TITLE = "Cyber Place";
var DEFAULT_ICON = "/icons/icon-192.png";

/** A non-empty string, or null. */
function text(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Where a notice may send the app: a path or URL on THIS origin. Anything else
 * (another site, a malformed value, nothing) is the app's start page: a push
 * is never a way to open a foreign page.
 */
function targetUrl(raw) {
  var origin = self.location.origin;
  try {
    var url = new URL(text(raw) || "/", origin);
    return url.origin === origin ? url.href : origin + "/";
  } catch (e) {
    return origin + "/";
  }
}

/** The push payload, read defensively: a broken one still shows something. */
function readPush(data) {
  var raw = {};
  if (data) {
    try {
      raw = data.json() || {};
    } catch (e) {
      try {
        raw = { body: data.text() };
      } catch (e2) {
        raw = {};
      }
    }
  }
  return {
    title: text(raw.title) || DEFAULT_TITLE,
    body: text(raw.body) || "",
    url: targetUrl(raw.url),
    tag: text(raw.tag),
    icon: text(raw.icon) || DEFAULT_ICON,
  };
}

/** The options `showNotification` gets for a payload. */
function notificationOptions(push) {
  var options = { body: push.body, icon: push.icon, data: { url: push.url } };
  // The same tag replaces the older notice instead of stacking a second one,
  // and still alerts (renotify).
  if (push.tag) {
    options.tag = push.tag;
    options.renotify = true;
  }
  return options;
}

function onPush(event) {
  var push = readPush(event.data);
  event.waitUntil(self.registration.showNotification(push.title, notificationOptions(push)));
}

/**
 * The app already open: bring it to the front and move it to the notice's
 * screen (the app routes with the hash, so that is a same-page navigation).
 * Not open: open it there.
 */
function focusOrOpen(url) {
  var origin = self.location.origin;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var ours = list.filter(function (c) {
      try {
        return new URL(c.url).origin === origin;
      } catch (e) {
        return false;
      }
    });
    var client =
      ours.find(function (c) {
        return c.url === url;
      }) || ours[0];
    if (!client) return self.clients.openWindow(url);
    return client.focus().then(function (focused) {
      var shown = focused || client;
      if (shown.url === url || typeof shown.navigate !== "function") return shown;
      // A window this worker does not control refuses navigate(): it is in
      // front already, which is the important part.
      return shown.navigate(url).catch(function () {
        return shown;
      });
    });
  });
}

function onNotificationClick(event) {
  event.notification.close();
  var data = event.notification.data || {};
  event.waitUntil(focusOrOpen(targetUrl(data.url)));
}

/** Page loads go to the network exactly as without a worker; nothing else is touched. */
function onFetch(event) {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request));
}

self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", onPush);
self.addEventListener("notificationclick", onNotificationClick);
self.addEventListener("fetch", onFetch);
