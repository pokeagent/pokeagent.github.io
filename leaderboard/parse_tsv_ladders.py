#!/usr/bin/env python3
"""
TSV Ladder Parser

Parses the real TSV ladder files from PokéAgent Showdown to extract all PAC usernames.

Usage: python parse_tsv_ladders.py
"""

import json
import csv
import os
import re
from datetime import datetime, timezone


def format_username(username):
    """Format username for display with improved naming conventions."""
    if not username.startswith("PAC-"):
        return None

    # Remove PAC- prefix
    display_name = username[4:]

    # Apply naming conventions
    if display_name.startswith("MM-"):
        # MM- becomes Metamon- and remove generation suffixes like -9, -2, -g3, etc.
        base_name = display_name[3:]  # Remove MM-
        # Handle special cases first
        base_name = re.sub(
            r"SP[2-9]$", "SelfPlay", base_name
        )  # SP2, SP3, SP4 -> SelfPlay
        # Remove generation suffixes using regex (single digits after hyphen at end)
        base_name = re.sub(
            r"-[2-9]$", "", base_name
        )  # Remove -2, -3, -4, -9 at the very end
        base_name = re.sub(r"-g[0-9]+$", "", base_name)  # Remove -g3, -g9
        base_name = re.sub(r"-G[0-9]+$", "", base_name)  # Remove -G3, -G9
        display_name = "Metamon-" + base_name

    elif display_name.startswith("BH-"):
        # BH- becomes Heuristic- and remove generation suffixes
        base_name = display_name[3:]  # Remove BH-
        # Handle special cases first
        base_name = re.sub(
            r"SP[2-9]$", "SelfPlay", base_name
        )  # SP2, SP3, SP4 -> SelfPlay
        # Remove generation suffixes using regex (single digits after hyphen at end)
        base_name = re.sub(
            r"-[2-9]$", "", base_name
        )  # Remove -2, -3, -4, -9 at the very end
        base_name = re.sub(r"-g[0-9]+$", "", base_name)  # Remove -g3, -g9
        base_name = re.sub(r"-G[0-9]+$", "", base_name)  # Remove -G3, -G9
        display_name = "Heuristic-" + base_name

    elif display_name.startswith("PC-"):
        # PC- becomes PokéChamp- and remove generation suffixes
        base_name = display_name[3:]  # Remove PC-
        # Handle special cases first
        base_name = re.sub(
            r"SP[2-9]$", "SelfPlay", base_name
        )  # SP2, SP3, SP4 -> SelfPlay
        # Remove generation suffixes using regex (single digits after hyphen at end)
        base_name = re.sub(
            r"-[2-9]$", "", base_name
        )  # Remove -2, -3, -4, -9 at the very end
        base_name = re.sub(r"-g[0-9]+$", "", base_name)  # Remove -g3, -g9
        base_name = re.sub(r"-G[0-9]+$", "", base_name)  # Remove -G3, -G9
        display_name = "PokéChamp-" + base_name

    # Determine if this should be styled (MM, BH, PC entries)
    is_starter_kit = (
        username.startswith("PAC-MM-")
        or username.startswith("PAC-BH-")
        or username.startswith("PAC-PC-")
    )

    return {
        "original": username,
        "display": display_name,
        "is_starter_kit": is_starter_kit,
    }


def parse_tsv_file(filename):
    """Parse a TSV file and extract player data."""
    players = []

    if not os.path.exists(filename):
        print(f"❌ File not found: {filename}")
        return players

    try:
        with open(filename, "r", encoding="utf-8") as f:
            # Read the TSV file
            reader = csv.DictReader(f, delimiter="\t")

            rank = 1
            for row in reader:
                username = row.get("Username", "").strip()

                # Only process PAC usernames
                if not username.startswith("PAC-"):
                    continue

                # Extract data from the row
                elo = row.get("Elo", "").strip()
                wins = row.get("W", "").strip()
                losses = row.get("L", "").strip()
                glicko = row.get("Glicko", "").strip()
                gxe = row.get("GXE", "").strip()
                rating_deviation = row.get("Rating_Deviation", "").strip()

                # Clean up the data - handle missing/invalid values
                try:
                    elo_float = float(elo)
                    elo = str(int(elo_float))
                except (ValueError, TypeError):
                    elo = "-"

                try:
                    glicko_float = float(glicko)
                    glicko = str(int(glicko_float))
                except (ValueError, TypeError):
                    glicko = "-"

                # Format GXE as percentage if needed
                if gxe and gxe not in ["-", ""]:
                    if not gxe.endswith("%"):
                    try:
                        gxe_float = float(gxe)
                        gxe = f"{gxe_float:.2f}%"
                    except (ValueError, TypeError):
                            gxe = "-"
                else:
                    gxe = "-"

                player_data = {
                    "rank": rank,
                    "username": username,
                    "elo": elo,
                    "gxe": gxe,
                    "glicko": glicko,
                    "wins": wins if wins else "0",
                    "losses": losses if losses else "0",
                }

                players.append(player_data)
                rank += 1
                print(f"✅ Found: {username} (ELO: {elo})")

    except Exception as e:
        print(f"❌ Error parsing {filename}: {e}")

    return players


def main():
    """Main function."""
    print("🎯 Parsing real TSV ladder files...")

    # Files to parse (all available formats)
    files_to_parse = {
        "gen1ou": "gen1ou.tsv",
        "gen2ou": "gen2ou.tsv",
        "gen3ou": "gen3ou.tsv",
        "gen4ou": "gen4ou.tsv",
        "gen9ou": "gen9ou.tsv",
    }

    all_data = {}

    for format_name, filename in files_to_parse.items():
        print(f"\n📊 Parsing {format_name} from {filename}...")
        players = parse_tsv_file(os.path.join("showdown_tsvs", filename))

        if players:
            print(f"✅ Found {len(players)} PAC users in {format_name}")

            # Format the data for display
            formatted_players = []
            for player in players:
                username_data = format_username(player["username"])
                if username_data:
                    formatted_players.append(
                        {
                            "rank": player["rank"],
                            "username": username_data,
                            "elo": player["elo"],
                            "gxe": player["gxe"],
                            "glicko": player["glicko"],
                            "wins": player["wins"],
                            "losses": player["losses"],
                        }
                    )

            all_data[format_name] = formatted_players
        else:
            print(f"❌ No PAC users found in {format_name}")
            all_data[format_name] = []

    # Create output directory if it doesn't exist

    # Save the data
    output_file = "track1.json"
    output_data = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "formats": all_data,
        "source": "tsv_files",
    }

    with open(output_file, "w") as f:
        json.dump(output_data, f, indent=2)

    total_players = sum(len(players) for players in all_data.values())
    print(f"\n💾 Saved {total_players} players to {output_file}")

    # Show summary
    for format_name, players in all_data.items():
        if not players:
            continue

        starter_kits = sum(1 for p in players if p["username"]["is_starter_kit"])
        custom = len(players) - starter_kits
        print(
            f"   {format_name.upper()}: {len(players)} players ({starter_kits} starter kit, {custom} custom)"
        )

        # Show first few usernames to verify
        if players:
            sample_names = [p["username"]["display"] for p in players[:5]]
            print(f"      Top 5: {', '.join(sample_names)}")


if __name__ == "__main__":
    main()
