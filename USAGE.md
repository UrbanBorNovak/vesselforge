# VesselForge Usage Examples

## Quick Start

### Generate a vessel from the latest Bitcoin block
```bash
npm start
```

### Generate a vessel from a specific block height
```bash
npm start 800000
```

### Generate a vessel from a block hash
```bash
npm start 00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054
```

## API Server Examples

### Start the server
```bash
npm run server
```

### Health check
```bash
curl http://localhost:3000/health
```

### Get latest block info
```bash
curl http://localhost:3000/api/block/latest
```

### Generate a vessel via API
```bash
curl -X POST http://localhost:3000/api/vessel/generate \
  -H "Content-Type: application/json" \
  -d '{"blockIdentifier": 800000}'
```

### List all vessels
```bash
curl http://localhost:3000/api/vessels
```

### Get vessel data
```bash
curl http://localhost:3000/api/vessel/800000
```

### Get SVG line plan
```bash
curl http://localhost:3000/api/vessel/800000/svg > lineplan.svg
```

### Get hydrostatic report
```bash
curl http://localhost:3000/api/vessel/800000/report
```

### Get assembly guide
```bash
curl http://localhost:3000/api/vessel/800000/assembly
```

### Download ZIP bundle
```bash
curl -O http://localhost:3000/api/vessel/800000/download
```

### Mark royalty as paid
```bash
curl -X POST http://localhost:3000/api/vessel/800000/royalty \
  -H "Content-Type: application/json" \
  -d '{"txHash": "your_transaction_hash_here"}'
```

## Output Files

Each vessel generation creates:
- `vessel.json` - Complete vessel data including structure, parameters, and hydrostatics
- `lineplan.svg` - Visual line plan showing profile and plan views
- `hydrostatic_report.txt` - Detailed hydrostatic and stability analysis
- `assembly_guide.md` - Comprehensive step-by-step construction guide
- `vessel_block_[height].zip` - ZIP bundle containing all files

Files are saved to `data/exports/block_[height]/`

## Database

VesselForge uses SQLite to store all generated vessels.

### View database
```bash
sqlite3 data/vessels.db "SELECT id, block_height, loa, boa, gm FROM vessels;"
```

### Export to CSV
```bash
sqlite3 data/vessels.db -header -csv "SELECT * FROM vessels;" > vessels.csv
```

## Development

### Run with auto-reload
```bash
npm run dev
```

### Enable mock mode (use offline data)
```bash
MOCK_MODE=true npm start
```

## Tips

1. **Rate Limits**: The mempool.space API has rate limits. If you get errors, wait a moment before retrying.

2. **Mock Mode**: If you don't have internet access, the system automatically falls back to mock data.

3. **Unique Blocks**: Each block generates a unique vessel. Try different blocks to see different designs.

4. **Stability**: All vessels are automatically validated for GM >= 0.3m. If a design doesn't meet criteria, parameters are adjusted.

5. **Reproducibility**: The same block will always generate the same vessel design (deterministic).

## Troubleshooting

### Database locked
If you get a "database is locked" error, close any other processes accessing the database.

### Port in use
If port 3000 is already in use, set a different port:
```bash
PORT=3001 npm run server
```

### Missing dependencies
```bash
npm install
```

## Examples with jq

### Get just the parameters
```bash
curl -s http://localhost:3000/api/vessel/800000 | jq '{LOA: .loa, BOA: .boa, GM: .gm}'
```

### List vessels with specific fields
```bash
curl -s http://localhost:3000/api/vessels | jq '.[] | {block: .block_height, loa: .loa, gm: .gm}'
```

### Check stability status
```bash
curl -s http://localhost:3000/api/vessels | jq '.[] | select(.gm >= 0.3) | {block: .block_height, gm: .gm, status: "STABLE"}'
```
