const fs = require('fs');
const path = require('path');

// Erstelle ein Dummy ajv-formats Modul, damit schema-utils es nicht mehr benötigt
const ajvFormatsPath = path.join(__dirname, 'node_modules/ajv-formats');

// Erstelle das Verzeichnis, falls es nicht existiert
if (!fs.existsSync(ajvFormatsPath)) {
  fs.mkdirSync(ajvFormatsPath, { recursive: true });
}

// Erstelle dist Verzeichnis
const distPath = path.join(ajvFormatsPath, 'dist');
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Erstelle ein Dummy index.js mit der richtigen Struktur
const indexPath = path.join(ajvFormatsPath, 'index.js');
const dummyModule = `
module.exports = function(ajv) {
  // Dummy-Implementierung - tut nichts
  return ajv;
};
module.exports.default = module.exports;
`;
fs.writeFileSync(indexPath, dummyModule);

// Erstelle ein Dummy limit.js
const limitPath = path.join(ajvFormatsPath, 'dist/limit.js');
const dummyLimit = `
module.exports = function() {
  // Dummy-Implementierung - tut nichts
};
module.exports.default = module.exports;
`;
fs.writeFileSync(limitPath, dummyLimit);

console.log('ajv-formats Dummy-Modul erstellt');

// ajv-formats Dummy-Modul wird erstellt
// Das Patchen von schema-utils wird von patch-schema-utils.js übernommen

// Stelle sicher, dass schema-utils die richtige ajv Version verwendet
const schemaUtilsNodeModules = path.join(__dirname, 'node_modules/schema-utils/node_modules');
if (fs.existsSync(schemaUtilsNodeModules)) {
  // Entferne falsche ajv Versionen aus schema-utils
  const ajvPath = path.join(schemaUtilsNodeModules, 'ajv');
  if (fs.existsSync(ajvPath)) {
    // Prüfe ob es ajv@8.x ist
    const packageJsonPath = path.join(ajvPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.version && packageJson.version.startsWith('8.')) {
          // Entferne ajv@8.x aus schema-utils (rekursiv)
          function removeDir(dir) {
            if (fs.existsSync(dir)) {
              fs.readdirSync(dir).forEach(file => {
                const curPath = path.join(dir, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                  removeDir(curPath);
                } else {
                  fs.unlinkSync(curPath);
                }
              });
              fs.rmdirSync(dir);
            }
          }
          removeDir(ajvPath);
          console.log('ajv@8.x aus schema-utils entfernt');
        }
      } catch (e) {
        console.log('Fehler beim Entfernen von ajv:', e.message);
      }
    }
  }
}

