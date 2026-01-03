const fs = require('fs');
const path = require('path');

// Patch schema-utils absolutePath.js, um Kompatibilität mit ajv@6.x sicherzustellen
const absolutePathPath = path.join(__dirname, 'node_modules/schema-utils/dist/keywords/absolutePath.js');

if (!fs.existsSync(absolutePathPath)) {
  console.log('absolutePath.js nicht gefunden - überspringe Patch');
  process.exit(0);
}

let content = fs.readFileSync(absolutePathPath, 'utf8');

// Der Fehler ist: "Keyword [object Object] is not a valid identifier"
// Das Problem ist, dass addKeyword ein Objekt erhält: { name: "absolutePath", ... }
// In ajv@6.x sollte addKeyword mit einem String-Namen aufgerufen werden: ajv.addKeyword("absolutePath", definition)

if (content.includes('ajv.addKeyword')) {
  console.log('ajv.addKeyword gefunden in absolutePath.js');
  
  // Einfachster Ansatz: Ersetze die gesamte addAbsolutePathKeyword Funktion
  // Suche nach der Funktion und ersetze sie durch eine kompatible Version
  const functionMatch = content.match(/function\s+addAbsolutePathKeyword\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  
  if (functionMatch) {
    console.log('addAbsolutePathKeyword Funktion gefunden');
    
    // Ersetze die Funktion durch eine kompatible Version
    const newFunction = `function addAbsolutePathKeyword(ajv) {
  if (!ajv) {
    return;
  }
  // ajv@6.x API: addKeyword(name, definition)
  ajv.addKeyword("absolutePath", {
    errors: true,
    type: "string",
    compile: function (schema, parentSchema) {
      return function (data) {
        if (typeof data !== "string") {
          return true;
        }
        return require("path").isAbsolute(data);
      };
    },
    metaSchema: {
      type: "boolean"
    }
  });
}`;
    
    content = content.replace(/function\s+addAbsolutePathKeyword\s*\([^)]*\)\s*\{[\s\S]*?\n\}/, newFunction);
    console.log('✓ addAbsolutePathKeyword Funktion ersetzt');
  } else {
    // Fallback: Ersetze nur den addKeyword-Aufruf
    // Suche nach ajv.addKeyword({ name: "absolutePath", ... })
    content = content.replace(
      /ajv\.addKeyword\s*\(\s*\{\s*name\s*:\s*['"]absolutePath['"][\s\S]*?\}\s*\)/g,
      (match) => {
        // Extrahiere den Inhalt des Objekts (ohne name)
        const objMatch = match.match(/\{([\s\S]*)\}/);
        if (objMatch) {
          const objContent = objMatch[1].replace(/name\s*:\s*['"]absolutePath['"]\s*,?\s*/, '').trim();
          return `ajv.addKeyword("absolutePath", {${objContent}})`;
        }
        return match;
      }
    );
    console.log('✓ addKeyword-Aufruf gepatcht');
  }
} else {
  console.log('ajv.addKeyword nicht gefunden in absolutePath.js');
}

fs.writeFileSync(absolutePathPath, content);
console.log('absolutePath.js erfolgreich gepatcht');
