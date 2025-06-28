let CACHE_NAME = 'pwacache-default';
let CURRENT_VERSION = null;

const FILES_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './sw.js',
    './icon-192.png',
    './icon-512.png'
];

// 安裝階段：抓取 version.json 並設定版本快取名稱
self.addEventListener('install', event => {
    event.waitUntil(
        fetch('./version.json', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                CURRENT_VERSION = data.version || 'unknown';
                CACHE_NAME = `pwacache-v${CURRENT_VERSION}`;
                return caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE));
            })
            .catch(err => {
                console.warn('無法取得 version.json，進入備援快取模式', err);
            })
    );
    self.skipWaiting();
});

// 啟用階段：刪除舊快取
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }))
        )
    );
    clients.claim();
});

// 網頁請求處理邏輯
self.addEventListener('fetch', event => {
    const req = event.request;

    // version.json：永遠從網路取得
    if (req.url.includes('version.json')) {
        return event.respondWith(fetch(req));
    }

    // index.html 或導向頁面請求
    if (req.mode === 'navigate' || req.url.endsWith('index.html')) {
        event.respondWith(handleIndexRequest(req));
        return;
    }

    // 其他資源：快取優先
    event.respondWith(
        caches.match(req).then(cacheRes => cacheRes || fetch(req))
    );
});

async function handleIndexRequest(req) {
    try {
        const versionRes = await fetch('./version.json', { cache: 'no-store' });
        const data = await versionRes.json();
        const latestVersion = data.version || null;
        const newCacheName = `pwacache-v${latestVersion}`;

        if (latestVersion && newCacheName !== CACHE_NAME) {
            // 發現新版本：抓取新 index.html 並更新快取
            const freshRes = await fetch(req);
            const newCache = await caches.open(newCacheName);
            await newCache.put(req, freshRes.clone());

            // 刪除所有其他舊快取
            const allCaches = await caches.keys();
            await Promise.all(
                allCaches.map(name => {
                    if (name !== newCacheName) {
                        return caches.delete(name);
                    }
                })
            );

            // 更新目前的快取名稱
            CACHE_NAME = newCacheName;

            return freshRes;
        } else {
            // 沒有新版本：回傳目前快取中的 index.html
            return caches.match('./index.html');
        }
    } catch (err) {
        console.warn('取得 version.json 或 index.html 時發生錯誤，嘗試使用快取版本', err);
        return caches.match('./index.html');
    }
}

self.addEventListener('message', event => {
    if (event.data?.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// async function handleIndexRequest(req) {
//     try {
//         const versionRes = await fetch('./version.json', { cache: 'no-store' });
//         const data = await versionRes.json();
//         const latestVersion = data.version || null;
//
//         if (latestVersion && `pwacache-v${latestVersion}` !== CACHE_NAME) {
//             // 新版本 ➜ 抓新 index.html 並更新快取
//             const freshRes = await fetch(req);
//             const newCache = await caches.open(`pwacache-v${latestVersion}`);
//             await newCache.put(req, freshRes.clone());
//             return freshRes;
//         } else {
//             // 舊版或無版本 ➜ 使用快取版本
//             return caches.match('./index.html');
//         }
//     } catch (err) {
//         console.warn('取得 version.json 或 index.html 時發生錯誤，改用快取版本', err);
//         return caches.match('./index.html');
//     }
// }

