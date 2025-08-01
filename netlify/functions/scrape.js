// File: netlify/functions/scrape.js
const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');

const BASE_URL = 'https://samehadaku.li';

// --- Fungsi Utama ---
exports.handler = async function (event, context) {
    const { url, search, animePage } = event.queryStringParameters;
    try {
        let data;
        if (search) {
            // LOGIKA BARU: Gunakan parser XML untuk pencarian
            data = await scrapeSearchFeed(search);
        } else if (animePage) {
            // LOGIKA BARU: Scrape halaman utama anime untuk daftar episode
            data = await scrapeAnimePage(animePage);
        } else if (url) {
            // Logika lama untuk mengambil video
            data = await scrapeEpisodePage(url);
        } else {
            // Halaman utama
            data = await scrapeHomePage();
        }
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        console.error('Scraping error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// --- LOGIKA SCRAPER BARU ---

// 1. Scraping Pencarian dari RSS FEED (Cepat & Stabil)
async function scrapeSearchFeed(query) {
    const feedUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/feed/rss2/`;
    const { data } = await axios.get(feedUrl);
    const parsed = await parseStringPromise(data);

    // Cek jika ada item atau tidak
    if (!parsed.rss.channel[0].item) {
        return { type: 'search', query, results: [] };
    }

    const results = parsed.rss.channel[0].item.map(item => ({
        title: item.title[0],
        link: item.link[0],
        pubDate: item.pubDate[0],
        // Thumbnail tidak ada di RSS, akan kita ambil di langkah selanjutnya
        thumbnail: null 
    }));
    return { type: 'search', query, results };
}

// 2. Scraping Halaman Anime untuk daftar episode & thumbnail (Detail)
async function scrapeAnimePage(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const episodes = [];
    $('.episodelist ul li').each((i, el) => {
        const linkEl = $(el).find('.lefttitle a');
        const title = linkEl.text();
        const link = linkEl.attr('href');
        const date = $(el).find('.righttitle').text();
        episodes.push({ title, link, date });
    });

    const thumbnail = $('.thumb img').attr('src');
    const synopsis = $('.entry-content.series p').text();

    return { type: 'animePage', episodes, thumbnail, synopsis };
}

// --- LOGIKA SCRAPER LAMA (Tetap dibutuhkan) ---

// 3. Scraping Halaman Utama (Homepage)
async function scrapeHomePage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    const episodes = [];
    $('.post-show ul li').each((i, el) => {
        episodes.push({
            title: $(el).find('a').attr('title'),
            link: $(el).find('a').attr('href'),
            thumbnail: $(el).find('img')?.attr('src'),
        });
    });
    return { type: 'latest', results: episodes.filter(e => e.title) };
}

// 4. Scraping Halaman Episode (Final)
async function scrapeEpisodePage(episodeUrl) {
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);
    const title = $('.entry-title').text().trim();
    const videoFrames = [];
    $('.player-embed iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) videoFrames.push(src);
    });
    return { type: 'episode', title, videoFrames: videoFrames.length > 0 ? videoFrames : ['Video tidak ditemukan'] };
}
