#!/usr/bin/env python3
"""
Validate that all WHR entries in track1.json have consistent min_games_threshold values.
"""

import json
import sys


def validate_whr_consistency(json_path="track1.json"):
    """Check all WHR entries for consistent min_games_threshold."""

    print("=" * 70)
    print("WHR CONSISTENCY VALIDATION")
    print("=" * 70)

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ {json_path} not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing {json_path}: {e}")
        return False

    min_games_values = set()
    players_with_whr = []
    players_without_threshold = []

    # Check all formats
    for format_name, players in data.get("formats", {}).items():
        print(f"\nChecking {format_name}...")
        format_whr_count = 0

        for player in players:
            username = player.get("username", {}).get("display", "Unknown")

            if player.get("whr") and player["whr"]:
                format_whr_count += 1

                if "min_games_threshold" in player["whr"]:
                    threshold = player["whr"]["min_games_threshold"]
                    min_games_values.add(threshold)
                    players_with_whr.append(
                        {
                            "format": format_name,
                            "username": username,
                            "threshold": threshold,
                            "games": player["whr"].get("games_played", "N/A"),
                        }
                    )
                else:
                    players_without_threshold.append(
                        {"format": format_name, "username": username}
                    )

        print(f"  Players with WHR: {format_whr_count}")

    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    print(f"\nTotal players with WHR data: {len(players_with_whr)}")
    print(f"Players missing min_games_threshold: {len(players_without_threshold)}")

    if players_without_threshold:
        print("\n⚠️  Players without min_games_threshold:")
        for p in players_without_threshold[:10]:  # Show first 10
            print(f"  - {p['format']}: {p['username']}")
        if len(players_without_threshold) > 10:
            print(f"  ... and {len(players_without_threshold) - 10} more")

    print(f"\nUnique min_games_threshold values found: {len(min_games_values)}")

    if len(min_games_values) == 0:
        print("❌ NO min_games_threshold values found in any WHR data!")
        return False
    elif len(min_games_values) == 1:
        threshold = list(min_games_values)[0]
        print(f"✅ ALL WHR entries have consistent threshold: {threshold} games")

        # Show sample of players
        print(f"\nSample players with WHR (threshold={threshold}):")
        for p in players_with_whr[:5]:
            print(f"  - {p['format']}: {p['username']} ({p['games']} games played)")

        return True
    else:
        print(f"❌ INCONSISTENT threshold values found: {sorted(min_games_values)}")

        # Group by threshold
        by_threshold = {}
        for p in players_with_whr:
            t = p["threshold"]
            if t not in by_threshold:
                by_threshold[t] = []
            by_threshold[t].append(p)

        print("\nBreakdown by threshold:")
        for threshold in sorted(by_threshold.keys()):
            print(f"  {threshold} games: {len(by_threshold[threshold])} players")
            for p in by_threshold[threshold][:3]:
                print(f"    - {p['format']}: {p['username']}")

        return False


if __name__ == "__main__":
    success = validate_whr_consistency()
    sys.exit(0 if success else 1)
