import assert from 'node:assert/strict';
import {
  createCorsPolicy,
  getCorsHeadersForPolicy,
} from '../app/utils/corsPolicy';

const productionPolicy = createCorsPolicy({
  allowedOrigins: 'https://hub.example.com/app, https://hub.example.com',
  gptVisualizerClient: 'https://visualizer.example.com',
  corsMode: 'production',
  nodeEnv: 'production',
});

assert.deepEqual(productionPolicy.origins, [
  'https://hub.example.com',
  'https://visualizer.example.com',
]);
assert.deepEqual(productionPolicy.envEntries, [
  {
    key: 'ALLOWED_ORIGINS',
    origins: ['https://hub.example.com', 'https://hub.example.com'],
  },
  {
    key: 'GPT_VISUALIZER_CLIENT',
    origins: ['https://visualizer.example.com'],
  },
]);
assert.equal(
  getCorsHeadersForPolicy('https://hub.example.com', productionPolicy)['Access-Control-Allow-Origin'],
  'https://hub.example.com'
);
assert.deepEqual(
  getCorsHeadersForPolicy('https://unknown.example.com', productionPolicy),
  {}
);

const developmentPolicy = createCorsPolicy({ nodeEnv: 'development' });
assert.equal(
  getCorsHeadersForPolicy('https://local-device.example.com', developmentPolicy)['Access-Control-Allow-Origin'],
  'https://local-device.example.com'
);
assert.deepEqual(getCorsHeadersForPolicy(null, developmentPolicy), {});

console.log('CORS policy checks passed.');
