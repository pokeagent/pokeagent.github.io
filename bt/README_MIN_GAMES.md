# Minimum Games Threshold Analysis

## Purpose

Determines how many games a player needs to have a reliable Bradley-Terry ranking estimate.

## Quick Start

### Option 1: Fast Check (2-3 minutes)
```bash
python quick_min_games_check.py
```
Gives you a quick recommendation based on uncertainty analysis.

### Option 2: Comprehensive Analysis (10-15 minutes)
```bash
python analyze_min_games.py
```
Runs four different methods to thoroughly analyze the threshold question.

## Files in This Package

### Scripts

1. **`quick_min_games_check.py`** - Fast exploratory analysis
   - Uncertainty vs games
   - Quick recommendations
   - 30 bootstrap samples (faster)

2. **`analyze_min_games.py`** - Comprehensive analysis
   - Method 1: Direct uncertainty analysis
   - Method 2: Subsampling stability test
   - Method 3: Threshold comparison
   - Method 4: Prediction accuracy
   - 50+ bootstrap samples (more accurate)

### Documentation

1. **`QUICK_START_MIN_GAMES.md`** - How to run and interpret
2. **`MIN_GAMES_METHODOLOGY.md`** - Detailed methodology explanation
3. **`README_MIN_GAMES.md`** - This file

## The Four Methods

### Method 1: Direct Uncertainty Analysis ⭐
- **What**: Measure std deviation vs game count
- **Why**: Direct answer to "at what game count is uncertainty acceptable?"
- **When to trust**: Always - this is the primary method

### Method 2: Subsampling Stability Test 🎯
- **What**: Subsample games from high-game players to see when estimates stabilize
- **Why**: Tests "if a player will reach 100 games, how few could we see and still be accurate?"
- **When to trust**: Great validation, tends to be conservative (safe)

### Method 3: Threshold Comparison
- **What**: Compare rankings with different min_games thresholds
- **Why**: Shows practical impact on who gets ranked
- **When to trust**: Good for seeing stability, but can be misleading

### Method 4: Prediction Accuracy
- **What**: Measure prediction error by game count
- **Why**: External validation that uncertainty is meaningful
- **When to trust**: Great sanity check

## Typical Results

For most online games:

| Game Count | Typical Std | Reliability | Use Case |
|------------|-------------|-------------|----------|
| 5-10       | 0.08        | Very low    | Too unreliable |
| 10-20      | 0.05        | Low         | Exploratory only |
| 20-30      | 0.03        | Moderate    | Casual rankings |
| 50-75      | 0.02        | Good        | Standard rankings |
| 100+       | 0.01        | Very good   | Tournament seeding |

## Making Your Decision

### Step 1: Define Your Standards

Pick a target based on your use case:
- **Exploratory/casual**: std < 0.05
- **Standard rankings**: std < 0.02
- **High-stakes/tournament**: std < 0.01

### Step 2: Run Quick Check

```bash
python quick_min_games_check.py
```

Look at the "THRESHOLD SUGGESTIONS" section for game counts that meet your target.

### Step 3: (Optional) Run Full Analysis

For important decisions:
```bash
python analyze_min_games.py
```

Verify the quick recommendation with all four methods.

### Step 4: Implement

Update `whr.py` line 769 (or wherever you initialize):
```python
h2h = HeadToHeadMatrix(filepath='gen1ou.tsv', min_games=YOUR_CHOICE)
```

## Recommended Approach: Tiered System

Instead of a single cutoff, use multiple tiers:

```python
# In your analysis code:
THRESHOLDS = {
    'established': 100,  # std < 0.01, very reliable
    'ranked': 50,        # std < 0.02, reliable
    'provisional': 20,   # std < 0.05, acceptable
    'unranked': 0        # too uncertain
}

def get_tier(games):
    if games >= THRESHOLDS['established']:
        return 'Established'
    elif games >= THRESHOLDS['ranked']:
        return 'Ranked'
    elif games >= THRESHOLDS['provisional']:
        return 'Provisional'
    else:
        return 'Unranked'
```

Benefits:
- ✅ Inclusive (doesn't exclude new players entirely)
- ✅ Transparent (shows reliability level)
- ✅ Flexible (different standards for different purposes)
- ✅ Motivating (shows path to better tier)

## Example Workflow

### For a New Rating System

```bash
# 1. Quick exploration
python quick_min_games_check.py
# Output: "SUGGESTED MINIMUM: 45 games"

# 2. Validate with full analysis
python analyze_min_games.py
# Check that all 4 methods agree

# 3. Decide on thresholds
# Based on output, set:
# - Established: 100+ games (std ≈ 0.008)
# - Ranked: 50+ games (std ≈ 0.018)  
# - Provisional: 25+ games (std ≈ 0.035)

# 4. Update whr.py
# Use min_games=25 to include all ranked players
# Add tier labels in output

# 5. Document decision
# "Based on bootstrap analysis with 50 samples, we require
#  50+ games for standard rankings (std < 0.02)"
```

### For Periodic Review

```bash
# Every quarter or when player base changes significantly
python quick_min_games_check.py > reports/min_games_2024Q1.txt

# Compare to previous:
diff reports/min_games_2024Q1.txt reports/min_games_2023Q4.txt

# If game counts increased across the board, consider raising threshold
# If more new players, consider lowering or adding provisional tier
```

## Interpreting Output

### Uncertainty (Std) Values

- **< 0.01**: Excellent - use for prizes, seeding
- **0.01-0.02**: Very good - standard rankings
- **0.02-0.03**: Good - acceptable for most purposes
- **0.03-0.05**: Fair - mark as provisional
- **> 0.05**: Poor - too uncertain for public rankings

### Correlation Values (Method 2)

- **> 0.98**: Excellent agreement
- **0.95-0.98**: Very good - estimates are stable
- **0.90-0.95**: Good - reasonable stability
- **0.85-0.90**: Fair - some instability
- **< 0.85**: Poor - not stable enough

### Rank Changes (Method 3)

- **±0-1 ranks**: Very stable
- **±2-3 ranks**: Stable enough
- **±4-5 ranks**: Borderline
- **±6+ ranks**: Unstable

## Troubleshooting

### "Recommended threshold is very high (100+ games)"

**Possible reasons:**
- Player base is small with high variance
- Game outcomes are very noisy
- Players' skills are changing rapidly

**Solutions:**
- Accept higher uncertainty for now
- Use provisional/established tiers
- Wait for more data to accumulate
- Consider if rating system assumptions are met

### "Different methods give different answers"

**What to do:**
- Use the most conservative (highest threshold)
- Investigate why they disagree:
  - Method 1 high, Method 2 low → Selection bias (high-game players are different)
  - Method 3 disagrees → Small changes affect rankings a lot
  - Method 4 disagrees → Model fit issues

### "All uncertainties are very low even with few games"

**Possible issues:**
- ⚠️ Too much regularization (shrinking estimates)
- ⚠️ Player base is too homogeneous
- ⚠️ Not enough bootstrap samples

**Check:**
- Reduce regularization parameter
- Increase bootstrap samples to 100+
- Verify game outcomes have variance

## Advanced: Customization

### Adjust Uncertainty Tolerance

In Method 1, change what counts as "acceptable":

```python
# Line ~108 in analyze_min_games.py
std_thresholds = [0.01, 0.02, 0.05, 0.10]  # Adjust these
```

### Test Different Subsampling Fractions

```python
# Line ~137 in analyze_min_games.py
fractions=[0.2, 0.4, 0.6, 0.8, 1.0]  # Add more: [0.1, 0.15, 0.2, ...]
```

### Change Bootstrap Sample Count

More samples = more accurate but slower:

```python
# Line ~116 in analyze_min_games.py
n_bootstrap=50  # Increase to 100 or 200 for final decision
```

## Scientific Validity

All methods are based on established statistical theory:

- **Bootstrap**: Efron (1979) - well-established for uncertainty estimation
- **Subsampling**: Politis et al. (1999) - rigorous subsampling theory
- **Cross-validation**: Standard model evaluation technique
- **Prediction accuracy**: External validation approach

The combination of methods provides robust, evidence-based recommendations.

## Citation

If you use this analysis in research or publications:

```
Minimum games threshold determined via bootstrap uncertainty analysis
with 100 resamples (Efron, 1979) and subsampling stability testing
(Politis et al., 1999). Bradley-Terry model fit via L-BFGS with
L2 regularization (λ=0.01).
```

## Questions?

See `MIN_GAMES_METHODOLOGY.md` for detailed explanation of the methods and theory.

## Summary

**Run this:**
```bash
python quick_min_games_check.py  # Fast (2-3 min)
```

**Look for:**
- Game count where std < your target
- How many players would be included
- Examples of uncertain players

**Decide:**
- Single threshold based on std target
- Or tiered system (recommended)

**Implement:**
- Update `whr.py` with your chosen min_games
- Document your decision and rationale
- Re-evaluate periodically as data grows

