import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBlockData, fetchLatestBlock, seedToParameters } from './src/bitcoin/blockFetcher.js';
import { generateHull, computeHydrostatics, validateAndAdjust } from './src/vessel/generator.js';
import { saveVessel, getVesselByBlock, getAllVessels } from './src/database/db.js';
import { generateSVG, generateHydrostaticReport, generateAssemblyGuide, createZIPBundle } from './src/outputs/generator.js';
import { generateLandlordAddress, getOwnershipInfo, generateOwnershipCertificate, markRoyaltyPaid } from './src/royalty/bitmap.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('data/exports'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'VesselForge API' });
});

// Get latest Bitcoin block info
app.get('/api/block/latest', async (req, res) => {
  try {
    const blockData = await fetchLatestBlock();
    res.json(blockData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Bitcoin block info
app.get('/api/block/:identifier', async (req, res) => {
  try {
    const blockData = await fetchBlockData(req.params.identifier);
    res.json(blockData);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Generate vessel from block
app.post('/api/vessel/generate', async (req, res) => {
  try {
    const { blockIdentifier, force } = req.body;

    // Fetch block data
    const blockData = blockIdentifier
      ? await fetchBlockData(blockIdentifier)
      : await fetchLatestBlock();

    // Check if vessel already exists
    if (!force) {
      const existing = getVesselByBlock(blockData.height);
      if (existing) {
        return res.status(409).json({
          error: 'Vessel already exists for this block',
          vesselId: existing.id,
          blockHeight: existing.block_height
        });
      }
    }

    // Generate parameters
    const params = seedToParameters(blockData.seed);

    // Generate hull
    let vessel = generateHull(params);

    // Compute hydrostatics
    let hydrostatics = computeHydrostatics(vessel, params.Draft);

    // Validate and adjust
    let finalParams = params;
    let adjustments = [];
    let adjusted = false;

    if (hydrostatics.GM < 0.3) {
      const result = validateAndAdjust(vessel, params, hydrostatics);
      if (result.adjusted) {
        adjusted = true;
        adjustments = result.adjustments;
        finalParams = result.params;
        hydrostatics = result.hydrostatics;
        vessel = generateHull(finalParams);
      }
    }

    // Generate ownership info
    const landlordAddress = generateLandlordAddress(blockData.seed);
    const ownershipInfo = getOwnershipInfo(blockData.height, blockData.seed);

    // Save to database
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

    // Create output bundle
    const outputDir = path.join(__dirname, 'data/exports');
    const zipPath = await createZIPBundle(vessel, vesselData, outputDir);

    res.json({
      success: true,
      vesselId: vesselId,
      blockHeight: blockData.height,
      blockHash: blockData.hash,
      params: finalParams,
      hydrostatics: hydrostatics,
      adjusted: adjusted,
      adjustments: adjustments,
      ownership: {
        landlordAddress: landlordAddress,
        royaltyPaid: ownershipInfo.royaltyPaid
      },
      downloadUrl: `/vessel_block_${blockData.height}.zip`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vessel by block height
app.get('/api/vessel/:blockHeight', (req, res) => {
  try {
    const vessel = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    res.json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all vessels
app.get('/api/vessels', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const vessels = getAllVessels(limit);
    res.json(vessels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vessel SVG line plan
app.get('/api/vessel/:blockHeight/svg', (req, res) => {
  try {
    const vesselRecord = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vesselRecord) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const params = {
      LOA: vesselRecord.loa,
      BOA: vesselRecord.boa,
      Depth: vesselRecord.depth,
      Draft: vesselRecord.draft
    };

    const vessel = generateHull(params);
    const svg = generateSVG(vessel, params);

    res.type('image/svg+xml');
    res.send(svg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get hydrostatic report
app.get('/api/vessel/:blockHeight/report', (req, res) => {
  try {
    const vesselRecord = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vesselRecord) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const vesselData = {
      blockHeight: vesselRecord.block_height,
      blockHash: vesselRecord.block_hash,
      seed: vesselRecord.seed,
      params: {
        LOA: vesselRecord.loa,
        BOA: vesselRecord.boa,
        Depth: vesselRecord.depth,
        Draft: vesselRecord.draft
      },
      hydrostatics: {
        displacement: vesselRecord.displacement,
        volume: vesselRecord.volume,
        LCB: vesselRecord.lcb,
        LCF: vesselRecord.lcf,
        GM: vesselRecord.gm,
        KB: 0,
        KG: 0,
        BMT: 0,
        BML: 0
      },
      adjustments: vesselRecord.adjustments
    };

    const report = generateHydrostaticReport(vesselData);
    res.type('text/plain');
    res.send(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get assembly guide
app.get('/api/vessel/:blockHeight/assembly', (req, res) => {
  try {
    const vesselRecord = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vesselRecord) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const vesselData = {
      blockHeight: vesselRecord.block_height,
      blockHash: vesselRecord.block_hash,
      params: {
        LOA: vesselRecord.loa,
        BOA: vesselRecord.boa,
        Depth: vesselRecord.depth,
        Draft: vesselRecord.draft
      },
      hydrostatics: {
        displacement: vesselRecord.displacement
      }
    };

    const guide = generateAssemblyGuide(vesselData);
    res.type('text/markdown');
    res.send(guide);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ownership certificate
app.get('/api/vessel/:blockHeight/certificate', (req, res) => {
  try {
    const vesselRecord = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vesselRecord) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const vesselData = {
      blockHeight: vesselRecord.block_height,
      blockHash: vesselRecord.block_hash,
      seed: vesselRecord.seed,
      params: {
        LOA: vesselRecord.loa,
        BOA: vesselRecord.boa,
        Depth: vesselRecord.depth,
        Draft: vesselRecord.draft
      },
      hydrostatics: {
        displacement: vesselRecord.displacement
      }
    };

    const certificate = generateOwnershipCertificate(vesselData);
    res.type('text/plain');
    res.send(certificate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark royalty as paid
app.post('/api/vessel/:blockHeight/royalty', (req, res) => {
  try {
    const blockHeight = parseInt(req.params.blockHeight);
    const { txHash } = req.body;

    const vessel = getVesselByBlock(blockHeight);
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const payment = markRoyaltyPaid(blockHeight, txHash);
    res.json({
      success: true,
      payment: payment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download ZIP bundle
app.get('/api/vessel/:blockHeight/download', async (req, res) => {
  try {
    const vesselRecord = getVesselByBlock(parseInt(req.params.blockHeight));
    if (!vesselRecord) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    const zipPath = path.join(__dirname, 'data/exports', `vessel_block_${vesselRecord.block_height}.zip`);
    
    if (!fs.existsSync(zipPath)) {
      // Regenerate if missing
      const params = {
        LOA: vesselRecord.loa,
        BOA: vesselRecord.boa,
        Depth: vesselRecord.depth,
        Draft: vesselRecord.draft
      };
      
      const vessel = generateHull(params);
      const vesselData = {
        blockHeight: vesselRecord.block_height,
        blockHash: vesselRecord.block_hash,
        seed: vesselRecord.seed,
        params: params,
        hydrostatics: {
          displacement: vesselRecord.displacement,
          volume: vesselRecord.volume,
          LCB: vesselRecord.lcb,
          LCF: vesselRecord.lcf,
          GM: vesselRecord.gm,
          KB: 0,
          KG: 0,
          BMT: 0,
          BML: 0
        },
        adjusted: vesselRecord.adjusted,
        adjustments: vesselRecord.adjustments
      };
      
      const outputDir = path.join(__dirname, 'data/exports');
      await createZIPBundle(vessel, vesselData, outputDir);
    }

    res.download(zipPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔨 VesselForge API Server`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/vessels\n`);
});
