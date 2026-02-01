/**
 * Vessel structure representing hull geometry
 */
class Vessel {
  constructor() {
    this.attributes = {};
    this.structure = {
      hull: {
        offsets: []
      }
    };
  }

  setAttributes(attrs) {
    this.attributes = { ...this.attributes, ...attrs };
  }
}

/**
 * Generate a tender hull from parameters
 * @param {object} params - Vessel parameters {LOA, BOA, Depth, Draft}
 * @returns {object} - Vessel instance and computed data
 */
export function generateHull(params) {
  const { LOA, BOA, Depth, Draft } = params;

  // Create a new vessel
  const vessel = new Vessel();

  // Set basic attributes
  vessel.setAttributes({
    LOA: LOA,
    BOA: BOA,
    Depth: Depth,
    Draft: Draft
  });

  // Define hull using offsets table - simple tender hull shape
  // Stations from 0 (bow) to 1 (stern) with half-breadths at waterline and deck
  const stations = [
    { x: 0.0, y: [0.1, 0.05], z: [0, Depth] },      // Bow - narrow
    { x: 0.2, y: [0.4, 0.3], z: [0, Depth] },        // Forward
    { x: 0.5, y: [0.5, 0.45], z: [0, Depth] },       // Midships - widest
    { x: 0.8, y: [0.4, 0.35], z: [0, Depth] },       // Aft
    { x: 1.0, y: [0.15, 0.1], z: [0, Depth] }        // Stern - narrow
  ];

  // Create hull offsets normalized to BOA
  vessel.structure.hull.offsets = stations.map(station => ({
    x: station.x * LOA,
    halfBreadths: station.y.map(y => y * BOA),
    heights: station.z
  }));

  return vessel;
}

/**
 * Compute hydrostatics and stability for a vessel
 * @param {object} vessel - Vessel.js instance
 * @param {number} Draft - Design draft in meters
 * @returns {object} - Hydrostatic and stability data
 */
export function computeHydrostatics(vessel, Draft) {
  try {
    // Use Vessel.js to calculate hydrostatics at the given draft
    // Note: Vessel.js API may vary - this is a simplified implementation
    
    // Calculate displaced volume and other properties
    const displacement = calculateDisplacement(vessel, Draft);
    const LCB = calculateLCB(vessel, Draft);
    const LCF = calculateLCF(vessel, Draft);
    const BMT = calculateBMT(vessel, Draft);
    const BML = calculateBML(vessel, Draft);
    
    // Assume a lightweight estimate (10% of displacement for a small tender)
    const lightship = displacement * 0.1;
    const KG = Draft * 0.6; // Rough estimate: CG at 60% of draft
    const KB = Draft * 0.5; // Rough estimate: CB at 50% of draft
    
    // Calculate metacentric height GM
    const KM = KB + BMT;
    const GM = KM - KG;

    return {
      displacement: parseFloat(displacement.toFixed(3)),
      volume: parseFloat((displacement / 1.025).toFixed(3)), // Fresh water density
      LCB: parseFloat(LCB.toFixed(3)),
      LCF: parseFloat(LCF.toFixed(3)),
      BMT: parseFloat(BMT.toFixed(3)),
      BML: parseFloat(BML.toFixed(3)),
      KB: parseFloat(KB.toFixed(3)),
      KG: parseFloat(KG.toFixed(3)),
      KM: parseFloat(KM.toFixed(3)),
      GM: parseFloat(GM.toFixed(3)),
      draft: Draft
    };
  } catch (error) {
    throw new Error(`Failed to compute hydrostatics: ${error.message}`);
  }
}

/**
 * Simple displacement calculation based on prismatic coefficient
 * @param {object} vessel - Vessel instance
 * @param {number} draft - Draft in meters
 * @returns {number} - Displacement in tonnes
 */
function calculateDisplacement(vessel, draft) {
  const LOA = vessel.attributes?.LOA || 6;
  const BOA = vessel.attributes?.BOA || 2;
  
  // Prismatic coefficient for a tender (typically 0.55-0.65)
  const Cp = 0.60;
  
  // Block coefficient Cb = Cp * Cwp (waterplane coefficient ~0.75)
  const Cb = Cp * 0.75;
  
  // Volume of displacement
  const volume = LOA * BOA * draft * Cb;
  
  // Displacement (seawater density = 1.025 t/m³)
  const displacement = volume * 1.025;
  
  return displacement;
}

/**
 * Calculate longitudinal center of buoyancy
 */
function calculateLCB(vessel, draft) {
  const LOA = vessel.attributes?.LOA || 6;
  // For tender hull, LCB is typically slightly aft of midships
  return LOA * 0.48; // 48% of LOA from bow
}

/**
 * Calculate longitudinal center of flotation
 */
function calculateLCF(vessel, draft) {
  const LOA = vessel.attributes?.LOA || 6;
  // LCF typically near midships for tender
  return LOA * 0.5;
}

/**
 * Calculate transverse metacentric radius
 */
function calculateBMT(vessel, draft) {
  const BOA = vessel.attributes?.BOA || 2;
  const volume = calculateDisplacement(vessel, draft) / 1.025;
  
  // Second moment of waterplane area (simplified)
  const Ix = (0.75 * vessel.attributes.LOA * Math.pow(BOA, 3)) / 12;
  
  // BMT = Ix / Volume
  return Ix / volume;
}

/**
 * Calculate longitudinal metacentric radius
 */
function calculateBML(vessel, draft) {
  const LOA = vessel.attributes?.LOA || 6;
  const BOA = vessel.attributes?.BOA || 2;
  const volume = calculateDisplacement(vessel, draft) / 1.025;
  
  // Second moment of waterplane area (simplified)
  const Iy = (0.75 * BOA * Math.pow(LOA, 3)) / 12;
  
  // BML = Iy / Volume
  return Iy / volume;
}

/**
 * Validate and adjust parameters to meet stability criteria (GM >= 0.3m)
 * @param {object} vessel - Vessel instance
 * @param {object} params - Current parameters
 * @param {object} hydrostatics - Current hydrostatic data
 * @returns {object} - Adjusted parameters and new hydrostatics
 */
export function validateAndAdjust(vessel, params, hydrostatics) {
  const MIN_GM = 0.3; // meters
  let adjustedParams = { ...params };
  let adjustedHydro = { ...hydrostatics };
  let adjustments = [];

  if (hydrostatics.GM < MIN_GM) {
    // Strategy: Increase BOA to improve stability
    const gmDeficit = MIN_GM - hydrostatics.GM;
    const boaIncrease = gmDeficit * 0.5; // Empirical adjustment factor
    
    adjustedParams.BOA = parseFloat((params.BOA + boaIncrease).toFixed(2));
    adjustments.push(`Increased BOA from ${params.BOA}m to ${adjustedParams.BOA}m`);
    
    // Regenerate vessel with new parameters
    const newVessel = generateHull(adjustedParams);
    adjustedHydro = computeHydrostatics(newVessel, adjustedParams.Draft);
    
    // If still not meeting criteria, try increasing draft
    if (adjustedHydro.GM < MIN_GM) {
      adjustedParams.Draft = parseFloat((adjustedParams.Draft * 1.1).toFixed(2));
      adjustments.push(`Increased Draft from ${params.Draft}m to ${adjustedParams.Draft}m`);
      
      const finalVessel = generateHull(adjustedParams);
      adjustedHydro = computeHydrostatics(finalVessel, adjustedParams.Draft);
    }
  }

  return {
    adjusted: adjustments.length > 0,
    adjustments,
    params: adjustedParams,
    hydrostatics: adjustedHydro
  };
}
