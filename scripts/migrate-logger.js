/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walk(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

walk('./app/api', (filepath) => {
  if (!filepath.endsWith('.ts') && !filepath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('console.log') && !content.includes('console.error') && !content.includes('console.warn')) return;

  // Add logger import if not exists
  if (!content.includes("import { logger } from '@/lib/logger';")) {
    const importRegex = /^import\s+.*?;?\n/gm;
    let match;
    let lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      lastIndex = match.index + match[0].length;
    }
    content = content.slice(0, lastIndex) + "import { logger } from '@/lib/logger';\n" + content.slice(lastIndex);
  }

  // Replace console.X with logger.Y
  content = content.replace(/console\.log\((.*?)\);?/g, "logger.info($1);");
  content = content.replace(/console\.error\((.*?)\);?/g, "logger.error($1);");
  content = content.replace(/console\.warn\((.*?)\);?/g, "logger.warn($1);");
  
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${filepath}`);
});
