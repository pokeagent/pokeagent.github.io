# Bradley-Terry Module - Quick Reference

## Run Commands

```bash
# Main analysis (with bootstrap)
python run_bt_analysis.py main
python -m bt.whr

# Bootstrap examples
python run_bt_analysis.py bootstrap
python bt/bootstrap_example.py

# Quick min games check (2-3 min)
python run_bt_analysis.py quick-check
python bt/quick_min_games_check.py

# Full min games analysis (10-15 min)
python run_bt_analysis.py analyze
python bt/analyze_min_games.py
```

## Import Usage

```python
from bt import HeadToHeadMatrix, BradleyTerryModel

# Basic ranking
h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=10)
bt_model = BradleyTerryModel(h2h)
bt_model.fit_logistic(method='lbfgs', regularization=0.01)
rankings = bt_model.get_rankings()

# With bootstrap uncertainty
results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='resample',
    fit_method='lbfgs'
)
rankings = bt_model.get_rankings_with_uncertainty(results)

# Predict matchup
prob = bt_model.predict_win_probability(player_i=0, player_j=5)
```

## Common Parameters

```python
# HeadToHeadMatrix
min_games = 50          # Minimum games to include player

# fit_bootstrap
n_bootstrap = 100       # Number of bootstrap samples
method = 'resample'     # 'resample' or 'subsample'
fit_method = 'lbfgs'    # 'lbfgs', 'gradient_descent', 'newton'
regularization = 0.01   # L2 regularization strength
fraction = 0.8          # For subsample method
```

## Typical Std Values

| Games | Typical Std | Use Case |
|-------|------------|----------|
| 10    | 0.08       | Too unreliable |
| 20    | 0.05       | Exploratory |
| 50    | 0.02       | Standard rankings |
| 100   | 0.01       | Tournament seeding |

## Output Files

- `bt_rankings_with_uncertainty.csv` - Main rankings
- `min_games_analysis_uncertainty.csv` - Uncertainty analysis
- `min_games_analysis_predictions.csv` - Prediction accuracy
- `min_games_analysis_thresholds.csv` - Threshold comparison

## Quick Decisions

**For tournament seeding**: min_games=100, std < 0.01
**For standard rankings**: min_games=50, std < 0.02
**For casual/provisional**: min_games=20, std < 0.05

## Documentation Map

- `README.md` - Module overview
- `BOOTSTRAP_README.md` - Bootstrap guide
- `bootstrap_validity.md` - Scientific basis
- `OUTPUT_FORMAT.md` - Interpreting output
- `README_MIN_GAMES.md` - Min games overview
- `QUICK_START_MIN_GAMES.md` - Min games quick start
- `MIN_GAMES_METHODOLOGY.md` - Min games methods

## Help

```bash
python run_bt_analysis.py help
```

Or read: `bt/README.md`

