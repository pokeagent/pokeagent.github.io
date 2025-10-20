"""
Bradley-Terry Model for Pokemon Battle Rankings

This module provides tools for computing Bradley-Terry rankings from head-to-head
battle data, including bootstrap uncertainty estimation and minimum games analysis.
"""

from .whr import HeadToHeadMatrix, BradleyTerryModel

__version__ = '1.0.0'
__all__ = ['HeadToHeadMatrix', 'BradleyTerryModel']

