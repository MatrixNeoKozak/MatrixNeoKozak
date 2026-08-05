const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = 'MatrixNeoKozak';
const CARDS_DIR = path.join(__dirname, 'cards');

const BG = '#0b0b14';
const TITLE = '#00ff7f';
const TEXT = '#a9b1d6';
const MUTED = '#565f89';
const PURPLE = '#b399ff';

const TIERS = [
  { grade: 'S', min: 70000, next: Infinity },
  { grade: 'A+', min: 40000, next: 70000 },
  { grade: 'A', min: 20000, next: 40000 },
  { grade: 'B+', min: 10000, next: 20000 },
  { grade: 'B', min: 4000, next: 10000 },
  { grade: 'C', min: 2000, next: 4000 },
  { grade: 'D', min: 1000, next: 2000 },
  { grade: 'E', min: 0, next: 1000 },
];

async function githubRequest(url, accept) {
  const headers = { 'User-Agent': 'NodeJS-Stats-Generator', 'Accept': accept || 'application/vnd.github+json' };
  if (TOKEN) headers['Authorization'] = `token ${TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} at ${url}`);
  return response.json();
}

function calcRank(score) {
  const tier = TIERS.find(t => score >= t.min && score < t.next);
  const span = tier.next - tier.min;
  const pos = (score - tier.min) / span;
  let grade = tier.grade;
  if (tier.min > 0 && tier.next !== Infinity && !grade.includes('+')) {
    if (pos > 0.66) grade = grade.replace(/^-/, '') + '+';
    else if (pos < 0.33) grade = grade + '-';
  }
  return grade;
}

function rankCard(rank, score, breakdown) {
  const w = 400, h = 150, pad = 22;
  let body = `<rect width="${w}" height="${h}" rx="8" fill="${BG}"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="7.5" fill="none" stroke="#2a2b3a"/>`;
  body += `<text x="${w / 2}" y="28" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${TITLE}">GitHub Account Rating</text>`;
  body += `<text x="${w / 2}" y="92" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="58" font-weight="700" fill="${PURPLE}">${rank}</text>`;
  body += `<text x="${w / 2}" y="118" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="${TEXT}">Score ${score.toLocaleString('en-US')}</text>`;
  body += `<text x="${w / 2}" y="137" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="10" fill="${MUTED}">${breakdown}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
}

async function main() {
  if (!TOKEN) console.warn('Warning: GITHUB_TOKEN not set — rate limits apply.');

  const user = await githubRequest(`https://api.github.com/users/${USERNAME}`);

  let totalStars = 0;
  for (let page = 1; ; page++) {
    const batch = await githubRequest(`https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}`);
    for (const repo of batch) totalStars += repo.stargazers_count || 0;
    if (batch.length < 100) break;
  }

  const [commits, prs, issues] = await Promise.all([
    githubRequest(`https://api.github.com/search/commits?q=author:${USERNAME}&per_page=1`, 'application/vnd.github.cloak-preview'),
    githubRequest(`https://api.github.com/search/issues?q=is:pr+author:${USERNAME}&per_page=1`),
    githubRequest(`https://api.github.com/search/issues?q=is:issue+author:${USERNAME}&per_page=1`),
  ]);

  const totalCommits = commits.total_count || 0;
  const totalPRs = prs.total_count || 0;
  const totalIssues = issues.total_count || 0;
  const followers = user.followers || 0;
  const score = totalStars * 2 + totalCommits + totalIssues + totalPRs * 2 + followers;

  const rank = calcRank(score);
  const breakdown = `Stars ${totalStars} · Commits ${totalCommits} · PRs ${totalPRs} · Issues ${totalIssues} · Followers ${followers}`;

  fs.mkdirSync(CARDS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CARDS_DIR, 'rank.svg'), rankCard(rank, score, breakdown));
  fs.unlinkSync(path.join(CARDS_DIR, 'stats.svg'));
  fs.unlinkSync(path.join(CARDS_DIR, 'top-langs.svg'));
  console.log(`cards/rank.svg: grade ${rank}, score ${score} (${breakdown})`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
