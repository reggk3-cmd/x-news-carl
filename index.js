import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';
import fs from 'fs';

const parser = new Parser();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const RSS_URLS = [
  'https://www.ign.com/rss/articles/feed',
  'https://www.theverge.com/rss/index.xml',
  'https://feeds.feedburner.com/TechCrunch/',
  'https://www.gamespot.com/feeds/news/',
  'https://www.empireonline.com/rss/'
];

async function run() {
  try {
    let latestItem = null;
    
    for (const url of RSS_URLS) {
      try {
        const feed = await parser.parseURL(url);
        if (feed.items && feed.items.length > 0) {
          latestItem = feed.items[0];
          break;
        }
      } catch (e) {
        console.log(`RSS okuma hatası (${url}):`, e.message);
      }
    }

    if (!latestItem) {
      console.log("Hiçbir haber bulunamadı.");
      return;
    }

    const newsTitle = latestItem.title;
    const newsLink = latestItem.link;

    let lastProcessed = "";
    if (fs.existsSync('last_post.txt')) {
      lastProcessed = fs.readFileSync('last_post.txt', 'utf8').trim();
    }

    if (lastProcessed === newsTitle) {
      console.log("Bu haber zaten daha önce paylaşılmış. Yeni haber bekleniyor.");
      return;
    }

    console.log(`Yeni haber bulundu: ${newsTitle}`);

    const prompt = `Aşağıdaki küresel haber başlığını dikkate alarak X (Twitter) için dikkat çekici, kısa, öz, Türkçe bir tweet yaz. Uygun hashtag'ler ekle ve mutlaka haberin linkini (${newsLink}) sona koy.\n\nHaber Başlığı: ${newsTitle}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const tweetText = response.text.trim();
    console.log("Oluşturulan Tweet:\n", tweetText);

    const command = `npx xactions post "${tweetText.replace(/"/g, '\\"')}"`;
    execSync(command, { 
      env: { ...process.env, XACTIONS_SESSION_COOKIE: process.env.X_AUTH_TOKEN },
      stdio: 'inherit' 
    });

    fs.writeFileSync('last_post.txt', newsTitle);
    console.log("✅ Tweet başarıyla atıldı!");

  } catch (error) {
    console.error("Hata oluştu:", error);
    process.exit(1);
  }
}

run();
