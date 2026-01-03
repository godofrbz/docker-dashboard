const fs = require('fs');
const path = require('path');

const webpackConfigPath = path.join(__dirname, 'node_modules/react-scripts/config/webpack.config.js');

if (!fs.existsSync(webpackConfigPath)) {
  console.log('Webpack config nicht gefunden, überspringe Patch');
  process.exit(0);
}

let content = fs.readFileSync(webpackConfigPath, 'utf8');

// Finde die ForkTsCheckerWebpackPlugin Konfiguration und ersetze sie
// Suche nach dem Pattern: plugins.push(new ForkTsCheckerWebpackPlugin(...))
const pattern = /plugins\.push\(\s*new ForkTsCheckerWebpackPlugin\([\s\S]*?\),\s*\)/g;

if (pattern.test(content)) {
  content = content.replace(pattern, '// ForkTsCheckerWebpackPlugin deaktiviert');
  fs.writeFileSync(webpackConfigPath, content);
  console.log('Webpack config erfolgreich gepatcht');
} else {
  console.log('ForkTsCheckerWebpackPlugin nicht gefunden, überspringe Patch');
}




