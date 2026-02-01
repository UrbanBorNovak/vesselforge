import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate SVG line plan for the vessel
 * @param {object} vessel - Vessel instance
 * @param {object} params - Vessel parameters
 * @returns {string} - SVG content
 */
export function generateSVG(vessel, params) {
  const { LOA, BOA, Depth } = params;
  
  // SVG dimensions and scaling
  const width = 800;
  const height = 400;
  const margin = 50;
  const scale = Math.min((width - 2 * margin) / LOA, (height - 2 * margin) / Math.max(BOA, Depth));

  // Get hull offsets
  const offsets = vessel.structure?.hull?.offsets || [];

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .hull-line { stroke: #2c3e50; stroke-width: 2; fill: none; }
    .waterline { stroke: #3498db; stroke-width: 1.5; stroke-dasharray: 5,5; fill: none; }
    .station { stroke: #95a5a6; stroke-width: 0.5; }
    .text { font-family: Arial, sans-serif; font-size: 12px; fill: #2c3e50; }
    .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #2c3e50; }
  </style>
  
  <!-- Title -->
  <text x="${width / 2}" y="25" text-anchor="middle" class="title">Vessel Line Plan</text>
  
  <!-- Profile View -->
  <g transform="translate(${margin}, ${height / 2 - 50})">
    <text x="0" y="-20" class="text">Profile View</text>
`;

  // Draw profile (side view)
  if (offsets.length > 0) {
    // Deck line
    let deckPath = `M ${0},${-Depth * scale}`;
    offsets.forEach(station => {
      deckPath += ` L ${station.x * scale},${-Depth * scale}`;
    });
    svg += `    <path d="${deckPath}" class="hull-line"/>\n`;

    // Keel line
    let keelPath = `M ${0},${0}`;
    offsets.forEach(station => {
      keelPath += ` L ${station.x * scale},${0}`;
    });
    svg += `    <path d="${keelPath}" class="hull-line"/>\n`;

    // Bow and stern
    svg += `    <line x1="0" y1="0" x2="0" y2="${-Depth * scale}" class="hull-line"/>\n`;
    svg += `    <line x1="${LOA * scale}" y1="0" x2="${LOA * scale}" y2="${-Depth * scale}" class="hull-line"/>\n`;

    // Waterline
    svg += `    <line x1="0" y1="${-params.Draft * scale}" x2="${LOA * scale}" y2="${-params.Draft * scale}" class="waterline"/>\n`;
  }

  svg += `  </g>
  
  <!-- Plan View -->
  <g transform="translate(${margin}, ${height - margin - 10})">
    <text x="0" y="-${BOA * scale + 20}" class="text">Plan View</text>
`;

  // Draw plan (top view - half breadth)
  if (offsets.length > 0) {
    // Centerline
    svg += `    <line x1="0" y1="0" x2="${LOA * scale}" y2="0" class="station"/>\n`;

    // Port side
    let portPath = `M ${0},${0}`;
    offsets.forEach(station => {
      const breadth = station.halfBreadths && station.halfBreadths[0] 
        ? station.halfBreadths[0] * scale 
        : 0;
      portPath += ` L ${station.x * scale},${-breadth}`;
    });
    svg += `    <path d="${portPath}" class="hull-line"/>\n`;

    // Starboard side (mirror)
    let starboardPath = `M ${0},${0}`;
    offsets.forEach(station => {
      const breadth = station.halfBreadths && station.halfBreadths[0]
        ? station.halfBreadths[0] * scale
        : 0;
      starboardPath += ` L ${station.x * scale},${breadth}`;
    });
    svg += `    <path d="${starboardPath}" class="hull-line"/>\n`;
  }

  svg += `  </g>
  
  <!-- Dimensions -->
  <text x="${width - margin}" y="${height - 10}" text-anchor="end" class="text">LOA: ${LOA}m | BOA: ${BOA}m | Depth: ${Depth}m</text>
</svg>`;

  return svg;
}

/**
 * Generate hydrostatic report
 * @param {object} data - Complete vessel data
 * @returns {string} - Report content
 */
export function generateHydrostaticReport(data) {
  const { blockHeight, blockHash, seed, params, hydrostatics, adjustments } = data;

  let report = `VESSEL HYDROSTATIC REPORT
${'='.repeat(60)}

BITCOIN BLOCK DATA
  Block Height: ${blockHeight}
  Block Hash:   ${blockHash}
  Seed:         ${seed}

PRINCIPAL DIMENSIONS
  Length Overall (LOA):     ${params.LOA.toFixed(2)} m
  Beam Overall (BOA):       ${params.BOA.toFixed(2)} m
  Depth:                    ${params.Depth.toFixed(2)} m
  Design Draft:             ${params.Draft.toFixed(2)} m

HYDROSTATIC PROPERTIES
  Displacement:             ${hydrostatics.displacement.toFixed(3)} tonnes
  Volume:                   ${hydrostatics.volume.toFixed(3)} m³
  LCB (from bow):           ${hydrostatics.LCB.toFixed(3)} m
  LCF (from bow):           ${hydrostatics.LCF.toFixed(3)} m

STABILITY
  KB (center of buoyancy):  ${hydrostatics.KB.toFixed(3)} m
  KG (center of gravity):   ${hydrostatics.KG.toFixed(3)} m
  BMT (transverse):         ${hydrostatics.BMT.toFixed(3)} m
  BML (longitudinal):       ${hydrostatics.BML.toFixed(3)} m
  KM (metacenter):          ${hydrostatics.KM.toFixed(3)} m
  GM (metacentric height):  ${hydrostatics.GM.toFixed(3)} m
  
  Status: ${hydrostatics.GM >= 0.3 ? '✓ STABLE (GM >= 0.3m)' : '✗ UNSTABLE (GM < 0.3m)'}
`;

  if (adjustments && adjustments.length > 0) {
    report += `\nADJUSTMENTS MADE
`;
    adjustments.forEach(adj => {
      report += `  - ${adj}\n`;
    });
  }

  report += `\n${'='.repeat(60)}
Generated by VesselForge
`;

  return report;
}

/**
 * Generate assembly guide from template
 * @param {object} data - Vessel data
 * @returns {string} - Markdown content
 */
export function generateAssemblyGuide(data) {
  const templatePath = path.join(__dirname, '../../templates/assembly.md');
  
  try {
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders
    template = template
      .replace(/\{\{blockHeight\}\}/g, data.blockHeight)
      .replace(/\{\{blockHash\}\}/g, data.blockHash)
      .replace(/\{\{LOA\}\}/g, data.params.LOA.toFixed(2))
      .replace(/\{\{BOA\}\}/g, data.params.BOA.toFixed(2))
      .replace(/\{\{Depth\}\}/g, data.params.Depth.toFixed(2))
      .replace(/\{\{Draft\}\}/g, data.params.Draft.toFixed(2))
      .replace(/\{\{displacement\}\}/g, data.hydrostatics.displacement.toFixed(3));

    return template;
  } catch (error) {
    // If template doesn't exist, return a basic guide
    return generateDefaultAssemblyGuide(data);
  }
}

/**
 * Generate default assembly guide if template is missing
 */
function generateDefaultAssemblyGuide(data) {
  return `# Vessel Assembly Guide

## Vessel Specifications
- **Block Height**: ${data.blockHeight}
- **Length Overall**: ${data.params.LOA.toFixed(2)} m
- **Beam Overall**: ${data.params.BOA.toFixed(2)} m
- **Depth**: ${data.params.Depth.toFixed(2)} m
- **Draft**: ${data.params.Draft.toFixed(2)} m
- **Displacement**: ${data.hydrostatics.displacement.toFixed(3)} tonnes

## Materials Required
- Marine plywood (suitable for hull construction)
- Epoxy resin and hardener
- Fiberglass cloth
- Fasteners (screws, bolts)
- Paint or varnish

## Construction Steps

### 1. Prepare the Building Area
Set up a level workspace with adequate ventilation.

### 2. Cut Hull Panels
Using the line plan, cut plywood panels according to the station offsets.

### 3. Assemble the Frame
1. Set up the stations at their proper longitudinal positions
2. Ensure all stations are plumb and square
3. Install longitudinal stringers

### 4. Plank the Hull
1. Start from the keel and work toward the sheer
2. Use clamps and temporary fasteners
3. Fair the surface between planks

### 5. Fiberglassing
1. Apply epoxy to all seams
2. Lay fiberglass cloth over the hull
3. Saturate with epoxy resin
4. Allow to cure per manufacturer instructions

### 6. Finishing
1. Sand the hull smooth
2. Apply primer
3. Apply finish coat of paint or varnish

### 7. Install Fittings
Add required hardware, seating, and safety equipment.

## Safety Notes
- Always wear appropriate safety equipment
- Work in well-ventilated areas when using epoxy
- Follow all local boating regulations
- Have the completed vessel inspected before launching

---
*Generated by VesselForge from Bitcoin Block ${data.blockHeight}*
`;
}

/**
 * Create ZIP bundle with all outputs
 * @param {object} vessel - Vessel instance
 * @param {object} data - Complete vessel data
 * @param {string} outputDir - Output directory path
 * @returns {Promise<string>} - Path to created ZIP file
 */
export async function createZIPBundle(vessel, data, outputDir) {
  const exportDir = path.join(outputDir, `block_${data.blockHeight}`);
  
  // Create export directory
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Generate and save all files
  const vesselJSON = JSON.stringify({
    block: {
      height: data.blockHeight,
      hash: data.blockHash,
      seed: data.seed
    },
    parameters: data.params,
    hydrostatics: data.hydrostatics,
    adjusted: data.adjusted,
    adjustments: data.adjustments,
    structure: vessel.structure
  }, null, 2);

  fs.writeFileSync(path.join(exportDir, 'vessel.json'), vesselJSON);
  fs.writeFileSync(path.join(exportDir, 'lineplan.svg'), generateSVG(vessel, data.params));
  fs.writeFileSync(path.join(exportDir, 'hydrostatic_report.txt'), generateHydrostaticReport(data));
  fs.writeFileSync(path.join(exportDir, 'assembly_guide.md'), generateAssemblyGuide(data));

  // Create ZIP
  const zipPath = path.join(outputDir, `vessel_block_${data.blockHeight}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(exportDir, false);
    archive.finalize();
  });
}
