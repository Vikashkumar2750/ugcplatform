const fs = require('fs');
const path = require('path');

function searchFiles(dir, text) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
        searchFiles(fullPath, text);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(text)) {
        console.log("FOUND IN:", fullPath);
      }
    }
  }
}

searchFiles(path.join(__dirname, '..'), "Authentication failed: Please make sure your API Key is valid.");
