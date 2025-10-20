# Minimum Games Threshold Analysis - Methodology

## Overview

The question: **How many games does a player need to have a reliable Bradley-Terry ranking?**

This is crucial for:
- Setting inclusion criteria for official rankings
- Determining when new players get "official" ratings
- Balancing inclusivity vs. reliability
- Tournament seeding decisions

## Four Complementary Methods

### Method 1: Direct Uncertainty Analysis ⭐ Most Important

**What it does:**
- Fit Bradley-Terry model with bootstrap on all players
- Measure uncertainty (standard deviation) for each player
- Plot uncertainty vs. number of games played

**What it tells us:**
- Direct answer: "At X games, uncertainty drops below acceptable level"
- Shows the relationship between data and reliability
- Identifies specific players with unreliable estimates

**Interpretation:**
```
Games     Mean Std    Interpretation
0-10      0.0850     Very unreliable - need more games
10-20     0.0450     Unreliable - borderline
20-50     0.0250     Moderate - acceptable for casual rankings  
50-100    0.0150     Reliable - good for most purposes
100-200   0.0080     Very reliable - tournament quality
200+      0.0050     Extremely reliable - ground truth
```

**Your target std depends on use case:**
- **Exploratory/casual**: std < 0.05 (maybe 20-30 games)
- **Standard rankings**: std < 0.02 (maybe 50-75 games)
- **Tournament/prizes**: std < 0.01 (maybe 100+ games)

---

### Method 2: Subsampling Stability Test (Your Idea!) 🎯

**What it does:**
- Take only players with MANY games (e.g., 100+)
- Subsample different fractions of their games (20%, 40%, 60%, 80%, 100%)
- Compare rankings: do estimates stabilize?

**What it tells us:**
- "If a reliable player has 100 games, how few could they have and still be reliable?"
- Tests robustness: are rankings stable with less data?
- Validates that high-game players are actually stable

**Key insight:**
If rankings from 60% of games correlate r>0.95 with 100% of games, then players with 60 games are probably reliable (for players who would eventually reach 100 games).

**Example interpretation:**
```
Fraction   Correlation   Interpretation
20%        0.85         Very different - not enough data
40%        0.92         Getting closer - borderline
60%        0.96         Very similar - probably sufficient
80%        0.98         Almost identical - definitely sufficient
```

**Why this works:**
- Simulates "what if players had fewer games?"
- Uses ground truth (players with many games) as reference
- More conservative than other methods (good for safety)

---

### Method 3: Threshold Comparison

**What it does:**
- Fit model multiple times with different min_games thresholds (5, 10, 20, 50, 100)
- Compare top player rankings across thresholds
- See where rankings stabilize

**What it tells us:**
- Are top rankings consistent across thresholds?
- When does adding more players stop changing the top ranks?
- Practical: "Will my rankings change if I lower the threshold?"

**Example:**
```
Player        5 games   10 games   20 games   50 games   100 games
Alice         1         1          1          1          1         ← Stable
Bob           2         2          2          2          2         ← Stable  
Charlie       3         4          3          3          3         ← Mostly stable
Dave          4         3          4          5          6         ← Unstable
Eve           8         15         N/A        N/A        N/A       ← Excluded at high thresholds
```

If top 10 is stable between 20 and 50 games, then 20 is probably sufficient.

**Caution:** This can be misleading if most players have many games. It's testing "who's included" not "who's reliable."

---

### Method 4: Prediction Accuracy by Game Count

**What it does:**
- Measure how well the model predicts actual win rates
- Break down prediction error by how many games a player has
- Validate that more games = better predictions

**What it tells us:**
- Empirical validation of uncertainty estimates
- "Do players with more games actually have better predictions?"
- External validation (not circular like bootstrap)

**Expected pattern:**
```
Player Games   Prediction Error   
0-20           0.089             High error - unpredictable
20-50          0.065             Moderate error
50-100         0.048             Low error - reliable
100-200        0.042             Very low error
200+           0.039             Minimal error
```

---

## How These Methods Work Together

1. **Method 1 (Direct)**: Gives you the answer directly from uncertainty
2. **Method 2 (Subsampling)**: Validates the answer with a different approach
3. **Method 3 (Thresholds)**: Shows practical impact on rankings
4. **Method 4 (Predictions)**: External validation that uncertainty is meaningful

**Ideal workflow:**
1. Run Method 1 → Get primary recommendation
2. Run Method 2 → Validate it's not overly optimistic
3. Run Method 3 → Check impact on actual rankings
4. Run Method 4 → Confirm predictions match uncertainty

If all methods agree → Strong evidence for that threshold  
If methods disagree → Use most conservative, investigate why

---

## Scientific Justification for Method 2 (Subsampling)

Your intuition about subsampling is scientifically sound! Here's why:

### The Logic

**Assumption:** Players who eventually accumulate N games are "typical" players

**Test:** If we only see n < N of their games, can we estimate their strength reliably?

**If yes:** Then any player with n games should be reliable (assuming they're similar to high-game players)

### Why This Works

1. **Ground truth:** Players with 100+ games have well-estimated strengths
2. **Subsampling:** Seeing 40% of their games (40 games) simulates a player with only 40 games
3. **Comparison:** If 40-game subsample matches 100-game truth, then 40 games is enough

### Caveats

**Selection bias:** 
- Players with many games might be "different" (more skilled, more dedicated)
- If true, then low-game players might need MORE games than subsampling suggests
- **Solution:** Compare player characteristics across game counts

**Dependence structure:**
- If early games are unrepresentative (learning curve), subsampling might be optimistic
- **Solution:** Could do temporal subsampling (first 40% vs random 40%)

**Variance heterogeneity:**
- Some players might be more variable than others
- **Solution:** Look at variance of subsampled estimates, not just means

### Why It's Conservative

This approach is actually **conservative** (safe) because:
- Uses only players who proved they could reach high game counts
- These are likely more "stable" players
- Real low-game players might need even MORE games
- So this gives you an **upper bound** on minimum games

---

## Recommended Decision Framework

### Step 1: Define Your Std Target

Based on use case:
- **Exploratory**: std < 0.05
- **Standard**: std < 0.02  
- **High-stakes**: std < 0.01

### Step 2: Run Method 1

Find game count where X% of players meet std target:
- **Strict**: 80% must meet target
- **Moderate**: 60% must meet target
- **Lenient**: 40% must meet target

### Step 3: Validate with Method 2

Run subsampling test:
- If correlation at that game count is r > 0.95 → Confirmed
- If correlation is 0.90-0.95 → Borderline, consider higher
- If correlation is < 0.90 → Too optimistic, need more games

### Step 4: Check Method 3

Look at top 20 ranking stability:
- If top 20 changes a lot → threshold too low
- If top 20 is stable → threshold is good

### Step 5: Verify with Method 4

Check prediction errors align with uncertainty:
- Should see error decrease with game count
- Error at your threshold should be acceptable

---

## Example Analysis Results

Let's say you run the analysis and get:

```
METHOD 1: Players with 50+ games have mean std = 0.018 (target: 0.02)
METHOD 2: 50 games (50% subsample of 100) has r = 0.96 correlation
METHOD 3: Top 10 rankings stable from 40-50 games onward
METHOD 4: Prediction error at 50 games = 0.045 (acceptable)
```

**Recommendation:** Set minimum at **50 games**
- Meets uncertainty target (Method 1)
- Validated by subsampling (Method 2)  
- Produces stable rankings (Method 3)
- Acceptable prediction accuracy (Method 4)

---

## Practical Considerations

### Too Strict (e.g., 200 games)

**Pros:**
- Very reliable estimates
- High confidence in rankings
- Good for prizes/tournaments

**Cons:**
- Excludes most players
- Reduces engagement
- Slow to get ranked

### Too Lenient (e.g., 5 games)

**Pros:**
- Inclusive - everyone gets ranked quickly
- Good for engagement
- Larger dataset

**Cons:**
- Unreliable estimates (high std)
- Rankings change dramatically with few games
- Not suitable for important decisions

### Sweet Spot (e.g., 30-50 games)

**Pros:**
- Reasonable reliability (std ≈ 0.02-0.03)
- Includes most active players
- Stable enough for most purposes

**Cons:**
- Some uncertainty remains
- May want separate "provisional" rankings

---

## Tiered Ranking System (Best Practice)

Instead of single threshold, use tiers:

**Tier 1: Established (100+ games)**
- Very reliable, std < 0.01
- Used for seeding, prizes, hall of fame
- "Official" rankings

**Tier 2: Ranked (50-99 games)**
- Reliable, std < 0.02
- Standard rankings, matchmaking
- "Stable" rankings

**Tier 3: Provisional (20-49 games)**
- Moderate reliability, std < 0.05
- Visible but marked as provisional
- "Emerging" rankings

**Tier 4: Unranked (< 20 games)**
- High uncertainty, std > 0.05
- Not publicly ranked
- Need more games

This gives best of both worlds: inclusive but transparent about reliability.

---

## Running the Analysis

```bash
python analyze_min_games.py
```

This will:
1. Run all four methods
2. Generate detailed output
3. Provide specific recommendations for your dataset
4. Save CSV files with detailed results

Review the output and choose a threshold based on:
- Your reliability requirements
- Your player base size  
- Your use case (casual vs competitive)
- Tradeoffs between inclusion and reliability

---

## Summary

**Your intuition about subsampling was spot-on!** It's a scientifically valid way to test minimum game thresholds. The script implements this along with three other complementary methods to give you a robust, evidence-based recommendation.

The key insight: **There's no single "correct" answer** - it depends on your tolerance for uncertainty and your need for inclusivity. The analysis gives you the data to make an informed decision.

