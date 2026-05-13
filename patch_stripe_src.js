const fs = require('fs');

const path = 'node_modules/@stripe/stripe-react-native/src/components/PaymentMethodMessagingElement.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '({ appearance, configuration, onStateChange, ...props }) => {',
  '({ appearance, configuration, onStateChange, ...props }, ref) => {'
);

fs.writeFileSync(path, content);
console.log('Patched ' + path);
