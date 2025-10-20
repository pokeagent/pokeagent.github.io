#!/usr/bin/env python3
"""
Quick minimum games check - fast version for exploratory analysis.
Run this first to get a rough idea, then run full analyze_min_games.py for details.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from bt.whr import HeadToHeadMatrix, BradleyTerryModel
import warnings
warnings.filterwarnings('ignore')


def quick_check(filepath: str = 'showdown_tsvs/gen1ou.tsv', 
                min_games: int = 5,
                n_bootstrap: int = 30) -> None:
    """
    Quick check: just uncertainty vs games and a simple recommendation.
    """
    print("="*70)
    print("QUICK MINIMUM GAMES CHECK")
    print("="*70)
    print(f"Loading data from: {filepath}")
    print(f"Initial threshold: {min_games} games")
    print(f"Bootstrap samples: {n_bootstrap} (quick mode)")
    print()
    
    # Load and fit
    h2h = HeadToHeadMatrix(filepath=filepath, min_games=min_games)
    print(f"✓ Loaded {len(h2h.players)} players")
    
    bt_model = BradleyTerryModel(h2h)
    
    print("\nFitting with bootstrap (this may take a minute)...")
    results = bt_model.fit_bootstrap(
        n_bootstrap=n_bootstrap,
        method='resample',
        fit_method='lbfgs',
        min_games=0,
        regularization=0.01,
        verbose=False
    )
    
    rankings = bt_model.get_rankings_with_uncertainty(results)
    rankings['Total_Games'] = rankings['Total_Wins'] + rankings['Total_Losses']
    
    # Quick analysis
    print("\n" + "="*70)
    print("UNCERTAINTY BY GAME COUNT")
    print("="*70)
    
    bins = [(0, 10), (10, 20), (20, 50), (50, 100), (100, 200), (200, 1000000)]
    
    print(f"\n{'Games':<15} {'Players':<10} {'Mean Std':<12} {'Median Std':<12} {'% < 0.02':<12}")
    print("-"*70)
    
    for low, high in bins:
        mask = (rankings['Total_Games'] >= low) & (rankings['Total_Games'] < high)
        bin_data = rankings[mask]
        
        if len(bin_data) > 0:
            pct_good = 100 * (bin_data['BT_Std'] < 0.02).sum() / len(bin_data)
            label = f"{low}-{high if high < 1000000 else '∞'}"
            print(f"{label:<15} {len(bin_data):<10} {bin_data['BT_Std'].mean():<12.4f} "
                  f"{bin_data['BT_Std'].median():<12.4f} {pct_good:<12.1f}%")
    
    # Find thresholds
    print("\n" + "="*70)
    print("THRESHOLD SUGGESTIONS")
    print("="*70)
    
    std_targets = {
        'Very reliable (std < 0.01)': 0.01,
        'Reliable (std < 0.02)': 0.02,
        'Acceptable (std < 0.03)': 0.03,
        'Lenient (std < 0.05)': 0.05,
    }
    
    for label, std_thresh in std_targets.items():
        good_players = rankings[rankings['BT_Std'] <= std_thresh]
        if len(good_players) > 0:
            median_games = good_players['Total_Games'].median()
            q20_games = good_players['Total_Games'].quantile(0.2)
            pct_players = 100 * len(good_players) / len(rankings)
            
            print(f"\n{label}:")
            print(f"  Median games needed: {median_games:.0f}")
            print(f"  20th percentile: {q20_games:.0f} games")
            print(f"  Would include: {len(good_players)} players ({pct_players:.1f}%)")
    
    # Quick recommendation
    print("\n" + "="*70)
    print("QUICK RECOMMENDATION")
    print("="*70)
    
    # Find 80th percentile of most certain 20% of players
    top_20_pct = rankings.nsmallest(int(len(rankings) * 0.2), 'BT_Std')
    recommended = int(top_20_pct['Total_Games'].quantile(0.8))
    
    # Count how many would be included
    would_include = (rankings['Total_Games'] >= recommended).sum()
    pct_included = 100 * would_include / len(rankings)
    
    # Get typical uncertainty at this level
    at_threshold = rankings[rankings['Total_Games'] >= recommended]
    typical_std = at_threshold['BT_Std'].median() if len(at_threshold) > 0 else 0
    
    print(f"\n  SUGGESTED MINIMUM: {recommended} games")
    print(f"  - Would include: {would_include} players ({pct_included:.1f}%)")
    print(f"  - Typical uncertainty: std ≈ {typical_std:.4f}")
    print(f"  - Use case: ", end="")
    
    if typical_std < 0.015:
        print("Tournament seeding, prizes (very reliable)")
    elif typical_std < 0.025:
        print("Standard rankings (reliable)")
    elif typical_std < 0.040:
        print("Casual rankings (acceptable)")
    else:
        print("Exploratory only (high uncertainty)")
    
    # Show examples
    print("\n" + "="*70)
    print("EXAMPLES AT DIFFERENT THRESHOLDS")
    print("="*70)
    
    test_thresholds = [10, 20, 30, 50, 75, 100]
    
    print(f"\n{'Min Games':<12} {'Players':<10} {'Top 10 Most Certain':<35} {'Median Std':<12}")
    print("-"*70)
    
    for thresh in test_thresholds:
        subset = rankings[rankings['Total_Games'] >= thresh]
        if len(subset) >= 10:
            median_std = subset['BT_Std'].median()
            print(f"{thresh:<12} {len(subset):<10} {len(subset.nsmallest(10, 'BT_Std')):<35} {median_std:<12.4f}")
    
    # Top uncertain players
    print("\n" + "="*70)
    print("MOST UNCERTAIN ESTIMATES (need more games)")
    print("="*70)
    
    uncertain = rankings.nlargest(10, 'BT_Std')
    print(f"\n{'Rank':<6} {'Username':<30} {'Games':<8} {'Std':<10}")
    print("-"*70)
    for _, row in uncertain.iterrows():
        print(f"{row['Rank']:<6} {row['Username']:<30} {int(row['Total_Games']):<8} {row['BT_Std']:<10.4f}")
    
    print("\n" + "="*70)
    print("NEXT STEPS")
    print("="*70)
    print("\n1. If you want more detail, run: python analyze_min_games.py")
    print("   (includes subsampling stability test, threshold comparison, etc.)")
    print("\n2. To use the suggested threshold, edit whr.py line 769:")
    print(f"   h2h = HeadToHeadMatrix(filepath='showdown_tsvs/gen1ou.tsv', min_games={recommended})")
    print("\n3. Consider a tiered system:")
    print(f"   - Established (100+ games): Very reliable")
    print(f"   - Ranked (50+ games): Reliable")
    print(f"   - Provisional (20+ games): Acceptable")
    print(f"   - Unranked (< 20 games): Too uncertain")
    print("\n" + "="*70)


if __name__ == '__main__':
    quick_check()

