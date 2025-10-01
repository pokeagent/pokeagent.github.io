#!/usr/bin/env python3
"""
Convenience wrapper for running Bradley-Terry analysis.
This script is at the top level for easy access.
"""

import sys


def print_help():
    print(
        """
Bradley-Terry Analysis Tools
============================

Usage: python run_bt_analysis.py [command]

Commands:
  main              Run main analysis with bootstrap (default)
  bootstrap         Run bootstrap examples
  quick-check       Quick minimum games threshold check (2-3 min)
  analyze           Comprehensive minimum games analysis (10-15 min)
  help              Show this help message

Examples:
  python run_bt_analysis.py main
  python run_bt_analysis.py quick-check
  python run_bt_analysis.py analyze

Note: You can also run modules directly:
  python -m bt.whr
  python bt/quick_min_games_check.py
  python bt/analyze_min_games.py
"""
    )


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "main"

    if command == "help" or command == "--help" or command == "-h":
        print_help()
        return

    if command == "main":
        print("Running main Bradley-Terry analysis...")
        from bt.whr import main

        main()

    elif command == "bootstrap":
        print("Running bootstrap examples...")
        import bt.bootstrap_example as be

        be.main()

    elif command == "quick-check":
        print("Running quick minimum games check...")
        import bt.quick_min_games_check as qm

        qm.quick_check()

    elif command == "analyze":
        print("Running comprehensive minimum games analysis...")
        import bt.analyze_min_games as am

        am.main()

    else:
        print(f"Unknown command: {command}")
        print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
