import crypto from 'crypto';

/**
 * Mock Bitcoin block data for testing without internet access
 */
export const MOCK_BLOCKS = {
  800000: {
    height: 800000,
    hash: '00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054',
    timestamp: 1690168494
  },
  800001: {
    height: 800001,
    hash: '00000000000000000003f2a2e4c8b76c5a37902165a270156b7a8d72728b165',
    timestamp: 1690168795
  },
  'latest': {
    height: 825000,
    hash: '00000000000000000004f3a3e5c9b77c5a37902165a270156b7a8d72728c276',
    timestamp: 1705168494
  }
};

/**
 * Get mock block data
 * @param {number|string} blockIdentifier - Block height, hash, or 'latest'
 * @returns {object} - Mock block data with seed
 */
export function getMockBlock(blockIdentifier = 'latest') {
  let blockData;
  
  if (blockIdentifier === 'latest' || !blockIdentifier) {
    blockData = MOCK_BLOCKS.latest;
  } else if (typeof blockIdentifier === 'number' || !isNaN(blockIdentifier)) {
    const height = parseInt(blockIdentifier);
    blockData = MOCK_BLOCKS[height] || MOCK_BLOCKS.latest;
  } else {
    // Find by hash
    blockData = Object.values(MOCK_BLOCKS).find(b => b.hash === blockIdentifier) || MOCK_BLOCKS.latest;
  }

  // Add seed
  const seed = crypto.createHash('sha256').update(blockData.hash).digest('hex');
  
  return {
    ...blockData,
    seed
  };
}

/**
 * Check if running in mock mode
 */
export function shouldUseMockData() {
  return process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
}
