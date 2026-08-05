const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = 'MatrixNeoKozak';
const CARDS_DIR = path.join(__dirname, 'cards');

const BG = '#0b0b14';
const TITLE = '#00ff7f';
const TEXT = '#a9b1d6';
const BAR_BG = '#1a1b26';
const ACCENT = '#00ff7f';
const PURPLE = '#b399ff';

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  HTML: '#e34c26', CSS: '#663399', Java: '#b07219', Go: '#00ADD8',
  Shell: '#89e051', PHP: '#4F5D95', 'C++': '#f34b7d', C: '#555555',
  Rust: '#dea584', Ruby: '#701516', Vue: '#41b883', 'C#': '#178600',
  Swift: '#f05138', Kotlin: '#A97BFF', Scala: '#c22d40', Dart: '#00B4AB',
  Elixir: '#6e4a7e', Lua: '#000080', Haskell: '#5e5086', R: '#198CE7',
  Julia: '#a270ba', Perl: '#0298c3', 'Objective-C': '#438eff',
  MDX: '#fcb32c', Dockerfile: '#384d54', Makefile: '#427819', YAML: '#cb171e',
  JSON: '#292929', Markdown: '#083fa1', Svelte: '#ff3e00', Zig: '#ec915c',
};

async function githubRequest(url) {
  const headers = { 'User-Agent': 'NodeJS-Stats-Generator', 'Accept': 'application/vnd.github+json' };
  if (TOKEN) headers['Authorization'] = `token ${TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} at ${url}`);
  return response.json();
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function statCard(rows) {
  const rowH = 26, titleH = 34, pad = 22;
  const w = 400, h = titleH + rows.length * rowH + pad;
  let body = `<rect width="${w}" height="${h}" rx="8" fill="${BG}"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="7.5" fill="none" stroke="#2a2b3a"/>`;
  body += `<text x="${pad}" y="26" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="${TITLE}">GitHub Stats</text>`;
  rows.forEach((r, i) => {
    const y = titleH + i * rowH + 18;
    body += `<text x="${pad}" y="${y}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${TEXT}">${escapeXml(r.label)}</text>`;
    body += `<text x="${w - pad}" y="${y}" text-anchor="end" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="${PURPLE}">${escapeXml(r.value)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
}

function langCard(langs) {
  const barH = 10, rowH = 30, titleH = 34, pad = 22;
  const w = 400, rows = langs.length;
  const h = titleH + rows * rowH + pad;
  let body = `<rect width="${w}" height="${h}" rx="8" fill="${BG}"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="7.5" fill="none" stroke="#2a2b3a"/>`;
  body += `<text x="${pad}" y="26" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="${TITLE}">Top Languages</text>`;
  const barMax = w - pad * 2 - 46;
  langs.forEach((l, i) => {
    const y = titleH + i * rowH + 13;
    const barY = y + 6;
    const barW = Math.max(2, (l.pct / 100) * barMax);
    body += `<rect x="${pad}" y="${barY}" width="${barMax}" height="${barH}" rx="5" fill="${BAR_BG}"/>`;
    body += `<rect x="${pad}" y="${barY}" width="${barW}" height="${barH}" rx="5" fill="${l.color}"/>`;
    body += `<text x="${pad}" y="${y}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="${TEXT}">${escapeXml(l.name)}</text>`;
    body += `<text x="${w - pad}" y="${y}" text-anchor="end" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${TEXT}">${l.pct.toFixed(1)}%</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
}

async function main() {
  if (!TOKEN) console.warn('Warning: GITHUB_TOKEN not set — rate limits apply.');

  const user = await githubRequest(`https://api.github.com/users/${USERNAME}`);
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await githubRequest(`https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  let totalStars = 0;
  const langBytes = {};
  for (const repo of repos) {
    totalStars += repo.stargazers_count || 0;
    const langs = await githubRequest(`https://api.github.com/repos/${USERNAME}/${repo.name}/languages`);
    for (const [lang, bytes] of Object.entries(langs)) {
      langBytes[lang] = (langBytes[lang] || 0) + bytes;
    }
  }

  fs.mkdirSync(CARDS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CARDS_DIR, 'stats.svg'), statCard([
    { label: 'Public Repositories', value: String(repos.length) },
    { label: 'Total Stars Earned', value: String(totalStars) },
    { label: 'Followers', value: String(user.followers) },
    { label: 'Following', value: String(user.following) },
  ]));

  const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0);
  const langs = Object.entries(langBytes)
    .map(([name, bytes]) => ({ name, bytes, color: LANG_COLORS[name] || '#777777' }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map(l => ({ ...l, pct: (l.bytes / totalBytes) * 100 }));
  fs.writeFileSync(path.join(CARDS_DIR, 'top-langs.svg'), langCard(langs));

  console.log(`cards/stats.svg: ${repos.length} repos, ${totalStars} stars, ${user.followers} followers`);
  console.log(`cards/top-langs.svg: ${langs.map(l => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
