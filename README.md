# VesselForge 🔨⛵

Bitcoin Vessel Forge - Generate deterministic boat designs from Bitcoin blockchain data.

## Overview

VesselForge is a unique application that generates boat designs by deriving parameters from Bitcoin block data. Each block produces a unique, deterministic vessel design with complete hydrostatic analysis, stability validation, and construction documentation.

## Features

- 🔗 **Blockchain Integration**: Fetches Bitcoin block data from mempool.space
- ⚓ **Naval Architecture**: Uses Vessel.js for hydrostatic and stability calculations
- 🎲 **Deterministic Generation**: SHA256 seed from block hash generates unique vessel parameters
- 📊 **Stability Validation**: Automatically adjusts parameters when GM < 0.3m
- 📦 **Complete Output Bundle**: JSON, SVG line plans, hydrostatic reports, assembly guides, ZIP archives
- 💾 **SQLite Database**: Stores all generated designs with metadata
- 🔑 **Mock Ownership System**: Bitmap-based ownership and royalty tracking
- 🌐 **REST API**: Express server with full API endpoints
- 🖥️ **CLI Tool**: Simple command-line interface

## Installation

```bash
npm install
```

## Usage

### CLI Mode

Generate a vessel from the latest Bitcoin block:
```bash
npm start
```

Generate from a specific block height:
```bash
npm start 800000
```

Generate from a specific block hash:
```bash
npm start 00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054
```

### API Server Mode

Start the API server:
```bash
npm run server
```

The server runs on port 3000 by default.

## API Endpoints

### Block Information
- `GET /api/block/latest` - Get latest Bitcoin block data
- `GET /api/block/:identifier` - Get block by height or hash

### Vessel Generation
- `POST /api/vessel/generate` - Generate vessel from block
  ```json
  {
    "blockIdentifier": 800000,
    "force": false
  }
  ```

### Vessel Data
- `GET /api/vessels` - List all generated vessels
- `GET /api/vessel/:blockHeight` - Get vessel data
- `GET /api/vessel/:blockHeight/svg` - Get SVG line plan
- `GET /api/vessel/:blockHeight/report` - Get hydrostatic report
- `GET /api/vessel/:blockHeight/assembly` - Get assembly guide
- `GET /api/vessel/:blockHeight/certificate` - Get ownership certificate
- `GET /api/vessel/:blockHeight/download` - Download ZIP bundle

### Royalty Management
- `POST /api/vessel/:blockHeight/royalty` - Mark royalty as paid
  ```json
  {
    "txHash": "transaction_hash_here"
  }
  ```

## Project Structure

```
vesselforge/
├── src/
│   ├── bitcoin/        # Bitcoin block fetching and seed generation
│   ├── vessel/         # Vessel.js hull generation and hydrostatics
│   ├── database/       # SQLite database operations
│   ├── outputs/        # SVG, reports, ZIP bundle generation
│   └── royalty/        # Mock bitmap ownership system
├── templates/          # Assembly guide template
├── data/
│   ├── vessels.db      # SQLite database
│   └── exports/        # Generated vessel files
├── index.js            # CLI entry point
├── server.js           # Express API server
└── package.json
```

## How It Works

1. **Block Fetching**: Retrieves Bitcoin block data from mempool.space API
2. **Seed Generation**: Creates SHA256 hash from block hash
3. **Parameter Derivation**: Deterministically generates vessel dimensions (LOA, BOA, Depth, Draft)
4. **Hull Generation**: Uses Vessel.js with offsets table to create hull geometry
5. **Hydrostatics**: Calculates displacement, centers, metacentric height (GM)
6. **Stability Validation**: Adjusts parameters if GM < 0.3m (minimum stability criterion)
7. **Output Generation**: Creates JSON, SVG line plan, hydrostatic report, assembly guide
8. **Database Storage**: Saves all data to SQLite
9. **Bundle Creation**: Packages everything into a ZIP file

## Stability Criteria

VesselForge ensures that all generated vessels meet minimum stability requirements:
- **GM (Metacentric Height)**: Must be ≥ 0.3m
- **Adjustment Strategy**: If GM < 0.3m, increases BOA and/or Draft
- **Validation**: Uses Vessel.js hydrostatic calculations

## Output Files

For each vessel, VesselForge generates:
- `vessel.json` - Complete vessel data and structure
- `lineplan.svg` - Visual line plan (profile and plan views)
- `hydrostatic_report.txt` - Detailed hydrostatic analysis
- `assembly_guide.md` - Step-by-step construction guide
- `vessel_block_[height].zip` - Compressed bundle of all files

## Database Schema

```sql
CREATE TABLE vessels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_height INTEGER NOT NULL UNIQUE,
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Technical Details

### Dependencies
- **express**: Web server framework
- **better-sqlite3**: SQLite database
- **vesseljs**: Naval architecture calculations
- **axios**: HTTP client for API calls
- **archiver**: ZIP file creation

### Vessel Types
Currently generates small tender hulls with characteristics:
- LOA: 5-8 meters
- BOA: 1.5-2.5 meters  
- Depth: 0.8-1.5 meters
- Draft: 0.3-0.7 meters

### Hydrostatic Calculations
Uses simplified naval architecture formulas:
- Prismatic coefficient (Cp): 0.60
- Block coefficient (Cb): 0.45
- Waterplane coefficient: 0.75

## Mock Ownership System

VesselForge includes a mock bitmap ownership system for demonstration:
- Generates deterministic "landlord" Bitcoin addresses
- Tracks royalty payment status
- Calculates mock royalty amounts (0.01 BTC/tonne)
- Issues ownership certificates

**Note**: This is a demonstration system only, not connected to real blockchain.

## Development

### Run in development mode with auto-reload:
```bash
npm run dev
```

### File Structure Guidelines
- Keep modules focused and single-purpose
- Use ES6 module syntax
- Include error handling in all async functions
- Document functions with JSDoc comments

## Limitations

- Uses mempool.space public API (rate limits may apply)
- Vessel.js hydrostatic calculations are simplified
- Stability adjustments use heuristic methods
- SVG line plans are basic representations
- Ownership system is for demonstration only

## Future Enhancements

- Advanced hull forms (sailboats, powerboats)
- More detailed hydrostatic analysis
- 3D model generation
- Real blockchain integration for ownership
- Web UI for visualization
- Export to CAD formats

## License

MIT

## Credits

Created by Urban for the Bitcoin Vessel Forge project.

Built with:
- Bitcoin blockchain data
- Vessel.js naval architecture library
- mempool.space API

## Disclaimer

Generated vessel designs are for educational and experimental purposes. Any vessel built from these plans should be reviewed by a qualified naval architect and meet all applicable safety regulations before use.
