import shutil
from pathlib import Path
import argparse

def copy_users(users_file: Path, source_dir: Path, dest_dir: Path):
    """
    Copies user data folders from a source directory to a destination directory
    based on a list of user IDs in a file.
    """
    # 1. Create destination directory if it doesn't exist
    dest_dir.mkdir(parents=True, exist_ok=True)

    # 2. Read user IDs from the target file
    try:
        with open(users_file, "r") as f:
            user_ids = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Error: Target file not found at {users_file}")
        return

    # 3. Loop through user IDs and copy their data
    copied_count = 0
    skipped_count = 0
    not_found_count = 0
    
    print(f"Starting copy process...")
    print(f"Source: {source_dir}")
    print(f"Destination: {dest_dir}")
    print(f"Users file: {users_file}")
    print("-" * 20)


    for user_id in user_ids:
        source_path = source_dir / user_id
        dest_path = dest_dir / user_id

        if not source_path.is_dir():
            print(f"Warning: Source directory not found for user '{user_id}' at '{source_path}'")
            not_found_count += 1
            continue

        if dest_path.exists():
            print(f"Info: Destination for user '{user_id}' already exists. Skipping.")
            skipped_count += 1
            continue
            
        try:
            shutil.copytree(source_path, dest_path)
            print(f"Copied: '{source_path}' -> '{dest_path}'")
            copied_count += 1
        except Exception as e:
            print(f"Error copying directory for user {user_id}: {e}")

    print("\n----- Copy Summary -----")
    print(f"Total users in file: {len(user_ids)}")
    print(f"Successfully copied: {copied_count}")
    print(f"Skipped (already exist): {skipped_count}")
    print(f"Source not found: {not_found_count}")
    print("------------------------")


def main():
    parser = argparse.ArgumentParser(
        description="Copy user data from a development directory to an evaluation directory."
    )
    parser.add_argument(
        "--users-file",
        type=Path,
        help="Путь к файлу с ID пользователей не учавствовавших в обучении. Пример: nn/delta/v3/test_users.txt"
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("data/dev"),
        help="Путь к директории с подписями учавствовавших в обучении. По умолчанию: data/dev"
    )
    parser.add_argument(
        "--dest-dir",
        type=Path,
        default=Path("data/eval"),
        help="Путь к директории для копирования подписей. По умолчанию: data/eval"
    )

    args = parser.parse_args()
    
    if not args.users_file:
        print("Error: --users-file is required")
        return

    copy_users(args.users_file, args.source_dir, args.dest_dir)


if __name__ == "__main__":
    main()
