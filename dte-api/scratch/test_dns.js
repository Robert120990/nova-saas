const dns = require('dns');

const host = 'host.docker.internal';

console.log(`Resolving ${host}...`);

dns.lookup(host, (err, address, family) => {
  if (err) {
    console.error('DNS Lookup Error:', err);
    return;
  }
  console.log('Address:', address);
  console.log('Family: IPv', family);
});

dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.error('DNS Resolve4 Error:', err);
    return;
  }
  console.log('Resolve4 Addresses:', addresses);
});
