/* ============================================================
   Service worker — membuat aplikasi bisa dibuka tanpa internet.

   Strategi: "cache dulu, perbarui di belakang layar".
   - File aplikasi disimpan saat instalasi (precache).
   - Setiap permintaan dijawab dari cache; sambil itu salinan terbaru
     diambil dari jaringan dan disimpan untuk kunjungan berikutnya.

   Ubah VERSI setiap kali kamu menambah/mengganti file di DAFTAR_FILE
   supaya cache lama dibersihkan.
   ============================================================ */
const VERSI = "keuangan-v1";

const DAFTAR_FILE = [
  "./",
  "./index.html",
  "./chart.umd.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

// 1. Instalasi: simpan semua file aplikasi ke cache
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSI)
      .then(cache => cache.addAll(DAFTAR_FILE.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// 2. Aktivasi: hapus cache versi lama
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(nama => Promise.all(nama.filter(n => n !== VERSI).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// 3. Permintaan: jawab dari cache, perbarui dari jaringan
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // biarkan permintaan ke situs lain apa adanya

  event.respondWith((async () => {
    const cache = await caches.open(VERSI);
    const tersimpan = await cache.match(req, { ignoreSearch: true });

    const dariJaringan = fetch(req)
      .then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (tersimpan) {
      event.waitUntil(dariJaringan);                 // biarkan pembaruan selesai di belakang layar
      return tersimpan;
    }

    const res = await dariJaringan;
    if (res) return res;

    // Offline dan file tidak ada di cache: untuk halaman, tampilkan aplikasi utama
    if (req.mode === "navigate") {
      const awal = await cache.match("./index.html");
      if (awal) return awal;
    }
    return new Response("Sedang offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })());
});
