# Quick Start: Minimum Games Analysis

## Run the Analysis

```bash
python analyze_min_games.py
```

## What You'll Get

### Console Output

1. **Method 1: Uncertainty vs Games**
   - Shows mean/median uncertainty for different game count ranges
   - Look for where std becomes acceptable (< 0.02 for standard, < 0.05 for casual)

2. **Method 2: Subsampling Stability** (Your Idea!)
   - Tests what happens with 20%, 40%, 60%, 80%, 100% of games
   - Look for correlation > 0.95 with full data
   - This tells you minimum games needed for stability

3. **Method 3: Threshold Comparison**
   - Shows how top players' ranks change with different thresholds
   - Look for where ranks stabilize

4. **Method 4: Prediction Accuracy**
   - Shows prediction error by game count
   - Validates that more games = better predictions

5. **RECOMMENDATIONS**
   - Specific suggestions based on your data
   - Three options: Conservative, Recommended, Inclusive

### CSV Files Generated

- `min_games_analysis_uncertainty.csv` - Full rankings with uncertainty
- `min_games_analysis_predictions.csv` - Prediction accuracy data  
- `min_games_analysis_thresholds.csv` - Rankings at different thresholds

## Quick Interpretation

### Look for these patterns:

**Good threshold:**
```
✓ Uncertainty: std < 0.02 for most players at this level
✓ Subsampling: correlation > 0.95 with full data
✓ Stability: Top 20 ranks don't change much
✓ Predictions: Error is acceptable at this level
```

**Too low:**
```
✗ Uncertainty: std still > 0.05
✗ Subsampling: correlation < 0.90
✗ Stability: Ranks jumping around
✗ Predictions: High error rates
```

**Too high:**
```
⚠ Excludes too many players
⚠ Minimal improvement over lower threshold
⚠ Unnecessary for your use case
```

## Example Decision

If output shows:
- 30 games → std = 0.025, correlation = 0.94
- 50 games → std = 0.018, correlation = 0.96
- 100 games → std = 0.012, correlation = 0.98

**Recommendation:**
- **Casual rankings**: 30 games (good enough, inclusive)
- **Standard rankings**: 50 games (reliable, good balance)
- **Tournament seeding**: 100 games (very reliable)

## Customization

Edit the script to change:

```python
# Line 102: Initial threshold for uncertainty analysis
min_games=5  # Start including players at 5 games

# Line 116: Number of bootstrap samples  
n_bootstrap=50  # More = more accurate but slower

# Line 136: High threshold for subsampling test
high_threshold=100  # Use players with this many games

# Line 137: Fractions to test
fractions=[0.2, 0.4, 0.6, 0.8, 1.0]  # Test 20%, 40%, etc.

# Line 169: Thresholds to compare
thresholds=[5, 10, 20, 50, 100]  # Test these min_games values
```

## Expected Runtime

- **100 players**: ~2-5 minutes
- **200 players**: ~5-10 minutes  
- **500 players**: ~15-30 minutes

Dominated by bootstrap iterations. Reduce `n_bootstrap` for faster (less precise) results.

## What's "Normal"?

Typical results for online gaming:
- **5-10 games**: std ≈ 0.08 (very unreliable)
- **20-30 games**: std ≈ 0.03 (borderline acceptable)
- **50-75 games**: std ≈ 0.02 (good for most uses)
- **100+ games**: std ≈ 0.01 (very reliable)

Your data might differ based on:
- Game complexity (more complex → need more games)
- Player skill variance (wider range → need more games)
- Rating system dynamics (volatile → need more games)

## Troubleshooting

**"Taking too long"**
- Reduce `n_bootstrap` (try 20 instead of 50)
- Test fewer thresholds
- Test fewer fractions in subsampling

**"Correlation values seem low"**
- Normal! Even 0.90 is pretty good
- Shows that game count matters
- Lower = need higher threshold

**"All uncertainties are high"**
- Players don't have enough games in general
- May need to lower expectations (use 0.05 instead of 0.02)
- Or focus on smaller elite group with more games

**"Different methods disagree"**
- Use most conservative (highest threshold)
- Investigate specific cases
- May indicate data quality issues

## Next Steps

After determining your threshold:

1. **Update `whr.py`** to use it:
   ```python
   # Line 769
   h2h = HeadToHeadMatrix(filepath='gen1ou.tsv', min_games=YOUR_THRESHOLD)
   ```

2. **Document your decision**:
   - Which threshold you chose
   - Why (based on which methods)
   - What reliability level it provides

3. **Monitor over time**:
   - Re-run analysis quarterly
   - As player base grows, may be able to increase threshold
   - Or lower it if you need more inclusion

4. **Consider tiered system**:
   - Multiple thresholds for different purposes
   - "Provisional" vs "Established" rankings
   - More nuanced than single cutoff

