import axios from 'axios';
import crypto from 'crypto';
import { getMockBlock, shouldUseMockData } from './mockData.js';

/**
 * Fetch Bitcoin block data from mempool.space API
 * @param {number|string} blockIdentifier - Block height or hash
 * @returns {Promise<{height: number, hash: string, seed: string}>}
 */
export async function fetchBlockData(blockIdentifier) {
  // Use mock data if no internet or in test mode
  if (shouldUseMockData()) {
    console.log('   (Using mock data - no internet access)');
    return getMockBlock(blockIdentifier);
  }

  try {
    let blockHash;
    let blockHeight;

    // If it's a number, fetch block hash from height
    if (!isNaN(blockIdentifier)) {
      blockHeight = parseInt(blockIdentifier);
      const response = await axios.get(
        `https://mempool.space/api/block-height/${blockHeight}`,
        { timeout: 10000 }
      );
      blockHash = response.data;
    } else {
      // If it's a hash, use it directly
      blockHash = blockIdentifier;
    }

    // Fetch full block data
    const blockResponse = await axios.get(
      `https://mempool.space/api/block/${blockHash}`,
      { timeout: 10000 }
    );

    const blockData = blockResponse.data;
    blockHeight = blockData.height;

    // Derive SHA256 seed from block hash
    const seed = crypto.createHash('sha256').update(blockHash).digest('hex');

    return {
      height: blockHeight,
      hash: blockHash,
      seed: seed,
      timestamp: blockData.timestamp
    };
  } catch (error) {
    // Fallback to mock data on network error
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('   (Network unavailable - using mock data)');
      return getMockBlock(blockIdentifier);
    }
    if (error.response?.status === 404) {
      throw new Error(`Block not found: ${blockIdentifier}`);
    }
    throw new Error(`Failed to fetch block data: ${error.message}`);
  }
}

/**
 * Get the latest block data
 * @returns {Promise<{height: number, hash: string, seed: string}>}
 */
export async function fetchLatestBlock() {
  // Use mock data if no internet or in test mode
  if (shouldUseMockData()) {
    console.log('   (Using mock data - no internet access)');
    return getMockBlock('latest');
  }

  try {
    const response = await axios.get(
      'https://mempool.space/api/blocks/tip/height',
      { timeout: 10000 }
    );
    const latestHeight = response.data;
    return await fetchBlockData(latestHeight);
  } catch (error) {
    // Fallback to mock data on network error
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('   (Network unavailable - using mock data)');
      return getMockBlock('latest');
    }
    throw new Error(`Failed to fetch latest block: ${error.message}`);
  }
}

/**
 * Generate deterministic parameters from seed
 * @param {string} seed - Hex seed string
 * @returns {object} - Vessel parameters
 */
export function seedToParameters(seed) {
  // Use seed to generate deterministic values
  const hash = Buffer.from(seed, 'hex');
  
  // Extract values from hash bytes and scale them
  const LOA = 5 + (hash[0] / 255) * 3; // 5-8 meters
  const BOA = 1.5 + (hash[1] / 255) * 1; // 1.5-2.5 meters
  const Depth = 0.8 + (hash[2] / 255) * 0.7; // 0.8-1.5 meters
  const Draft = 0.3 + (hash[3] / 255) * 0.4; // 0.3-0.7 meters
  
  return {
    LOA: parseFloat(LOA.toFixed(2)),
    BOA: parseFloat(BOA.toFixed(2)),
    Depth: parseFloat(Depth.toFixed(2)),
    Draft: parseFloat(Draft.toFixed(2))
  };
}
