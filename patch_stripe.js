const fs = require('fs');
const path = require('path');

const targetDir = 'node_modules/@stripe/stripe-react-native/lib';

function findAndPatch(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findAndPatch(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.mjs')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let patched = false;
      if (content.includes('forwardRef)(function(_ref){')) {
        console.log(`Patching ${fullPath}`);
        content = content.replace(/forwardRef\)\(function\(_ref\)\{/g, 'forwardRef)(function(_ref, ref){');
        patched = true;
      }
      if (content.includes('forwardRef(function (_ref) {')) {
        console.log(`Patching ${fullPath}`);
        content = content.replace(/forwardRef\(function \(_ref\) \{/g, 'forwardRef(function (_ref, ref) {');
        patched = true;
      }
      if (content.includes('forwardRef(function(_ref){')) {
        console.log(`Patching ${fullPath}`);
        content = content.replace(/forwardRef\(function\(_ref\)\{/g, 'forwardRef(function(_ref, ref){');
        patched = true;
      }
      if (content.includes('forwardRef(function (_ref)')) {
        console.log(`Patching ${fullPath}`);
        content = content.replace(/forwardRef\(function \(_ref\) {/g, 'forwardRef(function (_ref, ref) {');
        patched = true;
      }
      if (content.includes('forwardRef((_ref) => {')) {
        console.log(`Patching ${fullPath}`);
        content = content.replace(/forwardRef\(\(_ref\) => \{/g, 'forwardRef((_ref, ref) => {');
        patched = true;
      }
      if (patched) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

findAndPatch(targetDir);
console.log("Patching complete.");
