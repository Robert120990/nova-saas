const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const PORT = process.env.PORT || 4000;

(async () => {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:' + PORT + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const tempToken = loginData.tempToken;

    // 2. Select context
    const selRes = await fetch('http://localhost:' + PORT + '/api/auth/select-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tempToken },
      body: JSON.stringify({ company_id: 1, branch_id: 1 })
    });
    const selData = await selRes.json();
    console.log('Select context status:', selRes.status);
    if (!selData.token) {
      console.log('Select context failed:', JSON.stringify(selData));
      return;
    }
    const token = selData.token;

    // 3. Call connected users
    const resp = await fetch('http://localhost:' + PORT + '/api/users/connected', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await resp.json();
    console.log('Connected status:', resp.status);
    console.log('Connected response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
