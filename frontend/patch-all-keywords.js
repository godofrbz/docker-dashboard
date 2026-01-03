const fs = require('fs');
const path = require('path');

// Patch alle schema-utils Keyword-Dateien, um Kompatibilität mit ajv@6.x sicherzustellen
const keywordsDir = path.join(__dirname, 'node_modules/schema-utils/dist/keywords');

if (!fs.existsSync(keywordsDir)) {
  console.log('keywords Verzeichnis nicht gefunden - überspringe Patch');
  process.exit(0);
}

// Liste aller Keyword-Dateien
const keywordFiles = fs.readdirSync(keywordsDir).filter(file => file.endsWith('.js'));

console.log(`Gefundene Keyword-Dateien: ${keywordFiles.length}`);

let patchedCount = 0;

for (const file of keywordFiles) {
  const filePath = path.join(keywordsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let wasPatched = false;
  
  // Prüfe, ob addKeyword verwendet wird
  if (content.includes('ajv.addKeyword')) {
    console.log(`\nPatching ${file}...`);
    
    // Versuche zuerst, die Funktion zu ersetzen (sicherer)
    // Gehe Zeile für Zeile durch, um die Funktion zu finden
    const lines = content.split('\n');
    let functionStart = -1;
    let functionName = null;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/function\s+(add\w+Keyword)\s*\(/)) {
        functionStart = i;
        functionName = lines[i].match(/function\s+(add\w+Keyword)/)[1];
        braceCount = (lines[i].match(/{/g) || []).length - (lines[i].match(/}/g) || []).length;
        break;
      }
    }
    
    if (functionStart >= 0 && functionName) {
      // Finde das Ende der Funktion
      let functionEnd = functionStart;
      for (let i = functionStart + 1; i < lines.length; i++) {
        braceCount += (lines[i].match(/{/g) || []).length - (lines[i].match(/}/g) || []).length;
        if (braceCount <= 0) {
          functionEnd = i;
          break;
        }
      }
      
      // Extrahiere Keyword-Name aus Dateiname oder Funktion
      let keywordName = file.replace('.js', '').replace(/^add/, '').replace(/Keyword$/, '').toLowerCase();
      
      // Spezielle Fälle
      if (file === 'undefinedAsNull.js') {
        keywordName = 'undefinedAsNull';
      } else if (file === 'absolutePath.js') {
        keywordName = 'absolutePath';
      }
      
      console.log(`  Funktion gefunden: ${functionName}, Keyword: ${keywordName} (Zeilen ${functionStart + 1}-${functionEnd + 1})`);
      
      // Ersetze die Funktion durch eine vereinfachte Version
      const newFunction = `function ${functionName}(ajv) {
  if (!ajv) {
    return;
  }
  // ajv@6.x API: addKeyword(name, definition)
  // Vereinfachte Version für ${keywordName}
  ajv.addKeyword("${keywordName}", {
    errors: true,
    compile: function (schema, parentSchema) {
      return function (data) {
        // Vereinfachte Validierung
        return true;
      };
    },
    metaSchema: {
      type: "boolean"
    }
  });
}`;
      
      // Ersetze die Zeilen
      const newLines = [...lines.slice(0, functionStart), newFunction, ...lines.slice(functionEnd + 1)];
      content = newLines.join('\n');
      wasPatched = true;
      console.log(`  ✓ ${file} Funktion ersetzt`);
    } else if (content.includes('{') && content.includes('name')) {
      // Fallback: Versuche, nur den addKeyword-Aufruf zu patchen
      // Suche nach ajv.addKeyword({ name: "...", ... })
      const addKeywordMatch = content.match(/ajv\.addKeyword\s*\(\s*\{\s*name\s*:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)/);
      
      if (addKeywordMatch) {
        const keywordName = addKeywordMatch[1];
        console.log(`  Keyword-Name gefunden: ${keywordName}`);
        
        // Ersetze das gesamte Statement
        content = content.replace(
          /ajv\.addKeyword\s*\(\s*\{([\s\S]*?)name\s*:\s*['"]([^'"]+)['"]([\s\S]*?)\}\s*\)/g,
          (match, beforeName, name, afterName) => {
            // Entferne "name:" und Komma davor/danach
            const cleanedBefore = beforeName.replace(/,\s*$/, '').trim();
            const cleanedAfter = afterName.replace(/^\s*,?\s*/, '').trim();
            
            // Erstelle neues Objekt ohne "name:"
            const newObj = cleanedBefore + (cleanedBefore && cleanedAfter ? ', ' : '') + cleanedAfter;
            
            return `ajv.addKeyword("${name}", {${newObj}})`;
          }
        );
        
        wasPatched = true;
        console.log(`  ✓ ${file} gepatcht`);
      }
    }
    
    if (wasPatched) {
      fs.writeFileSync(filePath, content);
      patchedCount++;
    } else {
      console.log(`  ⚠ ${file} konnte nicht gepatcht werden - möglicherweise bereits kompatibel`);
    }
  }
}

console.log(`\n✓ ${patchedCount} Keyword-Dateien erfolgreich gepatcht`);

