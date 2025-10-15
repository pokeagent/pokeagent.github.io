#!/usr/bin/env python3
"""
Compare Bradley-Terry rankings with and without sqrt normalization.

This script fits the BT model twice:
1. Without normalization (default, uses all games)
2. With sqrt normalization (weights by sqrt of total games per matchup)

The sqrt method balances informativeness (high-volume matchups provide signal)
with preventing domination (prevents a few high-volume matchups from overwhelming
the model).

Usage:
    python compare_normalization.py [--min-games MIN_GAMES] [--n-bootstrap N]
    
Example:
    python compare_normalization.py --min-games 100 --n-bootstrap 50
"""

import sys
from pathlib import Path
import argparse
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from leaderboard.whr import HeadToHeadMatrix, BradleyTerryModel


def compare_normalization_methods(
    filepath: str = 'showdown_tsvs/gen1ou.tsv',
    min_games: int = 100,
    n_bootstrap: int = 0,
    regularization: float = 0.01,
):
    """
    Compare BT model with and without normalization.
    
    Args:
        filepath: Path to TSV file
        min_games: Minimum games for player inclusion
        n_bootstrap: Number of bootstrap samples (0 to skip)
        regularization: L2 regularization parameter
    """
    print("=" * 80)
    print("NORMALIZATION COMPARISON")
    print("=" * 80)
    print(f"Data: {filepath}")
    print(f"Min games: {min_games}")
    print(f"Bootstrap samples: {n_bootstrap if n_bootstrap > 0 else 'None'}")
    print(f"Regularization: {regularization}")
    print()
    
    # Load data
    h2h = HeadToHeadMatrix(filepath=filepath, min_games=min_games)
    
    # =========================================================================
    # FIT WITHOUT NORMALIZATION
    # =========================================================================
    print("\n" + "=" * 80)
    print("1. WITHOUT NORMALIZATION (all games)")
    print("=" * 80)
    
    bt_no_norm = BradleyTerryModel(h2h)
    
    if n_bootstrap > 0:
        print(f"\nBootstrapping with {n_bootstrap} samples...")
        bootstrap_no_norm = bt_no_norm.fit_bootstrap(
            n_bootstrap=n_bootstrap,
            method='resample',
            fit_method='lbfgs',
            min_games=0,
            regularization=regularization,
            verbose=True,
            normalize_matchups=None,  # No normalization
        )
        rankings_no_norm = bt_no_norm.get_rankings_with_elo_uncertainty(
            bootstrap_no_norm, center=1500.0, scale=400.0
        )
    else:
        bt_no_norm.fit_logistic(
            method='lbfgs',
            min_games=0,
            regularization=regularization,
            verbose=True,
            normalize_matchups=None,  # No normalization
        )
        rankings_no_norm = bt_no_norm.get_rankings()
    
    # =========================================================================
    # FIT WITH SQRT NORMALIZATION
    # =========================================================================
    print("\n" + "=" * 80)
    print("2. WITH SQRT NORMALIZATION")
    print("=" * 80)
    
    bt_sqrt = BradleyTerryModel(h2h)
    
    if n_bootstrap > 0:
        print(f"\nBootstrapping with {n_bootstrap} samples...")
        bootstrap_sqrt = bt_sqrt.fit_bootstrap(
            n_bootstrap=n_bootstrap,
            method='resample',
            fit_method='lbfgs',
            min_games=0,
            regularization=regularization,
            verbose=True,
            normalize_matchups='sqrt',  # SQRT normalization
        )
        rankings_sqrt = bt_sqrt.get_rankings_with_elo_uncertainty(
            bootstrap_sqrt, center=1500.0, scale=400.0
        )
    else:
        bt_sqrt.fit_logistic(
            method='lbfgs',
            min_games=0,
            regularization=regularization,
            verbose=True,
            normalize_matchups='sqrt',  # SQRT normalization
        )
        rankings_sqrt = bt_sqrt.get_rankings()
    
    # =========================================================================
    # COMPARISON
    # =========================================================================
    print("\n" + "=" * 80)
    print("RESULTS COMPARISON")
    print("=" * 80)
    
    # Top 10 for each method
    print("\nTop 10 WITHOUT normalization:")
    if n_bootstrap > 0:
        print(rankings_no_norm[['Rank', 'Username', 'BT_Elo', 'Elo_Std', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))
    else:
        print(rankings_no_norm[['Rank', 'Username', 'BT_Strength', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))
    
    print("\nTop 10 WITH sqrt normalization:")
    if n_bootstrap > 0:
        print(rankings_sqrt[['Rank', 'Username', 'BT_Elo', 'Elo_Std', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))
    else:
        print(rankings_sqrt[['Rank', 'Username', 'BT_Strength', 'Total_Wins', 'Total_Losses']].head(10).to_string(index=False))
    
    # Merge and compare rankings
    print("\n" + "=" * 80)
    print("RANK CHANGES")
    print("=" * 80)
    
    merged = rankings_no_norm[['Username', 'Rank']].rename(columns={'Rank': 'Rank_NoNorm'}).merge(
        rankings_sqrt[['Username', 'Rank']].rename(columns={'Rank': 'Rank_Sqrt'}),
        on='Username'
    )
    merged['Rank_Diff'] = merged['Rank_Sqrt'] - merged['Rank_NoNorm']
    
    # Show biggest movers
    print("\nBiggest rank IMPROVEMENTS with sqrt normalization (moved up):")
    improved = merged[merged['Rank_Diff'] < 0].sort_values('Rank_Diff').head(10)
    print(improved.to_string(index=False))
    
    print("\nBiggest rank DECLINES with sqrt normalization (moved down):")
    declined = merged[merged['Rank_Diff'] > 0].sort_values('Rank_Diff', ascending=False).head(10)
    print(declined.to_string(index=False))
    
    # Statistics
    print("\n" + "=" * 80)
    print("STATISTICS")
    print("=" * 80)
    
    print(f"\nPlayers with rank changes: {(merged['Rank_Diff'] != 0).sum()} / {len(merged)}")
    print(f"Mean absolute rank change: {abs(merged['Rank_Diff']).mean():.2f}")
    print(f"Median absolute rank change: {abs(merged['Rank_Diff']).median():.1f}")
    print(f"Max rank improvement: {merged['Rank_Diff'].min():.0f} positions")
    print(f"Max rank decline: {merged['Rank_Diff'].max():.0f} positions")
    
    if n_bootstrap > 0:
        print("\n" + "=" * 80)
        print("UNCERTAINTY COMPARISON")
        print("=" * 80)
        
        unc_compare = rankings_no_norm[['Username', 'Elo_Std']].rename(columns={'Elo_Std': 'Std_NoNorm'}).merge(
            rankings_sqrt[['Username', 'Elo_Std']].rename(columns={'Elo_Std': 'Std_Sqrt'}),
            on='Username'
        )
        unc_compare['Std_Diff'] = unc_compare['Std_Sqrt'] - unc_compare['Std_NoNorm']
        unc_compare['Std_Ratio'] = unc_compare['Std_Sqrt'] / unc_compare['Std_NoNorm']
        
        print(f"\nMean Elo uncertainty (no norm): {unc_compare['Std_NoNorm'].mean():.2f}")
        print(f"Mean Elo uncertainty (sqrt): {unc_compare['Std_Sqrt'].mean():.2f}")
        print(f"Median Elo uncertainty (no norm): {unc_compare['Std_NoNorm'].median():.2f}")
        print(f"Median Elo uncertainty (sqrt): {unc_compare['Std_Sqrt'].median():.2f}")
        
        print("\nPlayers with largest uncertainty INCREASE from sqrt:")
        print(unc_compare.nlargest(5, 'Std_Diff')[['Username', 'Std_NoNorm', 'Std_Sqrt', 'Std_Diff']].to_string(index=False))
        
        print("\nPlayers with largest uncertainty DECREASE from sqrt:")
        print(unc_compare.nsmallest(5, 'Std_Diff')[['Username', 'Std_NoNorm', 'Std_Sqrt', 'Std_Diff']].to_string(index=False))
    
    print("\n" + "=" * 80)
    print("CONCLUSION")
    print("=" * 80)
    print("\nSqrt normalization downweights high-volume matchups, preventing them")
    print("from dominating the model while still preserving their informational content.")
    print("Use sqrt normalization when you want more balanced influence across matchups.")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Compare BT rankings with and without sqrt normalization"
    )
    parser.add_argument(
        '--min-games',
        type=int,
        default=100,
        help='Minimum games for player inclusion (default: 100)'
    )
    parser.add_argument(
        '--n-bootstrap',
        type=int,
        default=0,
        help='Number of bootstrap samples (default: 0, skip bootstrap)'
    )
    parser.add_argument(
        '--regularization',
        type=float,
        default=0.01,
        help='L2 regularization parameter (default: 0.01)'
    )
    parser.add_argument(
        '--filepath',
        type=str,
        default='showdown_tsvs/gen1ou.tsv',
        help='Path to TSV file (default: showdown_tsvs/gen1ou.tsv)'
    )
    
    args = parser.parse_args()
    
    compare_normalization_methods(
        filepath=args.filepath,
        min_games=args.min_games,
        n_bootstrap=args.n_bootstrap,
        regularization=args.regularization,
    )
