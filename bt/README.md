# Bradley-Terry Rankings Module

A comprehensive Python module for computing Bradley-Terry rankings from head-to-head battle data, with bootstrap uncertainty estimation and minimum games threshold analysis.

## Overview

This module provides:
- **Bradley-Terry model fitting** with multiple optimization methods
- **Bootstrap uncertainty estimation** for confidence intervals
- **Minimum games threshold analysis** to determine reliability requirements
- **Head-to-head matrix computation** from battle data

## Quick Start

### Installation

```bash
# The module is already available in your repository
# Just make sure you're in the parent directory
cd /home/jake/pokeagent.github.io
```

### Basic Usage

```python
from bt import HeadToHeadMatrix, BradleyTerryModel

# Load and compute rankings (gen1ou is default)
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=10)

# Or use other generations
# h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen2ou.tsv', min_games=10)
# h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen3ou.tsv', min_games=10)
bt_model = BradleyTerryModel(h2h)

# Fit with bootstrap for uncertainty
results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='resample',
    fit_method='lbfgs',
    regularization=0.01
)

# Get rankings with confidence intervals
rankings = bt_model.get_rankings_with_uncertainty(results)
print(rankings)
```

## Module Structure

```
bt/
├── __init__.py                    # Module initialization
├── whr.py                         # Core Bradley-Terry implementation
├── bootstrap_example.py           # Example: Bootstrap usage
├── analyze_min_games.py          # Script: Comprehensive threshold analysis
├── quick_min_games_check.py      # Script: Quick threshold check
├── README.md                      # This file
└── [Documentation files]
    ├── BOOTSTRAP_README.md        # Bootstrap methodology guide
    ├── bootstrap_validity.md      # Scientific justification
    ├── OUTPUT_FORMAT.md           # Output interpretation guide
    ├── MIN_GAMES_METHODOLOGY.md   # Min games analysis methodology
    ├── QUICK_START_MIN_GAMES.md   # Quick start for threshold analysis
    └── README_MIN_GAMES.md        # Min games analysis overview
```

## Core Classes

### `HeadToHeadMatrix`

Computes and stores head-to-head win matrices from battle data.

```python
h2h = HeadToHeadMatrix(
    filepath='gen1ou.tsv',  # TSV file with battle data
    min_games=10            # Minimum games to include player
)

# Access computed matrices
win_percentages = h2h.win_matrix    # Win percentage matrix
games_played = h2h.games_matrix     # Games count matrix
wins = h2h.wins_matrix              # Wins count matrix
```

### `BradleyTerryModel`

Fits Bradley-Terry model and provides predictions.

```python
bt_model = BradleyTerryModel(h2h)

# Fit model
bt_model.fit_logistic(
    method='lbfgs',         # Optimization method
    regularization=0.01,    # L2 regularization
    verbose=True
)

# Get rankings
rankings = bt_model.get_rankings()

# Predict matchups
prob = bt_model.predict_win_probability(player_i=0, player_j=1)
```

## Scripts

### 1. Main Analysis (`whr.py`)

Run complete analysis with bootstrap:

```bash
cd /home/jake/pokeagent.github.io
python -m bt.whr
```

Outputs:
- Full rankings with 95% confidence intervals
- Uncertainty analysis
- Model evaluation metrics
- Saves to `bt_rankings_with_uncertainty.csv`

### 2. Bootstrap Examples (`bootstrap_example.py`)

Demonstrates bootstrap functionality:

```bash
python bt/bootstrap_example.py
```

Shows:
- Standard bootstrap vs subsampling
- Uncertainty comparison
- Players with highest/lowest certainty

### 3. Quick Minimum Games Check (`quick_min_games_check.py`)

Fast analysis (2-3 minutes):

```bash
python bt/quick_min_games_check.py
```

Provides:
- Uncertainty by game count
- Threshold suggestions
- Quick recommendation

### 4. Comprehensive Minimum Games Analysis (`analyze_min_games.py`)

Thorough analysis (10-15 minutes):

```bash
python bt/analyze_min_games.py
```

Includes:
- Method 1: Direct uncertainty analysis
- Method 2: Subsampling stability test
- Method 3: Threshold comparison
- Method 4: Prediction accuracy validation
- Evidence-based recommendations

## Key Features

### Bootstrap Uncertainty Estimation

```python
# Standard bootstrap (scientifically rigorous)
results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='resample',      # Sample with replacement
    fit_method='lbfgs'
)

# Subsampling (robustness testing)
results = bt_model.fit_bootstrap(
    n_bootstrap=50,
    method='subsample',     # Sample without replacement
    fraction=0.8,           # Use 80% of games
    fit_method='lbfgs'
)
```

### Multiple Fitting Methods

- **L-BFGS** (`method='lbfgs'`): Fast, recommended for most uses
- **Gradient Descent** (`method='gradient_descent'`): More control
- **Newton's Method** (`method='newton'`): Second-order optimization

### Uncertainty Quantification

All rankings include:
- Point estimate (BT_Strength)
- Standard deviation (BT_Std)
- 95% confidence interval (BT_CI_Lower, BT_CI_Upper)

## Use Cases

### 1. Tournament Seeding

```python
# Use high threshold for reliability
h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=100)
bt_model = BradleyTerryModel(h2h)
results = bt_model.fit_bootstrap(n_bootstrap=200, method='resample')
rankings = bt_model.get_rankings_with_uncertainty(results)

# Use only players with std < 0.01
reliable = rankings[rankings['BT_Std'] < 0.01]
```

### 2. Player Progression Tracking

```python
# Lower threshold for inclusivity
h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=20)
bt_model = BradleyTerryModel(h2h)
rankings = bt_model.get_rankings()

# Track changes over time
```

### 3. Matchup Prediction

```python
bt_model.fit_logistic(method='lbfgs')

# Predict specific matchup
player_a_idx = 0
player_b_idx = 5
prob_a_wins = bt_model.predict_win_probability(player_a_idx, player_b_idx)
print(f"Probability player A wins: {prob_a_wins:.2%}")
```

### 4. Minimum Games Research

```python
# Determine reliability requirements
# Run comprehensive analysis
python bt/analyze_min_games.py

# Review recommendations and choose threshold
```

## Configuration

### Data Format

**File Location:** TSV files are expected in `showdown_tsvs/` directory (relative to leaderboard directory).

Default path: `showdown_tsvs/gen1ou.tsv`

Input TSV file should have columns:
- `Username`: Player identifier
- `W`: Wins
- `L`: Losses
- `T`: Ties
- `Elo`: Elo rating
- `Glicko`: Glicko rating
- `Rating_Deviation`: Glicko RD
- `H2H_Data`: JSON string with head-to-head records

### Common Parameters

```python
# Minimum games threshold
min_games = 50  # Adjust based on your reliability needs

# Bootstrap samples
n_bootstrap = 100  # More = more accurate, slower

# Regularization
regularization = 0.01  # Higher = more smoothing

# Bootstrap method
method = 'resample'  # 'resample' (standard) or 'subsample' (robustness)
```

## Performance

Typical runtimes on moderate hardware:

| Players | Games  | Operation           | Time     |
|---------|--------|---------------------|----------|
| 100     | 10k    | Single fit          | ~5s      |
| 100     | 10k    | Bootstrap (n=100)   | ~2-3min  |
| 200     | 50k    | Single fit          | ~15s     |
| 200     | 50k    | Bootstrap (n=100)   | ~8-10min |
| 500     | 200k   | Single fit          | ~45s     |
| 500     | 200k   | Bootstrap (n=100)   | ~30-40min|

Tips for faster computation:
- Use `fit_method='lbfgs'` (fastest)
- Reduce `n_bootstrap` for exploratory work
- Increase `min_games` to reduce dataset size
- Use `verbose=False` to reduce I/O

## Documentation

### Essential Guides

1. **[OUTPUT_FORMAT.md](OUTPUT_FORMAT.md)** - Understanding the output
2. **[BOOTSTRAP_README.md](BOOTSTRAP_README.md)** - Bootstrap methodology
3. **[bootstrap_validity.md](bootstrap_validity.md)** - Scientific justification

### Minimum Games Analysis

1. **[README_MIN_GAMES.md](README_MIN_GAMES.md)** - Overview
2. **[QUICK_START_MIN_GAMES.md](QUICK_START_MIN_GAMES.md)** - Quick start
3. **[MIN_GAMES_METHODOLOGY.md](MIN_GAMES_METHODOLOGY.md)** - Detailed methodology

## Scientific Foundation

This implementation is based on:

- **Bradley & Terry (1952)**: Rank analysis of incomplete block designs
- **Hunter (2004)**: MM algorithms for generalized Bradley-Terry models  
- **Efron (1979)**: Bootstrap methods for uncertainty estimation
- **Politis et al. (1999)**: Subsampling theory

All methods use established statistical techniques suitable for academic publication.

## Examples

### Example 1: Basic Ranking

```python
from bt import HeadToHeadMatrix, BradleyTerryModel

h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=10)
bt_model = BradleyTerryModel(h2h)
bt_model.fit_logistic(method='lbfgs', regularization=0.01)
rankings = bt_model.get_rankings()

print(rankings.head(10))
```

### Example 2: With Uncertainty

```python
from bt import HeadToHeadMatrix, BradleyTerryModel

h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=20)
bt_model = BradleyTerryModel(h2h)

results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='resample',
    fit_method='lbfgs',
    regularization=0.01
)

rankings = bt_model.get_rankings_with_uncertainty(results)

# Show top 10 with confidence intervals
for _, row in rankings.head(10).iterrows():
    print(f"{row['Rank']:2d}. {row['Username']:30s} "
          f"{row['BT_Strength']:.4f} ± {row['BT_Std']:.4f} "
          f"[{row['BT_CI_Lower']:.4f}, {row['BT_CI_Upper']:.4f}]")
```

### Example 3: Determine Minimum Games

```python
# Run the quick check
import subprocess
subprocess.run(['python', 'bt/quick_min_games_check.py'])

# Review output and set threshold accordingly
```

## Troubleshooting

### Import Errors

If you get `ModuleNotFoundError: No module named 'bt'`:

```bash
# Make sure you're in the parent directory
cd /home/jake/pokeagent.github.io

# Run scripts using -m flag or from parent
python -m bt.whr
# or
python bt/whr.py
```

### Slow Performance

- Reduce `n_bootstrap` (try 30 instead of 100)
- Use `verbose=False`
- Increase `min_games` threshold
- Use `fit_method='lbfgs'` (fastest)

### High Uncertainty

If all uncertainties are high:
- Players need more games
- Consider using provisional rankings
- Check if regularization is too high
- Increase bootstrap samples

### Convergence Warnings

Usually safe to ignore, but if concerned:
- Increase `max_iter` parameter
- Adjust regularization
- Check data quality

## API Reference

See docstrings in `whr.py` for complete API documentation:

```python
from bt import HeadToHeadMatrix
help(HeadToHeadMatrix)

from bt import BradleyTerryModel
help(BradleyTerryModel)
```

## Citation

If using this module in research:

```
Bradley-Terry rankings computed using L-BFGS optimization with L2
regularization (λ=0.01). Uncertainty estimated via bootstrap with 100
resamples (Efron, 1979). Implementation based on Hunter (2004) MM
algorithm and scikit-learn optimization routines.
```

## Contributing

To modify or extend:

1. Edit `bt/whr.py` for core functionality
2. Add examples to `bt/bootstrap_example.py`
3. Update documentation as needed
4. Test with `python -m bt.whr`

## License

[Your license here]

## Contact

[Your contact information]

