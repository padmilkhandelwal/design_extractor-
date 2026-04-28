import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to fetch website content
  app.post("/api/fetch-site", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const targetUrl = url.startsWith("http") ? url : `https://${url}`;
      let html = "";
      let title = targetUrl;
      
      try {
        const response = await axios.get(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          timeout: 10000
        });
        html = response.data;
      } catch (err: any) {
         console.warn(`Direct fetch failed, falling back to proxy: ${targetUrl} (${err.message})`);
         // Fallback to proxy
         const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
         const proxyRes = await axios.get(proxyUrl);
         if (proxyRes.data && proxyRes.data.contents) {
           html = proxyRes.data.contents;
         } else {
           throw err;
         }
      }

      const $ = cheerio.load(html);
      
      title = $("title").text().trim() || targetUrl;

      // Clean empty src/href to prevent browser/React warnings
      $('[src=""]').removeAttr('src');
      $('[href=""]').removeAttr('href');

      // Inline styles
      let css = "";
      $("style").each((i, el) => {
        css += $(el).text() + "\n";
      });

      // Link stylesheets
      const stylesheetUrls: string[] = [];
      $('link[rel="stylesheet"]').each((i, el) => {
        const href = $(el).attr("href");
        if (href) {
          try {
            const absoluteUrl = new URL(href, targetUrl).toString();
            stylesheetUrls.push(absoluteUrl);
          } catch (e) {
            console.error("Invalid URL in stylesheet link:", href);
          }
        }
      });

      // Fetch external stylesheets
      const stylesheetPromises = stylesheetUrls.map(async u => {
        try {
          const res = await axios.get(u, { 
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/css,*/*;q=0.1'
            },
            timeout: 5000 
          });
          return res.data;
        } catch (e: any) {
          console.warn(`Failed to fetch stylesheet directly, trying proxy: ${u}`);
          try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`;
            const proxyRes = await axios.get(proxyUrl);
            if (proxyRes.data && proxyRes.data.contents) {
              return proxyRes.data.contents;
            }
          } catch (pe) {
            console.warn(`Proxy also failed for stylesheet: ${u}`);
          }
          return "";
        }
      });
      
      const externalCss = await Promise.all(stylesheetPromises);
      css += externalCss.join("\n");

      res.json({ html, css, title });
    } catch (error: any) {
      console.error("Error fetching site:", error.message);
      res.status(500).json({ error: "Failed to fetch website content: " + (error.response?.status ? `HTTP ${error.response.status}` : error.message) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
