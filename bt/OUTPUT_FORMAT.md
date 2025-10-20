# Output Format for Bradley-Terry Rankings with Uncertainty

## What to Expect When Running `python whr.py`

The main script now produces **scientifically rigorous Bradley-Terry rankings with bootstrap confidence intervals**.

### Output Structure

```
============================================================
HEAD-TO-HEAD MATRIX SUMMARY
============================================================
Number of players: 150
Total possible matchups: 22350
...

Top 10 players by ELO:
------------------------------------------------------------
1. PlayerName1                  ELO: 1850.0  Dev: 45.2
2. PlayerName2                  ELO: 1820.5  Dev: 50.1
...

============================================================
BRADLEY-TERRY MODEL WITH BOOTSTRAP
============================================================
Method: Logistic Regression (L-BFGS)
Bootstrap samples: 100 (resample with replacement)
============================================================

Fitting model with bootstrap...
Building comparison dataset...
   Built dataset with 45,678 pairwise comparisons
   Starting optimization...
Bootstrap sample 10/100...
Bootstrap sample 20/100...
...
Bootstrap sample 100/100...

Fitting on full data...
L-BFGS converged in 42 iterations

============================================================
BOOTSTRAP RESULTS
============================================================
Mean strength range: [0.1234, 2.3456]
Mean std deviation: 0.0156
Median std deviation: 0.0124

============================================================
FULL BRADLEY-TERRY RANKINGS WITH UNCERTAINTY
============================================================
Rank  Username                       BT_Strength  Std        95% CI                          Wins   Losses WR%   
----------------------------------------------------------------------------------------------------------------------------------
1     PlayerName1                    1.5234       0.0125     [1.4989, 1.5479]               450    200    69.2  
2     PlayerName2                    1.4567       0.0134     [1.4304, 1.4830]               425    215    66.4  
3     PlayerName3                    1.3892       0.0142     [1.3613, 1.4171]               400    230    63.5  
...

============================================================
UNCERTAINTY SUMMARY
============================================================
Mean standard deviation:   0.015634
Median standard deviation: 0.012456
Min standard deviation:    0.008234
Max standard deviation:    0.085234

Top 5 most certain estimates (lowest std):
    1. PlayerWithManyGames          Std: 0.008234  (Games: 1200)
    2. AnotherTopPlayer             Std: 0.009123  (Games: 1050)
  ...

Top 5 most uncertain estimates (highest std):
   45. PlayerWithFewGames           Std: 0.085234  (Games: 15)
   67. AnotherNewPlayer             Std: 0.078456  (Games: 18)
  ...

============================================================
MODEL EVALUATION
============================================================
Number of matchups evaluated (>= 10 games): 1234
Mean Absolute Error (MAE): 0.0456
Root Mean Squared Error (RMSE): 0.0689
Accuracy within 10%: 78.5%
Log-likelihood: -12345.67

============================================================
EXAMPLE PREDICTIONS: Top player vs others
============================================================

PlayerName1 vs top 5 opponents:
----------------------------------------------------------------------------------------------------
Opponent                       Actual               BT Predicted    Error     
----------------------------------------------------------------------------------------------------
PlayerName2                    12W-8L-0T (0.600)    0.548           0.052     
PlayerName3                    15W-5L-0T (0.750)    0.678           0.072     
...

============================================================
✓ Rankings saved to: bt_rankings_with_uncertainty.csv
============================================================
Analysis complete!
============================================================
```

## Output File: `bt_rankings_with_uncertainty.csv`

The CSV file contains the following columns:

| Column | Description |
|--------|-------------|
| `Rank` | Rank by Bradley-Terry strength (1 = strongest) |
| `Username` | Player username |
| `BT_Strength` | Bradley-Terry strength estimate |
| `BT_Std` | Standard deviation from bootstrap |
| `BT_CI_Lower` | Lower bound of 95% confidence interval |
| `BT_CI_Upper` | Upper bound of 95% confidence interval |
| `Total_Wins` | Total wins across all matchups |
| `Total_Losses` | Total losses across all matchups |
| `Win_Rate` | Overall win rate (wins / total games) |
| `Elo` | Original Elo rating |

### Example CSV Content

```csv
Rank,Username,BT_Strength,BT_Std,BT_CI_Lower,BT_CI_Upper,Total_Wins,Total_Losses,Win_Rate,Elo
1,PlayerName1,1.5234,0.0125,1.4989,1.5479,450,200,0.692,1850.0
2,PlayerName2,1.4567,0.0134,1.4304,1.4830,425,215,0.664,1820.5
3,PlayerName3,1.3892,0.0142,1.3613,1.4171,400,230,0.635,1795.2
...
```

## Interpreting the Results

### Bradley-Terry Strength
- **Scale**: Arbitrary (normalized so mean ≈ 1.0)
- **Interpretation**: Player with strength 2.0 is roughly twice as skilled as player with strength 1.0
- **Win probability**: P(i beats j) = π_i / (π_i + π_j)

### Standard Deviation (Std)
- **Low (< 0.02)**: Very reliable estimate, typically 100+ games
- **Medium (0.02-0.05)**: Moderate reliability, 20-100 games
- **High (> 0.05)**: Uncertain estimate, < 20 games

### 95% Confidence Interval
- "We're 95% confident the true strength lies in this range"
- **Narrow CI**: Precise estimate
- **Wide CI**: More uncertainty

### Example Interpretation

```
Rank  Username      BT_Strength  Std      95% CI              Wins  Losses
1     Alice         1.5234       0.0125   [1.4989, 1.5479]    450   200
2     Bob           1.4567       0.0134   [1.4304, 1.4830]    425   215
```

**Alice vs Bob:**
- Alice is stronger (1.52 > 1.46)
- Both estimates are reliable (low std)
- CIs overlap slightly, but Alice is clearly ahead
- Predicted: P(Alice beats Bob) = 1.52/(1.52+1.46) = 0.510 = 51%

```
45    Charlie       0.8234       0.0856   [0.6578, 0.9912]     20    35
```

**Charlie:**
- Below average strength (0.82 < 1.0)
- High uncertainty (std = 0.086)
- Wide CI [0.66, 0.99] - needs more games for reliable estimate

## Key Features

1. **Scientifically Valid**: Uses standard bootstrap (Efron 1979) with 100 samples
2. **Complete Rankings**: Shows ALL players with uncertainty estimates
3. **Saved Results**: CSV file for further analysis
4. **Comprehensive**: Includes model evaluation and example predictions
5. **Interpretable**: Clear summary of which estimates are reliable

## Processing Time

Typical runtime:
- **100 players, 10k games**: ~30-60 seconds
- **200 players, 50k games**: ~2-5 minutes
- **500 players, 200k games**: ~10-20 minutes

Time scales roughly linearly with:
- Number of bootstrap samples (default: 100)
- Number of pairwise comparisons (games)
- Number of players

## Next Steps

After running the analysis:

1. **Open CSV in spreadsheet**: Explore full rankings
2. **Check uncertainty column**: Identify players needing more games
3. **Compare with Elo**: See differences between systems
4. **Use for tournament seeding**: Ranks with low std are reliable
5. **Track over time**: Re-run monthly to see rating changes

## Customization

You can modify `whr.py` to change:

```python
# Line 769: Minimum games threshold
h2h = HeadToHeadMatrix(filepath='gen1ou.tsv', min_games=5)  # Change 5 to your threshold

# Line 791: Number of bootstrap samples
n_bootstrap=100,  # Increase for more precision (slower)

# Line 795: Regularization strength
regularization=0.01,  # Adjust for smoother/sharper estimates
```

## Troubleshooting

**"Convergence warning"**: Usually fine, but try:
- Increase `max_iter` in fit_logistic
- Adjust regularization

**"Memory error"**: Too many players/games, try:
- Reduce bootstrap samples
- Increase `min_games` threshold

**Very high std values**: Normal for players with few games
- Consider filtering by min_games
- Or report uncertainty clearly in results

