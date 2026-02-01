import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/vessels.db');

/**
 * Initialize the database and create tables
 */
export function initDatabase() {
  const db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS vessels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_height INTEGER NOT NULL,
      block_hash TEXT NOT NULL,
      seed TEXT NOT NULL,
      loa REAL NOT NULL,
      boa REAL NOT NULL,
      depth REAL NOT NULL,
      draft REAL NOT NULL,
      displacement REAL NOT NULL,
      volume REAL NOT NULL,
      lcb REAL NOT NULL,
      lcf REAL NOT NULL,
      gm REAL NOT NULL,
      landlord_address TEXT,
      royalty_paid BOOLEAN DEFAULT 0,
      adjusted BOOLEAN DEFAULT 0,
      adjustments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(block_height)
    )
  `);

  return db;
}

/**
 * Save a vessel design to the database
 * @param {object} data - Vessel data to save
 * @returns {number} - Inserted row ID
 */
export function saveVessel(data) {
  const db = initDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO vessels (
        block_height, block_hash, seed,
        loa, boa, depth, draft,
        displacement, volume, lcb, lcf, gm,
        landlord_address, royalty_paid, adjusted, adjustments
      ) VALUES (
        @blockHeight, @blockHash, @seed,
        @loa, @boa, @depth, @draft,
        @displacement, @volume, @lcb, @lcf, @gm,
        @landlordAddress, @royaltyPaid, @adjusted, @adjustments
      )
    `);

    const result = stmt.run({
      blockHeight: data.blockHeight,
      blockHash: data.blockHash,
      seed: data.seed,
      loa: data.params.LOA,
      boa: data.params.BOA,
      depth: data.params.Depth,
      draft: data.params.Draft,
      displacement: data.hydrostatics.displacement,
      volume: data.hydrostatics.volume,
      lcb: data.hydrostatics.LCB,
      lcf: data.hydrostatics.LCF,
      gm: data.hydrostatics.GM,
      landlordAddress: data.landlordAddress || null,
      royaltyPaid: data.royaltyPaid ? 1 : 0,
      adjusted: data.adjusted ? 1 : 0,
      adjustments: data.adjustments ? JSON.stringify(data.adjustments) : null
    });

    return result.lastInsertRowid;
  } finally {
    db.close();
  }
}

/**
 * Get a vessel by block height
 * @param {number} blockHeight - Block height
 * @returns {object|null} - Vessel data or null
 */
export function getVesselByBlock(blockHeight) {
  const db = initDatabase();
  
  try {
    const stmt = db.prepare('SELECT * FROM vessels WHERE block_height = ?');
    const row = stmt.get(blockHeight);
    
    if (row && row.adjustments) {
      row.adjustments = JSON.parse(row.adjustments);
    }
    
    return row;
  } finally {
    db.close();
  }
}

/**
 * Get all vessels
 * @param {number} limit - Maximum number of vessels to return
 * @returns {Array} - Array of vessel data
 */
export function getAllVessels(limit = 100) {
  const db = initDatabase();
  
  try {
    const stmt = db.prepare('SELECT * FROM vessels ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit);
    
    return rows.map(row => {
      if (row.adjustments) {
        row.adjustments = JSON.parse(row.adjustments);
      }
      return row;
    });
  } finally {
    db.close();
  }
}

/**
 * Delete a vessel by ID
 * @param {number} id - Vessel ID
 * @returns {boolean} - Success status
 */
export function deleteVessel(id) {
  const db = initDatabase();
  
  try {
    const stmt = db.prepare('DELETE FROM vessels WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  } finally {
    db.close();
  }
}
