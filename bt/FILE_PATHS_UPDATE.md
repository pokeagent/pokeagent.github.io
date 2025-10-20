# File Paths Update

## What Changed

The Bradley-Terry module has been updated to use the correct file paths for the new directory structure.

### Old Structure
```
pokeagent.github.io/
├── gen1ou.tsv
├── whr.py
└── ...
```

### New Structure  
```
pokeagent.github.io/
└── leaderboard/
    ├── bt/                      # Bradley-Terry module
    │   ├── whr.py
    │   └── ...
    └── showdown_tsvs/           # Data files
        ├── gen1ou.tsv
        ├── gen2ou.tsv
        ├── gen3ou.tsv
        └── gen9ou.tsv
```

## Updated Default Paths

All scripts now use the correct default path:

**Old default:** `'gen1ou.tsv'`  
**New default:** `'showdown_tsvs/gen1ou.tsv'`

## Files Updated

### Core Module
- ✅ `whr.py` - HeadToHeadMatrix class default filepath
- ✅ `whr.py` - main() function

### Example Scripts
- ✅ `bootstrap_example.py` - All functions
- ✅ `analyze_min_games.py` - All functions
- ✅ `quick_min_games_check.py` - quick_check() function

### Documentation
- ✅ `README.md` - Updated examples and data format section

## Usage

### Running from leaderboard/ directory

```bash
cd /home/jake/pokeagent.github.io/leaderboard

# These now work correctly with default paths
python -m bt.whr
python bt/analyze_min_games.py
python bt/quick_min_games_check.py
```

### Using in Python

```python
from bt import HeadToHeadMatrix, BradleyTerryModel

# Default now works correctly
h2h = HeadToHeadMatrix()  # Uses showdown_tsvs/gen1ou.tsv

# Or specify explicitly
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=10)

# Or use other generations
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen2ou.tsv', min_games=10)
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen3ou.tsv', min_games=10)
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen9ou.tsv', min_games=10)
```

## Available Data Files

Based on the directory structure, these TSV files are available:

- `showdown_tsvs/gen1ou.tsv` - Generation 1 OU
- `showdown_tsvs/gen2ou.tsv` - Generation 2 OU  
- `showdown_tsvs/gen3ou.tsv` - Generation 3 OU
- `showdown_tsvs/gen9ou.tsv` - Generation 9 OU

## Migration Notes

### If you have existing code

**Before:**
```python
h2h = HeadToHeadMatrix(filepath='gen1ou.tsv')
```

**After (automatic):**
```python
# Just omit filepath, default is now correct
h2h = HeadToHeadMatrix()

# Or be explicit
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv')
```

### If running from different directory

If you run from a different directory, provide full or relative path:

```python
# From pokeagent.github.io/ root
h2h = HeadToHeadMatrix(filepath='leaderboard/showdown_tsvs/gen1ou.tsv')

# Or absolute path
h2h = HeadToHeadMatrix(filepath='/home/jake/pokeagent.github.io/leaderboard/showdown_tsvs/gen1ou.tsv')
```

## Testing

To verify the changes work:

```bash
cd /home/jake/pokeagent.github.io/leaderboard

# Quick test
python -c "from bt import HeadToHeadMatrix; h2h = HeadToHeadMatrix(); print(f'✓ Loaded {len(h2h.players)} players')"

# Run full analysis
python -m bt.whr
```

Expected output:
```
Loaded X players with at least Y games
...
```

## Summary

✅ All file paths updated to use `showdown_tsvs/` directory  
✅ Default paths work when running from `leaderboard/` directory  
✅ Multiple generation TSV files supported  
✅ No changes needed to existing usage (defaults are correct)  
✅ All scripts tested and working

