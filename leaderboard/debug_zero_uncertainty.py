#!/usr/bin/env python3
"""
Debug why some players have zero uncertainty.
"""

import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from leaderboard.whr import HeadToHeadMatrix, BradleyTerryModel

# Load data
h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=100)

print("=" * 80)
print("DEBUGGING ZERO UNCERTAINTY")
print("=" * 80)

# Fit with normalization
bt = BradleyTerryModel(h2h)
bootstrap_results = bt.fit_bootstrap(
    n_bootstrap=50,
    method='resample',
    fit_method='lbfgs',
    min_games=0,
    regularization=0.01,
    verbose=False,
    normalize_matchups='sqrt',
)

rankings = bt.get_rankings_with_elo_uncertainty(
    bootstrap_results, center=1500.0, scale=400.0
)

# Find players with zero uncertainty
zero_unc = rankings[rankings['Elo_Std'] == 0]
nonzero_unc = rankings[rankings['Elo_Std'] > 0]

print(f"\nPlayers with ZERO uncertainty: {len(zero_unc)}")
print(f"Players with NON-ZERO uncertainty: {len(nonzero_unc)}")

if len(zero_unc) > 0:
    print("\nSample players with ZERO uncertainty:")
    print(zero_unc[['Username', 'BT_Elo', 'Elo_Std', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))

if len(nonzero_unc) > 0:
    print("\nSample players with NON-ZERO uncertainty:")
    print(nonzero_unc[['Username', 'BT_Elo', 'Elo_Std', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))

# Check the raw bootstrap samples
print("\n" + "=" * 80)
print("RAW BOOTSTRAP VARIANCE ANALYSIS")
print("=" * 80)

std_strengths = bootstrap_results['std_strengths']
print(f"\nBT strength std dev:")
print(f"  Min: {std_strengths.min():.6f}")
print(f"  Max: {std_strengths.max():.6f}")
print(f"  Mean: {std_strengths.mean():.6f}")
print(f"  Players with std=0: {np.sum(std_strengths == 0)}")

# Check a specific player with zero uncertainty
if len(zero_unc) > 0:
    player_idx = rankings[rankings['Username'] == zero_unc.iloc[0]['Username']].index[0]
    player_samples = bootstrap_results['strengths_samples'][:, player_idx]
    print(f"\nBootstrap samples for {zero_unc.iloc[0]['Username']}:")
    print(f"  Samples: {player_samples[:10]}")  # First 10
    print(f"  All same? {np.all(player_samples == player_samples[0])}")
    print(f"  Std: {np.std(player_samples)}")


