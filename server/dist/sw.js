/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-f001acab'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "assets/main-DcGdkgHQ-2025-07-31T20-22-43-425Z.css",
    "revision": null
  }, {
    "url": "assets/main-DfBUAAI--2025-07-31T20-22-42-922Z.js",
    "revision": null
  }, {
    "url": "assets/pdf-lib-w74_435F-2025-07-31T20-22-42-923Z.js",
    "revision": null
  }, {
    "url": "assets/service-worker-BGlgtLKe-2025-07-31T20-22-42-923Z.js",
    "revision": null
  }, {
    "url": "assets/vendor-3yetOdCJ-2025-07-31T20-22-42-965Z.js",
    "revision": null
  }, {
    "url": "index.html",
    "revision": "cb55996bb3f4c5bec676fc0d2ff42611"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "service-worker.js",
    "revision": "27b3f248f55b3994256f41641ce8772d"
  }, {
    "url": "android-chrome-192x192.png",
    "revision": "abfa4f40eafa10d13e672a5657eae4b2"
  }, {
    "url": "android-chrome-512x512.png",
    "revision": "6522425f378b68c1450a2ae5b62246e7"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "0e2fac3a3f278ceb6df2f5f97903dbb5"
  }, {
    "url": "favicon.ico",
    "revision": "ae868df995b56a0171120cd067ffa06e"
  }, {
    "url": "manifest.webmanifest",
    "revision": "bc8ce72bf6beb810f691af1c6749f6dd"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/.*\.(?:png|jpg|jpeg|svg|gif|pdf)$/, new workbox.CacheFirst({
    "cacheName": "large-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/.*\.(?:js|css)/, new workbox.NetworkFirst({
    "cacheName": "static-resources",
    plugins: []
  }), 'GET');

}));
//# sourceMappingURL=sw.js.map
