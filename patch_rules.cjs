const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf-8');

code = code.replace(
  "request.auth.token.email != null",
  "\"email\" in request.auth.token"
);

fs.writeFileSync('firestore.rules', code);
