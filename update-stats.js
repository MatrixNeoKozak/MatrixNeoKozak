const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = 'MatrixNeoKozak';
const README_PATH = path.join(__dirname, 'README.md');

async function githubRequest(url, options = {}) {
  const headers = {
    'User-Agent': 'NodeJS-Stats-Generator',
    ...options.headers
  };
  if (TOKEN) {
    headers['Authorization'] = `token ${TOKEN}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} at ${url}`);
  }
  return response.json();
}

async function getStats() {
  try {
    if (!TOKEN) {
      console.warn("Warning: GITHUB_TOKEN environment variable is not set. API rate limits will be very restrictive.");
    }

    console.log("Searching for commits by author...");
    const commitData = await githubRequest(`https://api.github.com/search/commits?q=author:${USERNAME}`, {
      headers: {
        Accept: 'application/vnd.github.cloak-preview+json'
      }
    });

    const reposSet = new Set();
    for (const item of commitData.items || []) {
      if (item.repository) {
        reposSet.add(item.repository.full_name);
      }
    }

    console.log("Searching for issues/PRs by author...");
    const prData = await githubRequest(`https://api.github.com/search/issues?q=is:pr+author:${USERNAME}`);
    for (const item of prData.items || []) {
      const parts = item.repository_url.split('/repos/');
      if (parts.length > 1) {
        reposSet.add(parts[1]);
      }
    }

    const reposList = Array.from(reposSet).filter(r => r.toLowerCase() !== `${USERNAME}/${USERNAME}`.toLowerCase());
    console.log(`Found ${reposList.length} unique contributed repositories.`);

    console.log("Fetching repository details...");
    const repoDetails = [];
    
    // Fetch repository details in parallel with small batches to avoid rate limit issues
    const batchSize = 10;
    for (let i = 0; i < reposList.length; i += batchSize) {
      const batch = reposList.slice(i, i + batchSize);
      const promises = batch.map(async (repoFullName) => {
        try {
          const data = await githubRequest(`https://api.github.com/repos/${repoFullName}`);
          return {
            fullName: repoFullName,
            stars: data.stargazers_count,
            description: data.description || 'No description provided.',
            language: data.language || 'Mixed',
            htmlUrl: data.html_url
          };
        } catch (e) {
          console.error(`Failed to fetch details for ${repoFullName}:`, e.message);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      repoDetails.push(...results.filter(r => r !== null));
    }

    // Sort by stars descending
    repoDetails.sort((a, b) => b.stars - a.stars);

    // Calculate total stats
    const totalStars = repoDetails.reduce((sum, r) => sum + r.stars, 0);

    console.log("Generating Markdown...");
    let markdown = `<!-- STATS_SECTION:START -->
<p align="center">
  <img src="https://img.shields.io/badge/Contributed%20Repositories-${repoDetails.length}-00ff7f?style=for-the-badge&logo=github&logoColor=black" alt="Contributed Repos" />
  <img src="https://img.shields.io/badge/Total%20Contributed%20Stars-${totalStars.toLocaleString()}-00ff7f?style=for-the-badge&logo=github&logoColor=black" alt="Total Stars" />
</p>

### 🏆 Top Contributed Repositories (by Stars)

| Repository | Stars | Language | Description |
| :--- | :---: | :---: | :--- |
`;

    // Display top 15 repositories
    const topRepos = repoDetails.slice(0, 15);
    for (const repo of topRepos) {
      const cleanDesc = repo.description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      markdown += `| **[${repo.fullName}](${repo.htmlUrl})** | ⭐ ${repo.stars.toLocaleString()} | \`${repo.language}\` | ${cleanDesc} |\n`;
    }

    markdown += `<!-- STATS_SECTION:END -->`;

    // Read and update README.md
    if (fs.existsSync(README_PATH)) {
      let readmeContent = fs.readFileSync(README_PATH, 'utf8');
      const startTag = '<!-- STATS_SECTION:START -->';
      const endTag = '<!-- STATS_SECTION:END -->';
      
      const startIndex = readmeContent.indexOf(startTag);
      const endIndex = readmeContent.indexOf(endTag);

      if (startIndex !== -1 && endIndex !== -1) {
        readmeContent = readmeContent.substring(0, startIndex) + markdown + readmeContent.substring(endIndex + endTag.length);
      } else {
        const snakeTag = '### 🐍 Contribution Snake';
        const snakeIndex = readmeContent.indexOf(snakeTag);
        if (snakeIndex !== -1) {
          readmeContent = readmeContent.substring(0, snakeIndex) + `### 🚀 Open Source Contributions & Impact\n\n` + markdown + `\n\n---\n\n` + readmeContent.substring(snakeIndex);
        } else {
          readmeContent += `\n\n### 🚀 Open Source Contributions & Impact\n\n` + markdown;
        }
      }

      fs.writeFileSync(README_PATH, readmeContent, 'utf8');
      console.log("README.md updated successfully!");
    } else {
      console.error("README.md not found at", README_PATH);
    }

  } catch (err) {
    console.error("Error in getStats:", err.message);
    process.exit(1);
  }
}

getStats();
