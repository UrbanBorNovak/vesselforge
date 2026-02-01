#!/usr/bin/env node

import { fetchBlockData, fetchLatestBlock, seedToParameters } from './src/bitcoin/blockFetcher.js';
import { generateHull, computeHydrostatics, validateAndAdjust } from './src/vessel/generator.js';
import { saveVessel, getVesselByBlock } from './src/database/db.js';
import { createZIPBundle } from './src/outputs/generator.js';
import { generateLandlordAddress, getOwnershipInfo, generateOwnershipCertificate } from './src/royalty/bitmap.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main function to generate vessel from Bitcoin block
 */
async function generateVessel(blockIdentifier) {
  console.log('🔨 VesselForge - Bitcoin Vessel Generator\n');

  try {
    // Step 1: Fetch Bitcoin block data
    console.log('📡 Fetching Bitcoin block data...');
    const blockData = blockIdentifier 
      ? await fetchBlockData(blockIdentifier)
      : await fetchLatestBlock();
    
    console.log(`   ✓ Block #${blockData.height}`);
    console.log(`   ✓ Hash: ${blockData.hash.substring(0, 16)}...`);
    console.log(`   ✓ Seed: ${blockData.seed.substring(0, 16)}...\n`);

    // Check if vessel already exists
    const existingVessel = getVesselByBlock(blockData.height);
    if (existingVessel) {
      console.log(`⚠️  Vessel for block ${blockData.height} already exists in database.`);
      console.log(`   Use --force to regenerate.\n`);
      return;
    }

    // Step 2: Generate vessel parameters from seed
    console.log('🎲 Generating vessel parameters from seed...');
    const params = seedToParameters(blockData.seed);
    console.log(`   ✓ LOA: ${params.LOA} m`);
    console.log(`   ✓ BOA: ${params.BOA} m`);
    console.log(`   ✓ Depth: ${params.Depth} m`);
    console.log(`   ✓ Draft: ${params.Draft} m\n`);

    // Step 3: Generate hull using Vessel.js
    console.log('⛵ Generating hull with Vessel.js...');
    let vessel = generateHull(params);
    console.log('   ✓ Hull offsets table created\n');

    // Step 4: Compute hydrostatics and stability
    console.log('📊 Computing hydrostatics and stability...');
    let hydrostatics = computeHydrostatics(vessel, params.Draft);
    console.log(`   ✓ Displacement: ${hydrostatics.displacement} tonnes`);
    console.log(`   ✓ GM: ${hydrostatics.GM} m\n`);

    // Step 5: Validate and adjust if needed
    let finalParams = params;
    let adjustments = [];
    let adjusted = false;

    if (hydrostatics.GM < 0.3) {
      console.log('⚠️  GM < 0.3m - Adjusting parameters...');
      const result = validateAndAdjust(vessel, params, hydrostatics);
      
      if (result.adjusted) {
        adjusted = true;
        adjustments = result.adjustments;
        finalParams = result.params;
        hydrostatics = result.hydrostatics;
        vessel = generateHull(finalParams);
        
        adjustments.forEach(adj => console.log(`   ✓ ${adj}`));
        console.log(`   ✓ New GM: ${hydrostatics.GM} m\n`);
      }
    } else {
      console.log('✓ Stability criteria met (GM >= 0.3m)\n');
    }

    // Step 6: Generate ownership info
    console.log('🔑 Generating ownership information...');
    const landlordAddress = generateLandlordAddress(blockData.seed);
    const ownershipInfo = getOwnershipInfo(blockData.height, blockData.seed);
    console.log(`   ✓ Landlord address: ${landlordAddress}\n`);

    // Step 7: Save to database
    console.log('💾 Saving to database...');
    const vesselData = {
      blockHeight: blockData.height,
      blockHash: blockData.hash,
      seed: blockData.seed,
      params: finalParams,
      hydrostatics: hydrostatics,
      adjusted: adjusted,
      adjustments: adjustments,
      landlordAddress: landlordAddress,
      royaltyPaid: ownershipInfo.royaltyPaid
    };

    const vesselId = saveVessel(vesselData);
    console.log(`   ✓ Vessel ID: ${vesselId}\n`);

    // Step 8: Generate outputs and ZIP bundle
    console.log('📦 Creating output bundle...');
    const outputDir = path.join(__dirname, 'data/exports');
    const zipPath = await createZIPBundle(vessel, vesselData, outputDir);
    console.log(`   ✓ ZIP bundle: ${zipPath}\n`);

    // Step 9: Display ownership certificate
    console.log('📜 Ownership Certificate:');
    console.log(generateOwnershipCertificate(vesselData));

    console.log('\n✅ Vessel generation complete!\n');
    console.log(`📂 Files saved to: data/exports/block_${blockData.height}/`);
    console.log(`📦 ZIP bundle: ${path.basename(zipPath)}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const blockIdentifier = args[0]; // Can be block height or hash, or undefined for latest

// Run the generator
generateVessel(blockIdentifier);
