#!/usr/bin/env python3
"""
Compute the full head-to-head win matrix from Pokemon battle data.
This recreates the logic from headToHeadMatrix.js in Python.
Also implements Bradley-Terry model for skill estimation.
"""

import pandas as pd
import numpy as np
import json
from typing import Dict, List, Tuple, Optional
from scipy.sparse import lil_matrix
from scipy.optimize import minimize


class HeadToHeadMatrix:
    def __init__(self, filepath: str = "showdown_tsvs/gen1ou.tsv", min_games: int = 10):
        """
        Initialize the H2H matrix calculator.

        Args:
            filepath: Path to TSV file with battle data (default: showdown_tsvs/gen1ou.tsv)
            min_games: Minimum games required to be considered in the rankings
        """
        self.min_games = min_games
        self.players = []
        self.filepath = filepath
        self._load_data(filepath)
        self._compute_matrix()

    def _username_to_h2h_key(self, username: str) -> str:
        return "".join(c for c in username.lower() if c.isalnum())

    def _load_data(self, filepath: str = "showdown_tsvs/gen1ou.tsv") -> None:
        df = pd.read_csv(filepath, sep="\t")
        filtered_df = df[df["W"] + df["L"] + df["T"] >= self.min_games].copy()
        filtered_df = filtered_df.sort_values("Elo", ascending=False).reset_index(
            drop=True
        )
        self.players = []
        for _, row in filtered_df.iterrows():
            try:
                h2h_data = (
                    json.loads(row["H2H_Data"]) if pd.notna(row["H2H_Data"]) else {}
                )
            except (json.JSONDecodeError, TypeError):
                print(
                    f"Error parsing H2H data for {row['Username']}: {row['H2H_Data']}"
                )
                h2h_data = {}

            self.players.append(
                {
                    "Username": row["Username"],
                    "Elo": row["Elo"],
                    "Glicko": row["Glicko"],
                    "Rating_Deviation": row["Rating_Deviation"],
                    "H2H_Data": h2h_data,
                }
            )

        print(
            f"Loaded {len(self.players)} players with at least {self.min_games} games"
        )

    def get_h2h_record_by_username(self, player_username: str):
        for player in self.players:
            if player["Username"] == player_username:
                return player["H2H_Data"]
        return {}

    def get_h2h_record(
        self, player1: Dict, player2_username: str
    ) -> Tuple[int, int, int, int]:
        h2h_data = player1.get("H2H_Data", {})
        player2_key = self._username_to_h2h_key(player2_username)
        record = h2h_data.get(player2_key, {})

        wins = record.get("w", 0)
        losses = record.get("l", 0)
        ties = record.get("t", 0)
        total = wins + losses + ties

        return wins, losses, ties, total

    def get_win_percentage(self, wins: int, losses: int) -> float:
        total = wins + losses
        if total == 0:
            return 0.5  # Neutral for ties only
        return wins / total

    def _compute_matrix(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        n = len(self.players)
        win_pct_matrix = np.full((n, n), np.nan)
        games_matrix = np.zeros((n, n), dtype=int)
        wins_matrix = np.zeros((n, n), dtype=int)

        for i, player1 in enumerate(self.players):
            for j, player2 in enumerate(self.players):
                if i == j:
                    # Diagonal - same player
                    win_pct_matrix[i, j] = np.nan
                    games_matrix[i, j] = 0
                    wins_matrix[i, j] = 0
                else:
                    wins, losses, ties, total = self.get_h2h_record(
                        player1, player2["Username"]
                    )
                    games_matrix[i, j] = total
                    wins_matrix[i, j] = wins

                    if total > 0:
                        win_pct_matrix[i, j] = self.get_win_percentage(wins, losses)
                    else:
                        win_pct_matrix[i, j] = np.nan

        self.win_matrix = win_pct_matrix
        self.games_matrix = games_matrix
        self.wins_matrix = wins_matrix

    def get_usernames(self) -> List[str]:
        """Get list of usernames in order."""
        return [p["Username"] for p in self.players]

    def to_dataframe(self, matrix_type: str = "win_pct") -> pd.DataFrame:
        """
        Convert matrix to pandas DataFrame with usernames as labels.

        Args:
            matrix_type: Type of matrix to return ('win_pct', 'games', or 'wins')

        Returns:
            DataFrame with usernames as both index and columns
        """
        if matrix_type == "win_pct":
            matrix = self.win_matrix
        elif matrix_type == "games":
            matrix = self.games_matrix
        elif matrix_type == "wins":
            matrix = self.wins_matrix
        else:
            raise ValueError(f"Unknown matrix_type: {matrix_type}")

        if matrix is None:
            raise ValueError("Must call compute_matrix() first")

        usernames = self.get_usernames()
        return pd.DataFrame(matrix, index=usernames, columns=usernames)

    def save_matrices(self, prefix: str = "h2h_matrix") -> None:
        """
        Save all matrices to CSV files.

        Args:
            prefix: Prefix for output filenames
        """
        if self.win_matrix is None:
            raise ValueError("Must call compute_matrix() first")

        # Save win percentage matrix
        df_win_pct = self.to_dataframe("win_pct")
        df_win_pct.to_csv(f"{prefix}_win_pct.csv")
        print(f"Saved win percentage matrix to {prefix}_win_pct.csv")

        # Save games matrix
        df_games = self.to_dataframe("games")
        df_games.to_csv(f"{prefix}_games.csv")
        print(f"Saved games matrix to {prefix}_games.csv")

        # Save wins matrix
        df_wins = self.to_dataframe("wins")
        df_wins.to_csv(f"{prefix}_wins.csv")
        print(f"Saved wins matrix to {prefix}_wins.csv")

    def print_summary(self) -> None:
        """Print summary statistics about the matrix."""
        if self.win_matrix is None:
            raise ValueError("Must call compute_matrix() first")

        n = len(self.players)
        total_matchups = n * (n - 1)  # Exclude diagonal

        # Count matchups with games played
        has_games = np.sum(self.games_matrix > 0)
        pct_with_games = 100 * has_games / total_matchups

        # Count matchups meeting min_games threshold
        meets_threshold = np.sum(self.games_matrix >= self.min_games)
        pct_meets_threshold = 100 * meets_threshold / total_matchups

        print("\n" + "=" * 60)
        print("HEAD-TO-HEAD MATRIX SUMMARY")
        print("=" * 60)
        print(f"Number of players: {n}")
        print(f"Total possible matchups: {total_matchups}")
        print(f"Matchups with games played: {has_games} ({pct_with_games:.1f}%)")
        print(
            f"Matchups with >= {self.min_games} games: {meets_threshold} ({pct_meets_threshold:.1f}%)"
        )
        print(f"Total games recorded: {np.sum(self.games_matrix)}")
        print(
            f"Average games per matchup (non-zero): {np.mean(self.games_matrix[self.games_matrix > 0]):.1f}"
        )
        print("=" * 60)


class BradleyTerryModel:
    """
    Bradley-Terry model for estimating player strengths from pairwise comparisons.

    The model assumes P(i beats j) = π_i / (π_i + π_j)
    where π_i is the strength parameter for player i.
    """

    def __init__(self, h2h_matrix: HeadToHeadMatrix):
        """
        Initialize Bradley-Terry model with H2H data.

        Args:
            h2h_matrix: HeadToHeadMatrix object with computed matrices
        """
        self.h2h = h2h_matrix
        self.n_players = len(h2h_matrix.players)
        self.strengths = None
        self.log_strengths = None

    def fit_logistic(
        self,
        method: str = "lbfgs",
        min_games: int = 0,
        regularization: float = 0.01,
        lr: float = 0.001,
        max_iter: int = 1000,
        tol: float = 1e-6,
        verbose: bool = True,
        normalize_matchups: str = None,
        max_games_per_matchup: int = None,
    ) -> np.ndarray:
        """
        Fit Bradley-Terry model using logistic regression formulation.

        The Bradley-Terry model can be written as:
        P(i beats j) = 1 / (1 + exp(-(θ_i - θ_j)))

        where θ_i = log(π_i) is the log-strength parameter.

        This is equivalent to logistic regression with features being
        the difference in player parameters.

        Args:
            method: Optimization method ('lbfgs', 'gradient_descent', or 'newton')
            min_games: Minimum games required to include a matchup
            regularization: L2 regularization parameter (ridge penalty)
            lr: Learning rate for gradient descent (default: 0.001)
            max_iter: Maximum iterations for gradient descent (default: 1000)
            tol: Convergence tolerance for gradient descent (default: 1e-6)
            verbose: Whether to print progress (default: True)
            normalize_matchups: How to weight matchup contributions (None, 'equal_weight', 'sqrt', 'cap')
                None: Use all games (default)
                'equal_weight': Each matchup contributes equally regardless of game count
                'sqrt': Weight by sqrt(total games), balancing informativeness with preventing domination
                'cap': Cap games per matchup at max_games_per_matchup
            max_games_per_matchup: Maximum games to use per matchup (only used with normalize_matchups='cap')

        Returns:
            Array of strength parameters (π values)
        """
        vprint = print if verbose else lambda *a, **k: None

        if self.h2h.wins_matrix is None:
            raise ValueError("Must compute H2H matrices first")

        # Build dataset from pairwise comparisons
        if normalize_matchups:
            vprint(
                f"Building comparison dataset with {normalize_matchups} normalization..."
            )
        else:
            vprint("Building comparison dataset...")
        comparisons = []
        for i in range(self.n_players):
            for j in range(self.n_players):
                if i != j:
                    n_ij = self.h2h.wins_matrix[i, j]  # wins by i over j
                    n_ji = self.h2h.wins_matrix[j, i]  # wins by j over i
                    total = n_ij + n_ji

                    if total >= min_games and total > 0:
                        # Apply normalization/weighting
                        if normalize_matchups == "cap" and max_games_per_matchup:
                            if total > max_games_per_matchup:
                                scale_factor = max_games_per_matchup / total
                                n_ij_use = int(round(n_ij * scale_factor))
                                n_ji_use = int(round(n_ji * scale_factor))
                            else:
                                n_ij_use = int(n_ij)
                                n_ji_use = int(n_ji)
                        elif normalize_matchups == "equal_weight":
                            # Each matchup contributes exactly 1 label, proportional to win rate
                            n_ij_use = 1 if n_ij > 0 else 0
                            n_ji_use = 1 if n_ji > 0 else 0
                        elif normalize_matchups == "sqrt":
                            # Weight by sqrt of total games
                            sqrt_total = np.sqrt(total)
                            win_rate = n_ij / total if total > 0 else 0.5
                            loss_rate = n_ji / total if total > 0 else 0.5
                            # Ensure at least 1 label if there were any games
                            n_ij_use = (
                                max(1, int(round(win_rate * sqrt_total)))
                                if n_ij > 0
                                else 0
                            )
                            n_ji_use = (
                                max(1, int(round(loss_rate * sqrt_total)))
                                if n_ji > 0
                                else 0
                            )
                        else:
                            # No normalization - use all games
                            n_ij_use = int(n_ij)
                            n_ji_use = int(n_ji)

                        # Add the normalized number of comparisons
                        for _ in range(n_ij_use):
                            comparisons.append((i, j, 1))
                        for _ in range(n_ji_use):
                            comparisons.append((i, j, 0))

        n_comparisons = len(comparisons)
        vprint(f"   Built dataset with {n_comparisons:,} pairwise comparisons")
        vprint(f"   Starting optimization...")

        if method == "lbfgs":
            theta = self._fit_logistic_lbfgs(
                comparisons, regularization, verbose=verbose
            )
        elif method == "gradient_descent":
            theta = self._fit_logistic_gd(
                comparisons,
                regularization,
                max_iter=max_iter,
                lr=lr,
                tol=tol,
                verbose=verbose,
            )
        elif method == "newton":
            theta = self._fit_logistic_newton(
                comparisons, regularization, verbose=verbose
            )
        else:
            raise ValueError(f"Unknown method: {method}")

        # Convert log-strengths to strengths
        self.log_strengths = theta
        self.strengths = np.exp(theta)

        # Normalize
        self.strengths = self.strengths * self.n_players / np.sum(self.strengths)
        self.log_strengths = np.log(self.strengths)

        return self.strengths

    def _fit_logistic_lbfgs(
        self, comparisons: List[Tuple[int, int, int]], reg: float, verbose: bool = True
    ) -> np.ndarray:
        """Fit using L-BFGS optimization with vectorized computations."""
        n = self.n_players

        # Convert comparisons to arrays for vectorization
        comp_array = np.array(comparisons, dtype=np.int32)
        i_idx = comp_array[:, 0]
        j_idx = comp_array[:, 1]
        outcomes = comp_array[:, 2].astype(float)
        n_comp = len(comparisons)

        iteration_count = [0]

        def negative_log_likelihood(theta):
            """Negative log-likelihood with L2 regularization (vectorized)."""
            logits = theta[i_idx] - theta[j_idx]
            # log(p) = logit - log(1 + exp(logit))
            nll = -np.sum(outcomes * logits - np.log1p(np.exp(logits)))
            nll += 0.5 * reg * np.sum(theta**2)
            return nll

        def gradient(theta):
            """Gradient of negative log-likelihood (vectorized)."""
            logits = theta[i_idx] - theta[j_idx]
            probs = 1 / (1 + np.exp(-logits))
            residuals = outcomes - probs
            grad = np.zeros(n)
            grad -= np.bincount(i_idx, weights=residuals, minlength=n)
            grad += np.bincount(j_idx, weights=residuals, minlength=n)
            grad += reg * theta
            iteration_count[0] += 1
            if iteration_count[0] % 10 == 0:
                print(
                    f"    Iteration {iteration_count[0]//2}: NLL = {negative_log_likelihood(theta):.4f}",
                    end="\r",
                )
            return grad

        # Optimize
        theta0 = np.zeros(n)
        result = minimize(
            negative_log_likelihood,
            theta0,
            method="L-BFGS-B",
            jac=gradient,
            options={"maxiter": 1000, "disp": False},
        )
        if result.success and verbose:
            print(f"L-BFGS converged in {result.nit} iterations")
        elif verbose:
            print(f"L-BFGS did not converge: {result.message}")
        return result.x

    def _fit_logistic_gd(
        self,
        comparisons: List[Tuple[int, int, int]],
        reg: float,
        max_iter: int = 1000,
        lr: float = 0.001,
        tol: float = 1e-6,
        verbose: bool = True,
    ) -> np.ndarray:
        """Fit using gradient descent (vectorized)."""
        n = self.n_players

        vprint = print if verbose else lambda *a, **k: None
        # Convert comparisons to arrays for vectorization
        comp_array = np.array(comparisons, dtype=np.int32)
        i_idx = comp_array[:, 0]
        j_idx = comp_array[:, 1]
        outcomes = comp_array[:, 2].astype(float)

        theta = np.zeros(n)

        for iteration in range(max_iter):
            # Vectorized gradient computation
            logits = theta[i_idx] - theta[j_idx]
            probs = 1 / (1 + np.exp(-logits))
            residuals = outcomes - probs

            # Accumulate gradients using bincount
            grad = np.zeros(n)
            grad += np.bincount(i_idx, weights=residuals, minlength=n)
            grad -= np.bincount(j_idx, weights=residuals, minlength=n)

            grad -= reg * theta

            # Update with learning rate
            theta_new = theta + lr * grad

            diff = np.max(np.abs(theta_new - theta))
            theta = theta_new

            if iteration % 100 == 0:
                vprint(f"    Iteration {iteration}: max_diff = {diff:.2e}", end="\r")

            if diff < tol:
                vprint(f"Gradient descent converged in {iteration + 1} iterations")
                break
        else:
            vprint(f"Gradient descent did not converge after {max_iter} iterations")

        return theta

    def _fit_logistic_newton(
        self, comparisons: List[Tuple[int, int, int]], reg: float, verbose: bool = True
    ) -> np.ndarray:
        """Fit using Newton's method (Fisher scoring) - vectorized."""
        n = self.n_players

        vprint = print if verbose else lambda *a, **k: None
        # Convert comparisons to arrays for vectorization
        comp_array = np.array(comparisons, dtype=np.int32)
        i_idx = comp_array[:, 0]
        j_idx = comp_array[:, 1]
        outcomes = comp_array[:, 2].astype(float)
        n_comp = len(comparisons)

        theta = np.zeros(n)
        max_iter = 100
        tol = 1e-6

        for iteration in range(max_iter):
            # Vectorized gradient computation
            logits = theta[i_idx] - theta[j_idx]
            probs = 1 / (1 + np.exp(-logits))
            residuals = outcomes - probs

            # Compute gradient
            grad = np.zeros(n)
            grad += np.bincount(i_idx, weights=residuals, minlength=n)
            grad -= np.bincount(j_idx, weights=residuals, minlength=n)

            # Compute Hessian (Fisher information)
            # For each comparison: w_ij = p(1-p)
            weights = probs * (1 - probs)

            # Build Hessian using sparse accumulation
            hess = np.zeros((n, n))

            # Diagonal elements: sum of weights where player appears
            np.add.at(hess, (i_idx, i_idx), weights)
            np.add.at(hess, (j_idx, j_idx), weights)

            # Off-diagonal elements: -weight for each pair
            np.add.at(hess, (i_idx, j_idx), -weights)
            np.add.at(hess, (j_idx, i_idx), -weights)

            # Add regularization
            grad -= reg * theta
            hess += reg * np.eye(n)

            # Newton step
            try:
                delta = np.linalg.solve(hess, grad)
                theta_new = theta + delta
            except np.linalg.LinAlgError:
                print("Hessian is singular, falling back to gradient descent")
                return self._fit_logistic_gd(comparisons, reg)

            # Check convergence
            diff = np.max(np.abs(theta_new - theta))
            theta = theta_new

            if iteration % 10 == 0:
                vprint(f"    Iteration {iteration}: max_diff = {diff:.2e}", end="\r")

            if diff < tol:
                vprint(f"\n  Newton's method converged in {iteration + 1} iterations")
                break
        else:
            vprint(f"\n  Newton's method did not converge after {max_iter} iterations")

        return theta

    def fit(self, method: str = "lbfgs", **kwargs) -> np.ndarray:
        """
        Fit Bradley-Terry model using specified method.

        Args:
            method: Fitting method - 'logistic', 'lbfgs', 'gradient_descent', or 'newton'
            **kwargs: Additional arguments passed to the fitting method

        Returns:
            Array of strength parameters (π values)
        """
        if method in ["logistic", "lbfgs"]:
            return self.fit_logistic(method="lbfgs", **kwargs)
        elif method == "gradient_descent":
            return self.fit_logistic(method="gradient_descent", **kwargs)
        elif method == "newton":
            return self.fit_logistic(method="newton", **kwargs)
        else:
            raise ValueError(
                f"Unknown method: {method}. Use 'logistic', 'lbfgs', 'gradient_descent', or 'newton'"
            )

    def predict_win_probability(self, i: int, j: int) -> float:
        """
        Predict probability that player i beats player j.

        Args:
            i: Index of player i
            j: Index of player j

        Returns:
            Predicted win probability
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        return self.strengths[i] / (self.strengths[i] + self.strengths[j])

    def get_rankings(self, ascending: bool = False) -> pd.DataFrame:
        """
        Get player rankings based on Bradley-Terry strengths.

        Args:
            ascending: If True, sort by ascending strength (weakest first)

        Returns:
            DataFrame with rankings and statistics
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        rankings = []
        for i, player in enumerate(self.h2h.players):
            total_wins = np.sum(self.h2h.wins_matrix[i, :])
            total_losses = np.sum(self.h2h.wins_matrix[:, i])
            total_games = total_wins + total_losses

            rankings.append(
                {
                    "Rank": 0,  # Will be filled after sorting
                    "Username": player["Username"],
                    "BT_Strength": self.strengths[i],
                    "Log_Strength": self.log_strengths[i],
                    "Total_Wins": int(total_wins),
                    "Total_Losses": int(total_losses),
                    "Total_Games": int(total_games),
                    "Win_Rate": total_wins / total_games if total_games > 0 else 0,
                    "Elo": player["Elo"],
                    "Glicko": player["Glicko"],
                }
            )

        df = pd.DataFrame(rankings)
        df = df.sort_values("BT_Strength", ascending=ascending).reset_index(drop=True)
        df["Rank"] = range(1, len(df) + 1)

        return df

    def strengths_to_elo(
        self, center: float = 1500.0, scale: float = 400.0
    ) -> np.ndarray:
        """
        Convert Bradley-Terry strengths to Elo-like ratings.

        The Bradley-Terry model uses multiplicative strengths: P(i beats j) = π_i / (π_i + π_j)
        Elo uses additive ratings: P(i beats j) = 1 / (1 + 10^((R_j - R_i)/400))

        These are mathematically equivalent when: R_i = scale × log10(π_i) + center

        Args:
            center: Center point for Elo scale (default: 1500, typical Elo center)
            scale: Scaling constant (default: 400, standard Elo scale)

        Returns:
            Array of Elo-like ratings

        Example:
            # Convert to Elo scale centered at 1500
            elo_ratings = bt_model.strengths_to_elo(center=1500, scale=400)

            # Or center at 1000 with different scale
            ratings = bt_model.strengths_to_elo(center=1000, scale=200)
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        # Convert strengths to log scale (base 10)
        log10_strengths = np.log10(self.strengths)

        # Center the log-strengths (so average player is at 'center')
        mean_log10 = np.mean(log10_strengths)
        centered_log10 = log10_strengths - mean_log10

        # Scale to Elo-like ratings
        elo_ratings = scale * centered_log10 + center

        return elo_ratings

    def strength_std_to_elo_std(
        self, strength: np.ndarray, strength_std: np.ndarray, scale: float = 400.0
    ) -> np.ndarray:
        """
        Convert Bradley-Terry strength uncertainty to Elo-scale uncertainty.

        Uses the delta method for error propagation through the logarithmic transformation.

        Given: R = scale × log10(π) + center
        Then: σ_R ≈ |dR/dπ| × σ_π = (scale / (π × ln(10))) × σ_π

        Args:
            strength: Array of BT strengths
            strength_std: Array of BT strength standard deviations
            scale: Elo scaling constant (default: 400)

        Returns:
            Array of Elo-scale standard deviations

        Example:
            # After bootstrap
            elo_std = bt_model.strength_std_to_elo_std(
                strength=bt_model.strengths,
                strength_std=bootstrap_results['std_strengths'],
                scale=400
            )
        """
        # Delta method: σ_R = |dR/dπ| × σ_π
        # where dR/dπ = scale / (π × ln(10))
        LN10 = np.log(10)  # ≈ 2.302585
        elo_std = (scale / (strength * LN10)) * strength_std

        return elo_std

    def bootstrap_to_elo_uncertainty(
        self,
        bootstrap_results: Dict[str, np.ndarray],
        center: float = 1500.0,
        scale: float = 400.0,
    ) -> Dict[str, np.ndarray]:
        """
        Convert bootstrap results to Elo-scale uncertainty estimates.

        Args:
            bootstrap_results: Results from fit_bootstrap()
            center: Elo center point (default: 1500)
            scale: Elo scaling constant (default: 400)

        Returns:
            Dictionary with Elo-scale uncertainty metrics:
                - 'elo_ratings': Array of Elo ratings for each player
                - 'elo_std': Standard deviation in Elo scale
                - 'elo_ci_lower': Lower 95% CI in Elo scale
                - 'elo_ci_upper': Upper 95% CI in Elo scale
                - 'elo_samples': All bootstrap samples in Elo scale (n_bootstrap × n_players)
        """
        # Convert all bootstrap samples to Elo scale
        strengths_samples = bootstrap_results["strengths_samples"]
        n_bootstrap, n_players = strengths_samples.shape

        elo_samples = np.zeros_like(strengths_samples)
        for i in range(n_bootstrap):
            # Convert each bootstrap sample
            log10_strengths = np.log10(strengths_samples[i, :])
            mean_log10 = np.mean(log10_strengths)
            centered_log10 = log10_strengths - mean_log10
            elo_samples[i, :] = scale * centered_log10 + center

        # Compute statistics in Elo scale
        elo_ratings = self.strengths_to_elo(center=center, scale=scale)
        elo_std = np.std(elo_samples, axis=0)
        elo_ci_lower = np.percentile(elo_samples, 2.5, axis=0)
        elo_ci_upper = np.percentile(elo_samples, 97.5, axis=0)

        return {
            "elo_ratings": elo_ratings,
            "elo_std": elo_std,
            "elo_ci_lower": elo_ci_lower,
            "elo_ci_upper": elo_ci_upper,
            "elo_samples": elo_samples,
        }

    def get_rankings_with_elo(
        self, center: float = 1500.0, scale: float = 400.0, ascending: bool = False
    ) -> pd.DataFrame:
        """
        Get player rankings with Bradley-Terry strengths converted to Elo-like scale.

        Args:
            center: Center point for Elo scale (default: 1500)
            scale: Scaling constant (default: 400)
            ascending: If True, sort by ascending strength

        Returns:
            DataFrame with rankings including both BT strength and Elo-like rating
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        # Get Elo-like ratings
        elo_ratings = self.strengths_to_elo(center=center, scale=scale)

        rankings = []
        for i, player in enumerate(self.h2h.players):
            total_wins = np.sum(self.h2h.wins_matrix[i, :])
            total_losses = np.sum(self.h2h.wins_matrix[:, i])
            total_games = total_wins + total_losses

            rankings.append(
                {
                    "Rank": 0,  # Will be filled after sorting
                    "Username": player["Username"],
                    "BT_Strength": self.strengths[i],
                    "BT_Elo": elo_ratings[i],
                    "Log_Strength": self.log_strengths[i],
                    "Total_Wins": int(total_wins),
                    "Total_Losses": int(total_losses),
                    "Total_Games": int(total_games),
                    "Win_Rate": total_wins / total_games if total_games > 0 else 0,
                    "Original_Elo": player["Elo"],
                    "Glicko": player["Glicko"],
                }
            )

        df = pd.DataFrame(rankings)
        df = df.sort_values("BT_Strength", ascending=ascending).reset_index(drop=True)
        df["Rank"] = range(1, len(df) + 1)

        return df

    def compute_log_likelihood(self) -> float:
        """
        Compute log-likelihood of the data given current parameters.

        Returns:
            Log-likelihood value
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        ll = 0
        n = self.n_players
        wins = self.h2h.wins_matrix

        for i in range(n):
            for j in range(n):
                if i != j and wins[i, j] > 0:
                    p_ij = self.predict_win_probability(i, j)
                    ll += wins[i, j] * np.log(p_ij + 1e-10)

        return ll

    def evaluate_predictions(self, min_games: int = 10) -> Dict[str, float]:
        """
        Evaluate model predictions against actual outcomes.

        Args:
            min_games: Only evaluate matchups with at least this many games

        Returns:
            Dictionary of evaluation metrics
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        predictions = []
        actuals = []

        n = self.n_players
        for i in range(n):
            for j in range(n):
                if i != j:
                    total_games = self.h2h.games_matrix[i, j]
                    if total_games >= min_games:
                        wins = self.h2h.wins_matrix[i, j]
                        actual_rate = wins / total_games
                        pred_prob = self.predict_win_probability(i, j)

                        predictions.append(pred_prob)
                        actuals.append(actual_rate)

        predictions = np.array(predictions)
        actuals = np.array(actuals)

        # Compute metrics
        mae = np.mean(np.abs(predictions - actuals))
        rmse = np.sqrt(np.mean((predictions - actuals) ** 2))

        # Accuracy (within 10% of actual)
        accuracy_10 = np.mean(np.abs(predictions - actuals) < 0.1)

        return {
            "mae": mae,
            "rmse": rmse,
            "accuracy_10pct": accuracy_10,
            "n_matchups": len(predictions),
        }

    def bootstrap_sample_games(
        self,
        method: str = "resample",
        fraction: float = 1.0,
        seed: Optional[int] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create a bootstrap sample of the games data.

        Args:
            method: 'resample' (sample with replacement), 'subsample' (sample without replacement)
            fraction: Fraction of games to sample (for subsample method)
            seed: Random seed for reproducibility

        Returns:
            Tuple of (wins_matrix, games_matrix) for the bootstrap sample
        """
        if seed is not None:
            np.random.seed(seed)

        n = self.n_players
        wins_boot = np.zeros((n, n), dtype=int)
        games_boot = np.zeros((n, n), dtype=int)

        # For each matchup, sample from the individual games
        for i in range(n):
            for j in range(n):
                if i != j:
                    wins = self.h2h.wins_matrix[i, j]
                    losses = self.h2h.wins_matrix[j, i]
                    total = wins + losses

                    if total > 0:
                        # Create array of outcomes (1 = player i wins, 0 = player j wins)
                        outcomes = np.array([1] * wins + [0] * losses)

                        if method == "resample":
                            # Bootstrap: sample with replacement
                            sample_size = total
                            sampled = np.random.choice(
                                outcomes, size=sample_size, replace=True
                            )
                        elif method == "subsample":
                            # Subsample: sample without replacement
                            sample_size = max(1, int(total * fraction))
                            sampled = np.random.choice(
                                outcomes, size=sample_size, replace=False
                            )
                        else:
                            raise ValueError(f"Unknown method: {method}")

                        # Count wins in the sample
                        wins_boot[i, j] = np.sum(sampled)
                        games_boot[i, j] = len(sampled)

        return wins_boot, games_boot

    def fit_bootstrap(
        self,
        n_bootstrap: int = 100,
        method: str = "resample",
        fraction: float = 1.0,
        fit_method: str = "logistic",
        min_games: int = 0,
        verbose: bool = True,
        **fit_kwargs,
    ) -> Dict[str, np.ndarray]:
        """
        Fit Bradley-Terry model with bootstrap to estimate uncertainty.

        Args:
            n_bootstrap: Number of bootstrap samples
            method: 'resample' (with replacement) or 'subsample' (without replacement)
            fraction: Fraction of games to sample (for subsample method)
            fit_method: Fitting method to use ('logistic', 'lbfgs', etc.)
            min_games: Minimum games for fitting
            verbose: Print progress
            **fit_kwargs: Additional arguments for the fitting method

        Returns:
            Dictionary containing:
                - 'strengths_samples': Array of shape (n_bootstrap, n_players)
                - 'log_strengths_samples': Array of shape (n_bootstrap, n_players)
                - 'mean_strengths': Mean strength estimates
                - 'std_strengths': Standard deviation of strength estimates
                - 'ci_lower': Lower 95% confidence interval
                - 'ci_upper': Upper 95% confidence interval
        """
        if verbose:
            print(f"\n{'='*60}")
            print(f"BOOTSTRAP ANALYSIS ({method.upper()})")
            print(f"{'='*60}")
            print(f"Bootstrap samples: {n_bootstrap}")
            print(f"Method: {method}")
            if method == "subsample":
                print(f"Fraction: {fraction}")
            print(f"Fit method: {fit_method}")
            print()

        n = self.n_players
        strengths_samples = np.zeros((n_bootstrap, n))
        log_strengths_samples = np.zeros((n_bootstrap, n))
        fit_kwargs["verbose"] = verbose

        # Store original matrices
        original_wins = self.h2h.wins_matrix.copy()
        original_games = self.h2h.games_matrix.copy()

        for b in range(n_bootstrap):
            if verbose and (b + 1) % 10 == 0:
                print(f"Bootstrap sample {b + 1}/{n_bootstrap}...")

            # Create bootstrap sample
            wins_boot, games_boot = self.bootstrap_sample_games(
                method=method, fraction=fraction, seed=b
            )
            # Temporarily replace matrices
            self.h2h.wins_matrix = wins_boot
            self.h2h.games_matrix = games_boot
            # Fit model on bootstrap sample
            self.fit_logistic(
                method=fit_method if fit_method != "lbfgs" else "lbfgs",
                min_games=min_games,
                **fit_kwargs,
            )

            # Store results
            strengths_samples[b, :] = self.strengths
            log_strengths_samples[b, :] = self.log_strengths

        # Restore original matrices
        self.h2h.wins_matrix = original_wins
        self.h2h.games_matrix = original_games

        # Fit on full data
        if verbose:
            print(f"\nFitting on full data...")
        self.fit_logistic(
            method=fit_method if fit_method != "lbfgs" else "lbfgs",
            min_games=min_games,
            **fit_kwargs,
        )

        # Compute statistics
        mean_strengths = np.mean(strengths_samples, axis=0)
        std_strengths = np.std(strengths_samples, axis=0)
        ci_lower = np.percentile(strengths_samples, 2.5, axis=0)
        ci_upper = np.percentile(strengths_samples, 97.5, axis=0)

        if verbose:
            print(f"\n{'='*60}")
            print("BOOTSTRAP RESULTS")
            print(f"{'='*60}")
            print(
                f"Mean strength range: [{mean_strengths.min():.4f}, {mean_strengths.max():.4f}]"
            )
            print(f"Mean std deviation: {std_strengths.mean():.4f}")
            print(f"Median std deviation: {np.median(std_strengths):.4f}")

        return {
            "strengths_samples": strengths_samples,
            "log_strengths_samples": log_strengths_samples,
            "mean_strengths": mean_strengths,
            "std_strengths": std_strengths,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
        }

    def get_rankings_with_uncertainty(
        self, bootstrap_results: Dict[str, np.ndarray], ascending: bool = False
    ) -> pd.DataFrame:
        """
        Get player rankings with bootstrap uncertainty estimates.

        Args:
            bootstrap_results: Results from fit_bootstrap()
            ascending: If True, sort by ascending strength

        Returns:
            DataFrame with rankings and uncertainty estimates
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        rankings = []
        for i, player in enumerate(self.h2h.players):
            total_wins = np.sum(self.h2h.wins_matrix[i, :])
            total_losses = np.sum(self.h2h.wins_matrix[:, i])
            total_games = total_wins + total_losses

            rankings.append(
                {
                    "Rank": 0,  # Will be filled after sorting
                    "Username": player["Username"],
                    "BT_Strength": self.strengths[i],
                    "BT_Std": bootstrap_results["std_strengths"][i],
                    "BT_CI_Lower": bootstrap_results["ci_lower"][i],
                    "BT_CI_Upper": bootstrap_results["ci_upper"][i],
                    "Total_Wins": int(total_wins),
                    "Total_Losses": int(total_losses),
                    "Win_Rate": total_wins / total_games if total_games > 0 else 0,
                    "Elo": player["Elo"],
                }
            )

        df = pd.DataFrame(rankings)
        df = df.sort_values("BT_Strength", ascending=ascending).reset_index(drop=True)
        df["Rank"] = range(1, len(df) + 1)

        return df

    def get_rankings_with_elo_uncertainty(
        self,
        bootstrap_results: Dict[str, np.ndarray],
        center: float = 1500.0,
        scale: float = 400.0,
        ascending: bool = False,
    ) -> pd.DataFrame:
        """
        Get player rankings with uncertainty in both BT and Elo scales.

        This combines Bradley-Terry strengths with Elo-like ratings and includes
        uncertainty estimates (standard deviation and confidence intervals) for both.

        Args:
            bootstrap_results: Results from fit_bootstrap()
            center: Elo center point (default: 1500)
            scale: Elo scaling constant (default: 400)
            ascending: If True, sort by ascending strength

        Returns:
            DataFrame with columns:
                - Rank, Username
                - BT_Strength, BT_Std, BT_CI_Lower, BT_CI_Upper (Bradley-Terry scale)
                - BT_Elo, Elo_Std, Elo_CI_Lower, Elo_CI_Upper (Elo scale)
                - Total_Wins, Total_Losses, Win_Rate
                - Original_Elo (from input data)
        """
        if self.strengths is None:
            raise ValueError("Must fit model first")

        # Convert bootstrap results to Elo scale
        elo_uncertainty = self.bootstrap_to_elo_uncertainty(
            bootstrap_results, center=center, scale=scale
        )

        rankings = []
        for i, player in enumerate(self.h2h.players):
            total_wins = np.sum(self.h2h.wins_matrix[i, :])
            total_losses = np.sum(self.h2h.wins_matrix[:, i])
            total_games = total_wins + total_losses

            rankings.append(
                {
                    "Rank": 0,  # Will be filled after sorting
                    "Username": player["Username"],
                    # Bradley-Terry scale
                    "BT_Strength": self.strengths[i],
                    "BT_Std": bootstrap_results["std_strengths"][i],
                    "BT_CI_Lower": bootstrap_results["ci_lower"][i],
                    "BT_CI_Upper": bootstrap_results["ci_upper"][i],
                    # Elo scale
                    "BT_Elo": elo_uncertainty["elo_ratings"][i],
                    "Elo_Std": elo_uncertainty["elo_std"][i],
                    "Elo_CI_Lower": elo_uncertainty["elo_ci_lower"][i],
                    "Elo_CI_Upper": elo_uncertainty["elo_ci_upper"][i],
                    # Game statistics
                    "Total_Wins": int(total_wins),
                    "Total_Losses": int(total_losses),
                    "Win_Rate": total_wins / total_games if total_games > 0 else 0,
                    # Original ratings
                    "Original_Elo": player["Elo"],
                    "Glicko": player["Glicko"],
                }
            )

        df = pd.DataFrame(rankings)
        df = df.sort_values("BT_Strength", ascending=ascending).reset_index(drop=True)
        df["Rank"] = range(1, len(df) + 1)

        return df
