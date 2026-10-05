// Simple test to verify Quiz Master structure
const fs = require('fs');

console.log('🔍 Quiz Master Extension Structure Test\n');

// Check if core files exist
const requiredFiles = [
  'src/lib/connectionTypes.ts',
  'src/lib/connectionManager.ts', 
  'src/lib/quizApiClient.ts',
  'src/entrypoints/popup/ConnectionUI.tsx',
  'src/entrypoints/popup/main.tsx',
  'SETUP_GUIDE.md',
  'QUIZ_FEATURES.md'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n📊 Structure Status:');
console.log(`Total Files: ${requiredFiles.length}`);
console.log(`Files Present: ${requiredFiles.filter(f => fs.existsSync(f)).length}`);
console.log(`Status: ${allFilesExist ? 'All Required Files Present' : 'Some Files Missing'}`);

if (allFilesExist) {
  console.log('\n🎉 Quiz Master Extension is ready for testing!');
} else {
  console.log('\n⚠️  Some files are missing. Please run npm install and ensure the structure is intact.');
}
