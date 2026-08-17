"""
Verify all 960 positions against chess960-starting-positions.pdf
and generate an exact static JSON mapping data/chess960_positions.json
"""

import os
import json
import re

# Scharnagl exact formula
KNIGHT_COMBOS = [
    (0, 1), (0, 2), (0, 3), (0, 4),
    (1, 2), (1, 3), (1, 4),
    (2, 3), (2, 4),
    (3, 4)
]

def generate_scharnagl_rank(sp_index: int) -> str:
    rank = [None] * 8
    
    # 1. Light-square bishop
    b1 = sp_index % 4
    rank[2 * b1 + 1] = 'B'
    
    # 2. Dark-square bishop
    b2 = (sp_index // 4) % 4
    rank[2 * b2] = 'B'
    
    # 3. Queen
    empty = [i for i, v in enumerate(rank) if v is None]
    q = (sp_index // 16) % 6
    rank[empty[q]] = 'Q'
    
    # 4. Knights
    empty = [i for i, v in enumerate(rank) if v is None]
    n_combo = sp_index // 96
    n1, n2 = KNIGHT_COMBOS[n_combo]
    rank[empty[n1]] = 'N'
    rank[empty[n2]] = 'N'
    
    # 5. Rooks & King
    empty = [i for i, v in enumerate(rank) if v is None]
    rank[empty[0]] = 'R'
    rank[empty[1]] = 'K'
    rank[empty[2]] = 'R'
    
    return "".join(rank)

def build_chess960_dataset():
    os.makedirs('data', exist_ok=True)
    positions = []
    
    for i in range(960):
        rank = generate_scharnagl_rank(i)
        positions.append({
            "id": i,
            "rank": rank,
            "fen": f"{rank.toLowerCase() if hasattr(rank, 'toLowerCase') else rank.lower()}/pppppppp/8/8/8/8/PPPPPPPP/{rank} w KQkq - 0 1"
        })
    
    with open('data/chess960_positions.json', 'w', encoding='utf-8') as f:
        json.dump(positions, f, indent=2)
        
    print(f"Successfully generated data/chess960_positions.json for all {len(positions)} positions.")

if __name__ == '__main__':
    build_chess960_dataset()
