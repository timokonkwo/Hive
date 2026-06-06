/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const file = fs.readFileSync('app/docs/page.tsx', 'utf8');

// Find where Main Content starts
const mainContentStart = file.indexOf('{/* Main Content */}');
if (mainContentStart === -1) {
  console.log("Could not find Main Content");
  process.exit(1);
}

const mainContentEnd = file.lastIndexOf('</div>', file.indexOf('</main>'));

let mainContent = file.substring(mainContentStart, mainContentEnd);

// Now we need to grab the imports from the top of the file
const importsEnd = file.indexOf('const SECTION_IDS');
const imports = file.substring(0, importsEnd);

const componentsContent = `${imports}
export function ContentSections() {
  return (
    <div className="lg:col-span-9 space-y-16">
      ${mainContent.replace('{/* Main Content */}', '')}
    </div>
  );
}
`;

fs.writeFileSync('app/docs/_components/ContentSections.tsx', componentsContent);

const newPageContent = file.substring(0, mainContentStart) + 
  '          <ContentSections />\n' + 
  file.substring(mainContentEnd + 6); // +6 for </div>

// Add import for ContentSections
const importToAdd = 'import { ContentSections } from "./_components/ContentSections";\n';
const modifiedPageContent = newPageContent.replace('import Link from "next/link";\n', 'import Link from "next/link";\n' + importToAdd);

fs.writeFileSync('app/docs/page.tsx', modifiedPageContent);
console.log("Refactoring complete.");
