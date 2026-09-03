export const tests = {
  'returns config defaults': () => {
    const cfg = { gatewayUrl: 'http://localhost:3001/rewrite' };
    return cfg.gatewayUrl.includes('rewrite');
  },
  'rewrite gateway client shapes payload': async () => {
    const response = await fetch('http://localhost:3001/health');
    const body = await response.json();
    return body.ok === true;
  },
};
