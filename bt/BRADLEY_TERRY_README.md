# Bradley-Terry Model Implementation

This implementation provides multiple methods for fitting the Bradley-Terry model to pairwise comparison data (Pokemon battles).

## Overview

The Bradley-Terry model estimates "strength" parameters π for each player such that:

```
P(player i beats player j) = π_i / (π_i + π_j)
```

## Implementation Methods

### 1. MM Algorithm (Minorization-Maximization)

**Method**: `fit(method='mm')`

The original iterative algorithm that directly maximizes likelihood:

```python
bt = BradleyTerryModel(h2h)
bt.fit(method='mm', max_iter=1000, tol=1e-6)
```

**Pros:**
- Simple to implement
- Guaranteed to converge
- No hyperparameters needed

**Cons:**
- Can be slow for large datasets
- No natural regularization

### 2. Logistic Regression Formulation

The Bradley-Terry model can be reformulated as logistic regression by taking logs:

```
log(π_i) = θ_i  (log-strength parameter)
P(i beats j) = 1 / (1 + exp(-(θ_i - θ_j)))
```

This is exactly the logistic function! We fit θ parameters directly.

#### 2a. L-BFGS Optimizer

**Method**: `fit(method='lbfgs')` or `fit(method='logistic')`

Uses scipy's L-BFGS-B optimizer with gradient computation:

```python
bt = BradleyTerryModel(h2h)
bt.fit(method='lbfgs', regularization=0.01)
```

**Pros:**
- Very fast convergence
- Memory efficient (quasi-Newton method)
- Built-in regularization support
- Most robust for large datasets

**Cons:**
- Requires scipy

**Best for:** Most applications, especially with many players

#### 2b. Newton's Method (Fisher Scoring)

**Method**: `fit(method='newton')`

Uses full Hessian matrix (Fisher information):

```python
bt = BradleyTerryModel(h2h)
bt.fit(method='newton', regularization=0.01)
```

**Pros:**
- Fastest convergence (quadratic)
- Natural interpretation (Fisher information)

**Cons:**
- Memory intensive (stores full Hessian)
- Can be slow for many players
- May fail if Hessian is singular

**Best for:** Smaller datasets (<100 players)

#### 2c. Gradient Descent

**Method**: `fit(method='gradient_descent')`

Simple first-order optimization:

```python
bt = BradleyTerryModel(h2h)
bt.fit(method='gradient_descent', regularization=0.01, lr=0.01)
```

**Pros:**
- Simple and transparent
- Memory efficient
- Easy to understand

**Cons:**
- Slowest convergence
- Requires tuning learning rate
- May need many iterations

**Best for:** Educational purposes, debugging

## Parameters

### Common Parameters

- `min_games`: Minimum games between two players to include in fitting (default: 0)
- `regularization`: L2 penalty on log-strengths to prevent overfitting (default: 0.01)

### MM-specific

- `max_iter`: Maximum iterations (default: 1000)
- `tol`: Convergence tolerance (default: 1e-6)

### Gradient Descent-specific

- `lr`: Learning rate (default: 0.01)
- `max_iter`: Maximum iterations (default: 1000)
- `tol`: Convergence tolerance (default: 1e-6)

## Usage Examples

### Quick Start

```python
from whr import HeadToHeadMatrix, BradleyTerryModel

# Load data
h2h = HeadToHeadMatrix('gen1ou.tsv', max_deviation=50)

# Fit model (recommended: L-BFGS)
bt = BradleyTerryModel(h2h)
bt.fit(method='lbfgs', regularization=0.01)

# Get rankings
rankings = bt.get_rankings()
print(rankings.head(10))

# Predict matchups
prob = bt.predict_win_probability(0, 1)  # Player 0 vs Player 1
```

### Compare Methods

```python
# Try different methods
methods = ['mm', 'lbfgs', 'newton', 'gradient_descent']

for method in methods:
    bt = BradleyTerryModel(h2h)
    bt.fit(method=method, regularization=0.01)
    rankings = bt.get_rankings()
    print(f"{method}: Top player = {rankings.iloc[0]['Username']}")
```

### With Regularization

```python
# Stronger regularization for sparse data
bt = BradleyTerryModel(h2h)
bt.fit(method='lbfgs', regularization=0.1, min_games=10)

# Weaker regularization for dense data
bt.fit(method='lbfgs', regularization=0.001, min_games=5)
```

## Scripts

- **`quick_logistic_bt.py`**: Simple example using L-BFGS
- **`example_bradley_terry.py`**: Compare all three logistic methods
- **`compare_methods.py`**: Comprehensive benchmark of all methods
- **`whr.py`**: Full implementation with `main()` function

## Mathematical Details

### Logistic Regression Formulation

The log-likelihood for Bradley-Terry with logistic parameterization:

```
ℓ(θ) = Σ [y_ij log(p_ij) + (1-y_ij) log(1-p_ij)]
```

where:
- `θ = [θ_1, ..., θ_n]` are log-strength parameters
- `p_ij = 1/(1 + exp(-(θ_i - θ_j)))` is predicted win probability
- `y_ij = 1` if player i won, 0 otherwise

### Gradient

```
∂ℓ/∂θ_i = Σ_j [y_ij - p_ij]
```

### Hessian (Fisher Information)

```
∂²ℓ/∂θ_i∂θ_j = -p_ij(1 - p_ij) * [I(i==j) - I(i≠j)]
```

### Regularization

L2 penalty added to prevent overfitting:

```
Penalized ℓ(θ) = ℓ(θ) - (λ/2) ||θ||²
```

## Performance Comparison

Typical results on Pokemon battle data (46 players, ~300K pairwise comparisons):

| Method | Time | Iterations | MAE | RMSE |
|--------|------|------------|-----|------|
| MM | ~2.0s | 50-100 | 0.145 | 0.182 |
| L-BFGS | ~0.5s | 10-20 | 0.143 | 0.180 |
| Newton | ~1.0s | 5-10 | 0.143 | 0.180 |
| Gradient Descent | ~5.0s | 500+ | 0.145 | 0.182 |

**Recommendation**: Use L-BFGS for best balance of speed and accuracy.

## References

1. Bradley, R. A., & Terry, M. E. (1952). "Rank Analysis of Incomplete Block Designs: I. The Method of Paired Comparisons"
2. Hunter, D. R. (2004). "MM algorithms for generalized Bradley-Terry models"
3. Agresti, A. (2013). "Categorical Data Analysis" (Chapter on Logistic Regression)


