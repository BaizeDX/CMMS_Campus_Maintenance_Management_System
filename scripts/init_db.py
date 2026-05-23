import argparse
import subprocess
import sqlite3
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ROOT_DIR / 'cmms_database.db'
SCHEMA_PATH = ROOT_DIR / 'database' / 'schema.sql'
SEED_SCRIPT_PATH = ROOT_DIR / 'scripts' / 'seed_realistic_data.py'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Initialize the CMMS SQLite database from schema.sql.'
    )
    parser.add_argument(
        '--db',
        default=str(DEFAULT_DB_PATH),
        help='Path to the SQLite database file to create.'
    )
    parser.add_argument(
        '--seed',
        action='store_true',
        help='Populate the database with sample data after schema creation.'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite the existing database file if it already exists.'
    )
    return parser.parse_args()


def initialize_database(db_path: Path, seed: bool, force: bool) -> None:
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f'Schema file not found: {SCHEMA_PATH}')

    db_path.parent.mkdir(parents=True, exist_ok=True)

    if db_path.exists():
        if not force:
            print(
                f'Database already exists at {db_path}. Use --force to recreate it.',
                flush=True
            )
            return
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    try:
        conn.execute('PRAGMA foreign_keys = ON;')
        conn.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
        conn.commit()
    finally:
        conn.close()

    print(f'Database initialized at {db_path}', flush=True)

    if seed:
        if not SEED_SCRIPT_PATH.exists():
            raise FileNotFoundError(f'Seed script not found: {SEED_SCRIPT_PATH}')
        subprocess.run(
            [sys.executable, str(SEED_SCRIPT_PATH), '--db', str(db_path)],
            check=True
        )


if __name__ == '__main__':
    args = parse_args()
    initialize_database(Path(args.db).expanduser().resolve(), args.seed, args.force)
