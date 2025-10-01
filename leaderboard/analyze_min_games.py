#!/usr/bin/env python3
"""
Analyze minimum games threshold for including players in Bradley-Terry rankings.

This script uses several methods to determine an appropriate minimum:
1. Uncertainty vs. games played analysis
2. Subsampling stability test (your suggestion)
3. Ranking stability across thresholds
4. Prediction accuracy by game count
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from whr import HeadToHeadMatrix, BradleyTerryModel
from typing import Dict, List, Tuple
import warnings

warnings.filterwarnings("ignore")


def analyze_uncertainty_vs_games(
    filepath: str = "showdown_tsvs/gen1ou.tsv",
    min_games: int = 5,
    n_bootstrap: int = 50,
) -> pd.DataFrame:
    """
    Method 1: Direct analysis - how does uncertainty vary with game count?

    This is the most straightforward approach: fit the model with bootstrap,
    then plot uncertainty vs. number of games to find where uncertainty becomes acceptable.
    """
    print("=" * 80)
    print("METHOD 1: UNCERTAINTY vs GAMES PLAYED")
    print("=" * 80)
    print(
        f"Fitting model with min_games={min_games}, bootstrap samples={n_bootstrap}..."
    )

    h2h = HeadToHeadMatrix(filepath=filepath, min_games=min_games)
    bt_model = BradleyTerryModel(h2h)

    # Fit with bootstrap
    results = bt_model.fit_bootstrap(
        n_bootstrap=n_bootstrap,
        method="resample",
        fit_method="lbfgs",
        min_games=0,
        regularization=0.01,
        verbose=False,
    )

    # Get rankings with uncertainty
    rankings = bt_model.get_rankings_with_uncertainty(results)
    rankings["Total_Games"] = rankings["Total_Wins"] + rankings["Total_Losses"]

    # Analyze by game count bins
    bins = [0, 10, 20, 50, 100, 200, 500, 10000]
    bin_labels = ["0-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500+"]
    rankings["Game_Bin"] = pd.cut(rankings["Total_Games"], bins=bins, labels=bin_labels)

    print("\nUncertainty by game count:")
    print("-" * 80)
    print(
        f"{'Games':<15} {'N Players':<12} {'Mean Std':<15} {'Median Std':<15} {'Max Std':<15}"
    )
    print("-" * 80)

    for label in bin_labels:
        bin_data = rankings[rankings["Game_Bin"] == label]
        if len(bin_data) > 0:
            print(
                f"{label:<15} {len(bin_data):<12} "
                f"{bin_data['BT_Std'].mean():<15.6f} "
                f"{bin_data['BT_Std'].median():<15.6f} "
                f"{bin_data['BT_Std'].max():<15.6f}"
            )

    return rankings


def test_subsampling_stability(
    filepath: str = "showdown_tsvs/gen1ou.tsv",
    high_threshold: int = 100,
    fractions: List[float] = [0.2, 0.4, 0.6, 0.8, 1.0],
    n_bootstrap: int = 30,
) -> Dict[float, pd.DataFrame]:
    """
    Method 2: Subsampling stability test (your suggestion!)

    Use only players with many games (high_threshold), then subsample to see
    how estimates change with different amounts of data. This tells us:
    "If we have reliable players, how many of their games do we need?"
    """
    print("\n" + "=" * 80)
    print("METHOD 2: SUBSAMPLING STABILITY TEST")
    print("=" * 80)
    print(f"Using players with >= {high_threshold} games")
    print(f"Testing fractions: {fractions}")

    # Load with high threshold to get reliable players only
    h2h = HeadToHeadMatrix(filepath=filepath, min_games=high_threshold)
    bt_model = BradleyTerryModel(h2h)

    print(f"Number of players with >= {high_threshold} games: {len(h2h.players)}")

    # Test each fraction
    results_by_fraction = {}

    for fraction in fractions:
        print(f"\nTesting fraction: {fraction:.1%}")

        if fraction == 1.0:
            # Full data without subsampling
            print("  Fitting on full data (no bootstrap)...")
            bt_model.fit_logistic(
                method="lbfgs", min_games=0, regularization=0.01, verbose=False
            )
            rankings = bt_model.get_rankings()
            rankings["Fraction"] = fraction
            rankings["Method"] = "Full"
        else:
            # Subsample bootstrap
            print(f"  Fitting with subsampling ({fraction:.0%} of games)...")
            boot_results = bt_model.fit_bootstrap(
                n_bootstrap=n_bootstrap,
                method="subsample",
                fraction=fraction,
                fit_method="lbfgs",
                min_games=0,
                regularization=0.01,
                verbose=False,
            )
            rankings = bt_model.get_rankings_with_uncertainty(boot_results)
            rankings["Fraction"] = fraction
            rankings["Method"] = "Subsample"

        results_by_fraction[fraction] = rankings

    # Compare rankings across fractions
    print("\n" + "-" * 80)
    print("STABILITY ANALYSIS")
    print("-" * 80)

    # Get top 10 players from full data
    full_rankings = results_by_fraction[1.0]
    top_players = full_rankings.head(10)["Username"].values

    print(f"\nTop 10 players (full data): {', '.join(top_players[:5])}...")
    print("\nRank changes for top players across fractions:")
    print("-" * 80)

    for player in top_players[:5]:
        ranks = []
        for frac in fractions:
            df = results_by_fraction[frac]
            player_rank = df[df["Username"] == player]["Rank"].values
            if len(player_rank) > 0:
                ranks.append(player_rank[0])
            else:
                ranks.append(None)

        rank_str = " → ".join([f"{r}" if r else "N/A" for r in ranks])
        print(f"{player:30s}: {rank_str}")

    # Compute rank correlation
    print("\n" + "-" * 80)
    print("Rank correlations with full data:")
    print("-" * 80)
    full_strengths = results_by_fraction[1.0].set_index("Username")["BT_Strength"]

    for frac in fractions[:-1]:  # Exclude 1.0
        df = results_by_fraction[frac]
        # Get common players
        common = df[df["Username"].isin(full_strengths.index)]
        if len(common) > 0:
            corr = np.corrcoef(
                common["BT_Strength"].values, full_strengths[common["Username"]].values
            )[0, 1]
            print(f"  {frac:.1%} of games: correlation = {corr:.4f}")

    return results_by_fraction


def compare_thresholds(
    filepath: str = "showdown_tsvs/gen1ou.tsv",
    thresholds: List[int] = [5, 10, 20, 50, 100],
    n_bootstrap: int = 30,
) -> Dict[int, pd.DataFrame]:
    """
    Method 3: Compare rankings with different minimum game thresholds.

    Fit the model multiple times with different min_games values and see
    how the top rankings change. Stable top rankings suggest the threshold is good.
    """
    print("\n" + "=" * 80)
    print("METHOD 3: RANKING STABILITY ACROSS THRESHOLDS")
    print("=" * 80)
    print(f"Testing thresholds: {thresholds}")

    results_by_threshold = {}

    for threshold in thresholds:
        print(f"\n--- Testing min_games = {threshold} ---")
        h2h = HeadToHeadMatrix(filepath=filepath, min_games=threshold)
        print(f"  Players included: {len(h2h.players)}")

        bt_model = BradleyTerryModel(h2h)

        # Fit with small bootstrap for uncertainty
        boot_results = bt_model.fit_bootstrap(
            n_bootstrap=n_bootstrap,
            method="resample",
            fit_method="lbfgs",
            min_games=0,
            regularization=0.01,
            verbose=False,
        )

        rankings = bt_model.get_rankings_with_uncertainty(boot_results)
        rankings["Min_Games_Threshold"] = threshold
        rankings["Total_Games"] = rankings["Total_Wins"] + rankings["Total_Losses"]

        results_by_threshold[threshold] = rankings

        print(
            f"  Top player: {rankings.iloc[0]['Username']} "
            f"(strength: {rankings.iloc[0]['BT_Strength']:.4f} ± {rankings.iloc[0]['BT_Std']:.4f})"
        )

    # Analyze stability of top players
    print("\n" + "-" * 80)
    print("TOP 10 CONSISTENCY ACROSS THRESHOLDS")
    print("-" * 80)

    # Get top 10 from most restrictive threshold
    strictest = max(thresholds)
    top_players = results_by_threshold[strictest].head(10)["Username"].values

    print(f"\nUsing top 10 from min_games={strictest} as reference")
    print("\nRanks across thresholds:")
    print("-" * 80)
    print(f"{'Player':<30} " + " ".join([f"{t:>6}" for t in thresholds]))
    print("-" * 80)

    for player in top_players:
        ranks = []
        for threshold in thresholds:
            df = results_by_threshold[threshold]
            player_data = df[df["Username"] == player]
            if len(player_data) > 0:
                ranks.append(f"{player_data.iloc[0]['Rank']:>6}")
            else:
                ranks.append(f"{'N/A':>6}")

        print(f"{player:<30} " + " ".join(ranks))

    return results_by_threshold


def analyze_prediction_by_games(
    filepath: str = "showdown_tsvs/gen1ou.tsv", min_games: int = 5
) -> pd.DataFrame:
    """
    Method 4: How does prediction accuracy vary by game count?

    Players with more games should be more predictable. This helps validate
    that uncertainty decreases with game count.
    """
    print("\n" + "=" * 80)
    print("METHOD 4: PREDICTION ACCURACY BY GAME COUNT")
    print("=" * 80)

    h2h = HeadToHeadMatrix(filepath=filepath, min_games=min_games)
    bt_model = BradleyTerryModel(h2h)

    # Fit model
    print("Fitting model...")
    bt_model.fit_logistic(
        method="lbfgs", min_games=0, regularization=0.01, verbose=False
    )

    # Analyze prediction errors by game count
    print("\nAnalyzing prediction errors by game count...")

    game_bins = [0, 20, 50, 100, 200, 500, 10000]
    bin_labels = ["0-20", "20-50", "50-100", "100-200", "200-500", "500+"]

    results = []

    for i in range(len(h2h.players)):
        total_games_i = np.sum(h2h.wins_matrix[i, :]) + np.sum(h2h.wins_matrix[:, i])

        for j in range(len(h2h.players)):
            if i != j:
                total_games_ij = h2h.wins_matrix[i, j] + h2h.wins_matrix[j, i]

                if total_games_ij >= 10:  # Only consider matchups with enough games
                    wins = h2h.wins_matrix[i, j]
                    actual_rate = wins / total_games_ij if total_games_ij > 0 else 0.5
                    pred_prob = bt_model.predict_win_probability(i, j)
                    error = abs(pred_prob - actual_rate)

                    results.append(
                        {
                            "player_i": h2h.players[i]["Username"],
                            "player_j": h2h.players[j]["Username"],
                            "total_games_i": total_games_i,
                            "matchup_games": total_games_ij,
                            "actual": actual_rate,
                            "predicted": pred_prob,
                            "error": error,
                        }
                    )

    df = pd.DataFrame(results)
    df["game_bin"] = pd.cut(df["total_games_i"], bins=game_bins, labels=bin_labels)

    print("\nPrediction error by player game count:")
    print("-" * 80)
    print(
        f"{'Player Games':<15} {'N Matchups':<15} {'Mean Error':<15} {'Median Error':<15}"
    )
    print("-" * 80)

    for label in bin_labels:
        bin_data = df[df["game_bin"] == label]
        if len(bin_data) > 0:
            print(
                f"{label:<15} {len(bin_data):<15} "
                f"{bin_data['error'].mean():<15.4f} "
                f"{bin_data['error'].median():<15.4f}"
            )

    return df


def generate_recommendations(
    uncertainty_df: pd.DataFrame, threshold_results: Dict[int, pd.DataFrame]
) -> None:
    """
    Generate recommendations based on all analyses.
    """
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS FOR MINIMUM GAMES THRESHOLD")
    print("=" * 80)

    # Analyze uncertainty thresholds
    uncertainty_df["Total_Games"] = (
        uncertainty_df["Total_Wins"] + uncertainty_df["Total_Losses"]
    )

    # Find game counts for different std thresholds
    std_thresholds = [0.01, 0.02, 0.05, 0.10]

    print("\nGame count needed for target uncertainty levels:")
    print("-" * 80)
    print(f"{'Target Std':<15} {'Est. Games Needed':<25} {'% Players Meeting':<20}")
    print("-" * 80)

    for std_thresh in std_thresholds:
        players_meeting = uncertainty_df[uncertainty_df["BT_Std"] <= std_thresh]
        if len(players_meeting) > 0:
            median_games = players_meeting["Total_Games"].median()
            pct_meeting = 100 * len(players_meeting) / len(uncertainty_df)
            print(f"{std_thresh:<15.3f} {median_games:<25.0f} {pct_meeting:<20.1f}%")
        else:
            print(f"{std_thresh:<15.3f} {'No players':<25} {'0.0%':<20}")

    # Recommendations
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS:")
    print("=" * 80)

    # Find 80th percentile of games among top 20% of players by std
    top_20_pct = uncertainty_df.nsmallest(int(len(uncertainty_df) * 0.2), "BT_Std")
    recommended_min = int(top_20_pct["Total_Games"].quantile(0.2))

    print(f"\n1. RECOMMENDED MINIMUM: {recommended_min} games")
    print(f"   - This ensures top 20% most certain players are included")
    print(f"   - Balances reliability with sample size")

    # Conservative option
    conservative = int(
        uncertainty_df[uncertainty_df["BT_Std"] <= 0.02]["Total_Games"].quantile(0.2)
    )
    print(f"\n2. CONSERVATIVE OPTION: {conservative} games")
    print(f"   - For high-stakes rankings (tournaments, prizes)")
    print(f"   - Most estimates have std <= 0.02")

    # Inclusive option
    inclusive = int(
        uncertainty_df[uncertainty_df["BT_Std"] <= 0.05]["Total_Games"].quantile(0.2)
    )
    print(f"\n3. INCLUSIVE OPTION: {inclusive} games")
    print(f"   - For exploratory rankings, community engagement")
    print(f"   - Includes more players, accepts higher uncertainty")

    # Stability-based recommendation
    print(f"\n4. BASED ON THRESHOLD STABILITY:")
    # Find where number of players stabilizes
    player_counts = [(t, len(df)) for t, df in threshold_results.items()]
    player_counts.sort()

    print(f"   Player count by threshold:")
    for thresh, count in player_counts:
        print(f"     {thresh:>3} games: {count:>4} players")

    # Find elbow point (where adding more players slows down)
    if len(player_counts) >= 3:
        deltas = [
            player_counts[i + 1][1] - player_counts[i][1]
            for i in range(len(player_counts) - 1)
        ]
        elbow_idx = deltas.index(min(deltas))
        elbow_threshold = player_counts[elbow_idx + 1][0]
        print(f"   → Elbow point at {elbow_threshold} games (diminishing returns)")


def main():
    """Run all analyses."""
    print("=" * 80)
    print("MINIMUM GAMES THRESHOLD ANALYSIS")
    print("=" * 80)
    print("\nThis analysis determines how many games a player needs")
    print("to have a reliable Bradley-Terry ranking estimate.")
    print()

    filepath = "showdown_tsvs/gen1ou.tsv"

    # Method 1: Uncertainty vs games
    print("\nRunning Method 1: Direct uncertainty analysis...")
    uncertainty_df = analyze_uncertainty_vs_games(
        filepath=filepath, min_games=5, n_bootstrap=50
    )

    # Method 2: Subsampling stability (user's suggestion!)
    print("\nRunning Method 2: Subsampling stability test...")
    subsample_results = test_subsampling_stability(
        filepath=filepath,
        high_threshold=100,
        fractions=[0.2, 0.4, 0.6, 0.8, 1.0],
        n_bootstrap=30,
    )

    # Method 3: Compare thresholds
    print("\nRunning Method 3: Threshold comparison...")
    threshold_results = compare_thresholds(
        filepath=filepath, thresholds=[5, 10, 20, 50, 100], n_bootstrap=30
    )

    # Method 4: Prediction accuracy
    print("\nRunning Method 4: Prediction accuracy by games...")
    prediction_df = analyze_prediction_by_games(filepath=filepath, min_games=5)

    # Generate recommendations
    generate_recommendations(uncertainty_df, threshold_results)

    # Optional: Save detailed results
    print("\n" + "=" * 80)
    print("SAVING RESULTS")
    print("=" * 80)

    uncertainty_df.to_csv("min_games_analysis_uncertainty.csv", index=False)
    print("✓ Saved uncertainty analysis to: min_games_analysis_uncertainty.csv")

    prediction_df.to_csv("min_games_analysis_predictions.csv", index=False)
    print("✓ Saved prediction analysis to: min_games_analysis_predictions.csv")

    # Save threshold comparison
    combined = pd.concat(
        [df.assign(threshold=t) for t, df in threshold_results.items()]
    )
    combined.to_csv("min_games_analysis_thresholds.csv", index=False)
    print("✓ Saved threshold comparison to: min_games_analysis_thresholds.csv")

    print("\n" + "=" * 80)
    print("ANALYSIS COMPLETE!")
    print("=" * 80)


if __name__ == "__main__":
    main()
