#!/usr/bin/env python3
"""
Compute Whole History Rating (WHR) using Bradley-Terry model with bootstrap.
Updates track1.json with BT Elo ratings and uncertainty estimates.

Uses sqrt normalization by default: weights matchup contributions by the square root
of total games played, balancing informativeness with preventing high-volume matchups
from dominating the model.
"""

import json
import sys
from pathlib import Path
from whr import HeadToHeadMatrix, BradleyTerryModel
import numpy as np


def compute_whr_for_format(
    tsv_path: str, format_name: str, min_games: int, n_bootstrap: int = 100
):
    """
    Compute WHR (BT Elo) ratings for a specific format.

    Args:
        tsv_path: Path to TSV file
        format_name: Format name (e.g., 'gen1ou')
        min_games: Minimum games required for WHR rating
        n_bootstrap: Number of bootstrap samples

    Returns:
        Dictionary mapping username to WHR data, or None if insufficient data
    """
    print(f"\n{'='*70}")
    print(f"Computing WHR for {format_name.upper()}")
    print(f"{'='*70}")
    print(f"TSV file: {tsv_path}")
    print(f"Minimum games: {min_games}")
    print(f"Bootstrap samples: {n_bootstrap}")

    try:
        # Load data with min_games filter
        h2h = HeadToHeadMatrix(filepath=tsv_path, min_games=min_games)

        if len(h2h.players) < 3:
            print(
                f"⚠️  Only {len(h2h.players)} players with >= {min_games} games. Skipping {format_name}."
            )
            return None

        print(f"✓ Loaded {len(h2h.players)} players with >= {min_games} games")

        # Fit Bradley-Terry model with bootstrap
        print("Fitting Bradley-Terry model with bootstrap (sqrt normalization)...")
        bt_model = BradleyTerryModel(h2h)

        bootstrap_results = bt_model.fit_bootstrap(
            n_bootstrap=n_bootstrap,
            method="resample",
            fit_method="lbfgs",
            min_games=0,  # Already filtered in HeadToHeadMatrix
            regularization=0.01,
            verbose=False,
            normalize_matchups="sqrt",  # Use sqrt normalization by default
        )

        print("✓ Model fitted successfully")

        # Get rankings with Elo uncertainty
        print("Converting to Elo scale with uncertainty...")
        rankings = bt_model.get_rankings_with_elo_uncertainty(
            bootstrap_results=bootstrap_results, center=1500.0, scale=400.0
        )

        print("✓ Conversion complete")

        # Create username -> WHR data mapping
        whr_data = {}
        for _, row in rankings.iterrows():
            whr_data[row["Username"]] = {
                "bt_strength": float(row["BT_Strength"]),
                "bt_std": float(row["BT_Std"]),
                "whr_elo": float(row["BT_Elo"]),
                "whr_std": float(row["Elo_Std"]),
                "whr_ci_lower": float(row["Elo_CI_Lower"]),
                "whr_ci_upper": float(row["Elo_CI_Upper"]),
                "whr_rank": int(row["Rank"]),
                "games_played": int(row["Total_Wins"] + row["Total_Losses"]),
                "min_games_threshold": min_games,
            }

        print(f"✓ Computed WHR for {len(whr_data)} players")
        print(
            f"  WHR range: [{rankings['BT_Elo'].min():.1f}, {rankings['BT_Elo'].max():.1f}]"
        )
        print(f"  Mean uncertainty: {rankings['Elo_Std'].mean():.1f} Elo points")

        return whr_data

    except Exception as e:
        print(f"❌ Error computing WHR for {format_name}: {e}")
        import traceback

        traceback.print_exc()
        return None


def update_track1_json(track1_path: str, whr_data_by_format: dict, min_games: int):
    """
    Update track1.json with WHR data.

    Args:
        track1_path: Path to track1.json
        whr_data_by_format: Dict mapping format name to WHR data dict
        min_games: Minimum games threshold (for metadata)
    """
    print(f"\n{'='*70}")
    print("UPDATING track1.json")
    print(f"{'='*70}")

    # Load existing track1.json
    try:
        with open(track1_path, "r") as f:
            track1_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ {track1_path} not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing {track1_path}: {e}")
        return False

    print(f"✓ Loaded {track1_path}")

    # Add WHR metadata
    if "metadata" not in track1_data:
        track1_data["metadata"] = {}

    track1_data["metadata"]["whr_min_games"] = min_games
    track1_data["metadata"]["whr_updated"] = track1_data.get("last_updated", "")
    track1_data["metadata"][
        "whr_note"
    ] = f"Whole History Rating (WHR) computed using Bradley-Terry model with bootstrap. Requires {min_games}+ games."

    # Update each format
    updates_count = 0
    clears_count = 0

    for format_name, format_data in track1_data.get("formats", {}).items():
        whr_data = whr_data_by_format.get(format_name, {})

        print(f"\nUpdating {format_name}...")

        for player in format_data:
            username = player["username"].get(
                "original", player["username"].get("display", "")
            )

            # Check if this player has WHR data
            if username in whr_data:
                # Update with WHR data
                player["whr"] = whr_data[username]
                updates_count += 1
            else:
                # Clear WHR data (player doesn't meet minimum games)
                if "whr" in player and player["whr"]:
                    player["whr"] = None
                    clears_count += 1

        if whr_data:
            print(
                f"  ✓ Updated {len([p for p in format_data if p.get('whr')])} players with WHR data"
            )
        else:
            print(
                f"  ⚠️  No WHR data computed (insufficient players with {min_games}+ games)"
            )

    # Save updated track1.json
    try:
        with open(track1_path, "w") as f:
            json.dump(track1_data, f, indent=2)
        print(f"\n✓ Successfully updated {track1_path}")
        print(f"  - Added/updated WHR for {updates_count} player entries")
        if clears_count > 0:
            print(f"  - Cleared WHR for {clears_count} players (insufficient games)")
        return True
    except Exception as e:
        print(f"❌ Error saving {track1_path}: {e}")
        return False


def main():
    """Main function."""
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python3 compute_whr_rankings.py <min_games> [n_bootstrap]")
        print("\nExample:")
        print("  python3 compute_whr_rankings.py 150")
        print("  python3 compute_whr_rankings.py 150 200")
        sys.exit(1)

    min_games = int(sys.argv[1])
    n_bootstrap = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    print("=" * 70)
    print("WHOLE HISTORY RATING (WHR) COMPUTATION")
    print("=" * 70)
    print(f"Minimum games required: {min_games}")
    print(f"Bootstrap samples: {n_bootstrap}")
    print()

    # Define formats to process
    formats = {
        "gen1ou": "showdown_tsvs/gen1ou.tsv",
        "gen2ou": "showdown_tsvs/gen2ou.tsv",
        "gen3ou": "showdown_tsvs/gen3ou.tsv",
        "gen9ou": "showdown_tsvs/gen9ou.tsv",
    }

    # Compute WHR for each format
    whr_data_by_format = {}

    for format_name, tsv_path in formats.items():
        if Path(tsv_path).exists():
            whr_data = compute_whr_for_format(
                tsv_path=tsv_path,
                format_name=format_name,
                min_games=min_games,
                n_bootstrap=n_bootstrap,
            )
            if whr_data:
                whr_data_by_format[format_name] = whr_data
        else:
            print(f"\n⚠️  {tsv_path} not found, skipping {format_name}")

    # Update track1.json
    if whr_data_by_format:
        success = update_track1_json(
            track1_path="track1.json",
            whr_data_by_format=whr_data_by_format,
            min_games=min_games,
        )

        if success:
            print("\n" + "=" * 70)
            print("✅ WHR COMPUTATION COMPLETE")
            print("=" * 70)
            print(f"Updated {len(whr_data_by_format)} format(s) with WHR data")
            print(f"Minimum games threshold: {min_games}")
            print(f"Results saved to track1.json")
        else:
            print("\n❌ Failed to update track1.json")
            sys.exit(1)
    else:
        print("\n⚠️  No WHR data computed for any format")
        print(
            "This may be because no format has enough players with the minimum games requirement."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
