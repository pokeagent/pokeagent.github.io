#!/usr/bin/env python3
"""
Example script demonstrating bootstrap functionality for Bradley-Terry model.
Shows how to estimate uncertainty in player strength estimates.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from bt.whr import HeadToHeadMatrix, BradleyTerryModel
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


def simple_bootstrap_example():
    """Simple example showing basic bootstrap usage."""
    print("="*60)
    print("SIMPLE BOOTSTRAP EXAMPLE")
    print("="*60)
    
    # Load data
    h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=5)
    bt_model = BradleyTerryModel(h2h)
    
    # Fit with bootstrap (small sample for quick demo)
    results = bt_model.fit_bootstrap(
        n_bootstrap=30,
        method='resample',
        fit_method='mm',
        verbose=False,
    )
    
    # Get rankings with uncertainty
    rankings = bt_model.get_rankings_with_uncertainty(results)
    
    print("\n" + "="*60)
    print("TOP 10 PLAYERS WITH CONFIDENCE INTERVALS")
    print("="*60)
    for _, row in rankings.head(10).iterrows():
        print(f"{row['Rank']:2d}. {row['Username']:30s} "
              f"{row['BT_Strength']:.4f} ± {row['BT_Std']:.4f} "
              f"[{row['BT_CI_Lower']:.4f}, {row['BT_CI_Upper']:.4f}]")
    
    return results, rankings


def compare_methods():
    """Compare bootstrap vs subsample methods."""
    print("\n" + "="*60)
    print("COMPARING BOOTSTRAP METHODS")
    print("="*60)
    
    h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=5)
    bt_model = BradleyTerryModel(h2h)
    
    # Method 1: Standard bootstrap
    print("\n1. Standard Bootstrap (resample with replacement)...")
    boot_results = bt_model.fit_bootstrap(
        n_bootstrap=30,
        method='resample',
        fit_method='mm',
        verbose=False
    )
    
    # Method 2: Subsample 80%
    print("2. Subsample 80% (without replacement)...")
    sub80_results = bt_model.fit_bootstrap(
        n_bootstrap=30,
        method='subsample',
        fraction=0.8,
        fit_method='mm',
        verbose=False
    )
    
    # Method 3: Subsample 50%
    print("3. Subsample 50% (without replacement)...")
    sub50_results = bt_model.fit_bootstrap(
        n_bootstrap=30,
        method='subsample',
        fraction=0.5,
        fit_method='mm',
        verbose=False
    )
    
    print("\n" + "="*60)
    print("UNCERTAINTY COMPARISON")
    print("="*60)
    print(f"{'Method':<30} {'Mean Std':<15} {'Median Std':<15}")
    print("-"*60)
    print(f"{'Bootstrap (resample)':<30} {boot_results['std_strengths'].mean():.6f}      {np.median(boot_results['std_strengths']):.6f}")
    print(f"{'Subsample 80%':<30} {sub80_results['std_strengths'].mean():.6f}      {np.median(sub80_results['std_strengths']):.6f}")
    print(f"{'Subsample 50%':<30} {sub50_results['std_strengths'].mean():.6f}      {np.median(sub50_results['std_strengths']):.6f}")
    
    # Interpretation
    print("\n" + "="*60)
    print("INTERPRETATION")
    print("="*60)
    print("• Higher std = more uncertainty in strength estimate")
    print("• Subsampling typically shows MORE uncertainty (expected)")
    print("• Players with fewer games have higher uncertainty")
    print("• Bootstrap estimates variability if we resampled the same data")
    print("• Subsample estimates robustness to missing data")
    
    return boot_results, sub80_results, sub50_results


def analyze_uncertainty_vs_games():
    """Analyze relationship between number of games and uncertainty."""
    print("\n" + "="*60)
    print("UNCERTAINTY vs NUMBER OF GAMES")
    print("="*60)
    
    h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games=5)
    bt_model = BradleyTerryModel(h2h)
    
    results = bt_model.fit_bootstrap(
        n_bootstrap=30,
        method='resample',
        fit_method='mm',
        verbose=False
    )
    
    rankings = bt_model.get_rankings_with_uncertainty(results)
    
    # Compute total games per player
    rankings['Total_Games'] = rankings['Total_Wins'] + rankings['Total_Losses']
    
    # Bin players by number of games
    bins = [0, 50, 100, 200, 500, 10000]
    bin_labels = ['0-50', '50-100', '100-200', '200-500', '500+']
    rankings['Game_Bin'] = pd.cut(rankings['Total_Games'], bins=bins, labels=bin_labels)
    
    print("\nAverage uncertainty by number of games played:")
    print("-"*60)
    print(f"{'Games Played':<15} {'N Players':<12} {'Mean Std':<15} {'Median Std':<15}")
    print("-"*60)
    
    for bin_label in bin_labels:
        bin_data = rankings[rankings['Game_Bin'] == bin_label]
        if len(bin_data) > 0:
            print(f"{bin_label:<15} {len(bin_data):<12} "
                  f"{bin_data['BT_Std'].mean():.6f}      "
                  f"{bin_data['BT_Std'].median():.6f}")
    
    print("\nMost uncertain players (despite having games):")
    print("-"*60)
    uncertain = rankings.nlargest(5, 'BT_Std')
    for _, row in uncertain.iterrows():
        print(f"{row['Username']:30s} Games: {row['Total_Games']:4d}  Std: {row['BT_Std']:.6f}")
    
    print("\nMost certain players:")
    print("-"*60)
    certain = rankings.nsmallest(5, 'BT_Std')
    for _, row in certain.iterrows():
        print(f"{row['Username']:30s} Games: {row['Total_Games']:4d}  Std: {row['BT_Std']:.6f}")


def main():
    """Run all bootstrap examples."""
    # Example 1: Simple bootstrap
    simple_bootstrap_example()
    
    # Example 2: Compare methods
    compare_methods()
    
    # Example 3: Analyze uncertainty
    analyze_uncertainty_vs_games()

if __name__ == '__main__':
    main()

