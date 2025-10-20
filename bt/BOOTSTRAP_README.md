# Bootstrap for Bradley-Terry Model

## Overview

Bootstrap methods have been added to estimate uncertainty in Bradley-Terry model fits. This allows you to:
- Compute confidence intervals for player strength estimates
- Identify which players have reliable vs uncertain rankings
- Test robustness of rankings to data variability

## Methods Implemented

### 1. **Standard Bootstrap (`method='resample'`)**
- Samples individual games **with replacement**
- Creates bootstrap samples of the same size as original data
- Estimates sampling variability: "If we could resample the same population, how would estimates vary?"
- Classical bootstrap approach

```python
results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='resample',
    fit_method='mm'
)
```

### 2. **Subsampling (`method='subsample'`)**
- Samples a fraction of games **without replacement**
- Creates smaller datasets (e.g., 80% of games)
- Tests robustness: "How stable are rankings if we had less data?"
- Useful for sensitivity analysis

```python
results = bt_model.fit_bootstrap(
    n_bootstrap=100,
    method='subsample',
    fraction=0.8,  # Use 80% of games
    fit_method='mm'
)
```

## Usage Examples

### Basic Usage

```python
from whr import HeadToHeadMatrix, BradleyTerryModel

# Load data
h2h = HeadToHeadMatrix(filepath='gen1ou.tsv', min_games=5)
bt_model = BradleyTerryModel(h2h)

# Fit with bootstrap
results = bt_model.fit_bootstrap(
    n_bootstrap=50,
    method='resample',
    fit_method='mm',
    verbose=True
)

# Get rankings with uncertainty
rankings = bt_model.get_rankings_with_uncertainty(results)

# Display top players with confidence intervals
print(rankings.head(10))
```

### Running the Analysis

```bash
# Run main analysis (now includes bootstrap by default!)
python whr.py

# Run detailed examples and comparisons
python bootstrap_example.py
```

**Note:** The main `whr.py` script now computes bootstrap confidence intervals by default using 100 bootstrap samples with the scientifically valid resample method.

## Understanding the Results

### Output Dictionary

`fit_bootstrap()` returns a dictionary with:

- **`strengths_samples`**: Array of shape `(n_bootstrap, n_players)` - all bootstrap samples
- **`log_strengths_samples`**: Log-transformed strengths
- **`mean_strengths`**: Mean strength across bootstrap samples
- **`std_strengths`**: Standard deviation (uncertainty measure)
- **`ci_lower`**: Lower 95% confidence interval
- **`ci_upper`**: Upper 95% confidence interval

### Interpreting Standard Deviation

- **Low std** (< 0.01): Reliable estimate, ranking is stable
- **Medium std** (0.01-0.05): Moderate uncertainty
- **High std** (> 0.05): High uncertainty, ranking may be unstable

Players with fewer games typically have higher uncertainty.

### Confidence Intervals

The 95% CI tells you: "We're 95% confident the true strength lies in this range"

Example:
```
Player: joe          Strength: 1.2500 ± 0.0150  [1.2205, 1.2798]
Player: beginner     Strength: 0.8200 ± 0.0850  [0.6578, 0.9912]
```

`joe` has a tight CI → reliable estimate
`beginner` has a wide CI → uncertain estimate

## Practical Applications

### 1. Ranking Confidence
- Identify which rank orderings are stable vs volatile
- Distinguish "clearly better" from "statistically tied" players

### 2. Sample Size Analysis
- Determine how many games are needed for reliable estimates
- Use subsampling to test "what if we had less data?"

### 3. Model Validation
- Check if model predictions are stable across data samples
- Detect overfitting or data quality issues

### 4. Tournament Seeding
- Use confidence intervals for more robust seeding
- Identify players who need more games to establish true skill

## Algorithm Details

### Sampling Procedure

For each bootstrap iteration:

1. **For each player pair (i, j):**
   - Original data: i beat j in `w_ij` games, lost `l_ij` games
   - Create outcome array: `[1, 1, ..., 1, 0, 0, ..., 0]` (w_ij ones, l_ij zeros)
   
2. **Sample from outcomes:**
   - **Resample**: Draw `w_ij + l_ij` samples with replacement
   - **Subsample**: Draw `fraction * (w_ij + l_ij)` samples without replacement

3. **Count new wins/losses** in the sample

4. **Fit model** on bootstrap sample

5. **Store estimated strengths**

After all iterations, compute mean, std, and percentiles across samples.

### Why This Works

The bootstrap principle: the empirical distribution approximates the true distribution. By resampling from our observed games, we simulate what would happen if we collected new data from the same underlying process.

## Performance Considerations

- **MM algorithm** (`fit_method='mm'`) is much faster than L-BFGS
  - Use for bootstrap with many iterations
- **Typical settings:**
  - Quick analysis: `n_bootstrap=30`
  - Production: `n_bootstrap=100-200`
  - High precision: `n_bootstrap=500+`

## Comparison to Other Uncertainty Methods

| Method | What it estimates | Pros | Cons |
|--------|------------------|------|------|
| **Bootstrap** | Sampling variability | Non-parametric, intuitive | Computationally expensive |
| **Asymptotic std errors** | Large-sample uncertainty | Fast, analytical | Assumes asymptotic normality |
| **Bayesian credible intervals** | Posterior uncertainty | Full probability distribution | Requires prior specification |

Bootstrap is preferred when:
- Sample size is moderate (not extremely large or small)
- You want empirical uncertainty without distributional assumptions
- Computational cost is acceptable

## References

- Efron, B. (1979). "Bootstrap methods: Another look at the jackknife"
- Davison & Hinkley (1997). "Bootstrap Methods and Their Application"
- Bradley & Terry (1952). "Rank Analysis of Incomplete Block Designs"

## Future Extensions

Possible enhancements:
- **Parametric bootstrap**: Sample from fitted model rather than data
- **Block bootstrap**: Preserve temporal structure in game sequences
- **Rank stability**: Track how often rank orderings change across bootstrap samples
- **Matchup-level bootstrap**: Resample at matchup level instead of game level

