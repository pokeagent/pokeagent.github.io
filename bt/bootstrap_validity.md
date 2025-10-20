# Scientific Validity of Bootstrap Methods for Bradley-Terry Models

## TL;DR

**Use `method='resample'` (standard bootstrap) for scientific inference and reporting.**

## Detailed Comparison

| Aspect | Standard Bootstrap (resample) | Subsampling (subsample) |
|--------|------------------------------|-------------------------|
| **Scientific validity** | ✅ Rigorous theory (Efron 1979) | ⚠️ Different purpose |
| **What it estimates** | Sampling variability | Robustness to data loss |
| **Asymptotic properties** | Consistent, well-understood | More complex, less studied |
| **For confidence intervals** | ✅ Appropriate | ❌ Not recommended |
| **For sensitivity analysis** | ⚠️ Not ideal | ✅ Appropriate |
| **Peer review acceptance** | ✅ Standard practice | ⚠️ Needs justification |
| **Statistical literature** | Extensive | Moderate |

## Why Standard Bootstrap is More Valid

### 1. Correct Statistical Framework

The standard bootstrap correctly simulates the **data generating process**:

```
True process:  Population → Sample → Estimate
Bootstrap:     Sample → Bootstrap Sample* → Bootstrap Estimate*
```

For Bradley-Terry models:
- **Population**: All possible games between players with true skill π_i
- **Sample**: Observed games (your data)
- **Bootstrap**: Resamples games as if drawing from the empirical distribution

This is theoretically justified when:
- ✅ Games are independent (reasonable assumption for Pokémon battles)
- ✅ Estimator is consistent (Bradley-Terry MLE is)
- ✅ Estimator is asymptotically normal (Bradley-Terry MLE is)

### 2. Established Theory for Pairwise Comparisons

The bootstrap for Bradley-Terry models is discussed in:
- **Dykstra (1960s)**: Asymptotic properties of paired comparison models
- **Davidson & Beaver (1977)**: On extending the Bradley-Terry model
- **Agresti (2002)**: "Categorical Data Analysis" - bootstrap for multinomial models

The key insight: **resampling at the game level** (not matchup level) preserves the statistical structure.

### 3. What Each Method Actually Measures

**Standard Bootstrap:**
```
Std Error = √Var[θ̂* - θ̂ | observed data]
```
- Estimates variability of the estimator
- Approximates the true sampling distribution
- **This is what you report in papers**

**Subsampling:**
```
Std Error ≈ √Var[θ̂_m - θ̂_n] × scaling factor
```
- Estimates variability with less data
- Different scaling properties (depends on m/n)
- **Not the same as sampling variability**

## Practical Guidelines

### For Scientific Publications

```python
# DO THIS for papers/reports:
h2h = HeadToHeadMatrix('gen1ou.tsv', min_games=5)
bt_model = BradleyTerryModel(h2h)

# Standard bootstrap with sufficient samples
results = bt_model.fit_bootstrap(
    n_bootstrap=200,      # Use 200+ for publications
    method='resample',    # Standard bootstrap
    fit_method='lbfgs',
    regularization=0.01
)

rankings = bt_model.get_rankings_with_uncertainty(results)

# Report as:
# "Player X has Bradley-Terry strength 1.25 (95% CI: [1.21, 1.29]) 
#  estimated via bootstrap with 200 resamples."
```

### For Exploratory Analysis

```python
# For quick checks:
results_quick = bt_model.fit_bootstrap(
    n_bootstrap=30,       # Fewer samples OK for exploration
    method='resample',
    fit_method='lbfgs'
)

# For robustness checks:
results_robust = bt_model.fit_bootstrap(
    n_bootstrap=50,
    method='subsample',   # Only for sensitivity analysis
    fraction=0.8
)

# Compare: are rankings stable with 80% of data?
```

## Advanced: When Subsampling Might Be Used

Subsampling (subsample without replacement) has legitimate uses:

### 1. Heavy-Tailed Distributions
If game outcomes have extreme values (not applicable here since outcomes are binary), subsampling can be more robust.

### 2. Non-smooth Functionals
For estimators like the median or quantiles, subsampling sometimes has better properties. Bradley-Terry MLE is smooth, so bootstrap is fine.

### 3. Sample Size Calculations
"How many games do we need?" - subsampling can help answer this by showing performance with less data.

### 4. Cross-validation Alternative
Subsampling approximates the behavior of leaving out data, similar to cross-validation.

## Mathematical Details

### Standard Bootstrap Validity

For Bradley-Terry model with n players and N total games, as N → ∞:

```
√N (θ̂* - θ̂) →^d N(0, Σ)  [in bootstrap world]
√N (θ̂ - θ)   →^d N(0, Σ)  [in real world]
```

This **matching of distributions** is why bootstrap works. The bootstrap distribution approximates the sampling distribution.

### Why Subsampling Is Different

With m games subsampled (m < N):

```
√m (θ̂_m - θ̂_N) →^d N(0, Σ)

But: Var(θ̂_m) > Var(θ̂_N) because m < N
```

You need to scale by √(N/m) to get back to Var(θ̂_N), but:
- This scaling is approximate
- Doesn't account for finite-sample bias
- Less theoretically justified

## Recommendations by Use Case

| Goal | Method | n_bootstrap | Notes |
|------|--------|-------------|-------|
| **Confidence intervals for paper** | `resample` | 200-500 | Standard scientific practice |
| **Quick uncertainty check** | `resample` | 30-50 | Fast approximation |
| **Test if rankings stable** | `subsample` | 50-100 | Sensitivity analysis |
| **Sample size planning** | `subsample` | 100 | Try different fractions |
| **Model comparison** | `resample` | 100+ | Compare uncertainty across models |

## Code Template for Scientific Work

```python
def analyze_with_uncertainty(filepath: str, min_games: int = 10):
    """
    Scientifically rigorous Bradley-Terry analysis with bootstrap CI.
    """
    # Load and fit
    h2h = HeadToHeadMatrix(filepath, min_games=min_games)
    bt_model = BradleyTerryModel(h2h)
    
    # Bootstrap for uncertainty (STANDARD METHOD)
    print("Computing bootstrap confidence intervals...")
    boot_results = bt_model.fit_bootstrap(
        n_bootstrap=200,
        method='resample',  # Scientifically valid
        fit_method='lbfgs',
        regularization=0.01,
        verbose=True
    )
    
    # Get rankings with CI
    rankings = bt_model.get_rankings_with_uncertainty(boot_results)
    
    # Optional: Sensitivity check
    print("\nRobustness check (80% of data)...")
    sens_results = bt_model.fit_bootstrap(
        n_bootstrap=50,
        method='subsample',
        fraction=0.8,
        fit_method='lbfgs',
        regularization=0.01,
        verbose=False
    )
    
    # Compare uncertainty
    print(f"\nBootstrap std (normal):     {boot_results['std_strengths'].mean():.4f}")
    print(f"Subsample std (robustness): {sens_results['std_strengths'].mean():.4f}")
    print(f"Ratio: {sens_results['std_strengths'].mean() / boot_results['std_strengths'].mean():.2f}")
    
    if sens_results['std_strengths'].mean() / boot_results['std_strengths'].mean() > 1.5:
        print("⚠️  Rankings may be sensitive to data availability")
    else:
        print("✓  Rankings appear robust")
    
    return rankings, boot_results, sens_results
```

## References

1. **Efron, B. (1979)**. "Bootstrap methods: Another look at the jackknife." *Annals of Statistics*.
   - Original bootstrap paper

2. **Davison & Hinkley (1997)**. "Bootstrap Methods and Their Application." Cambridge.
   - Comprehensive bootstrap theory

3. **Politis, Romano, & Wolf (1999)**. "Subsampling." Springer.
   - Theory of subsampling methods

4. **Hunter (2004)**. "MM algorithms for generalized Bradley-Terry models." *Annals of Statistics*.
   - Bradley-Terry model theory

5. **Agresti (2002)**. "Categorical Data Analysis." Wiley.
   - Bootstrap for categorical models (includes pairwise comparisons)

## Conclusion

**For standard scientific inference → Use `method='resample'`**

This is:
- ✅ Theoretically justified
- ✅ Widely accepted in statistics
- ✅ Correct for confidence intervals
- ✅ What reviewers expect

Subsampling is useful for exploratory robustness checks, but **not a substitute** for proper bootstrap inference.

