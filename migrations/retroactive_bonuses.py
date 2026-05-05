from database import process_retroactive_bonuses


def main():
    ok, message = process_retroactive_bonuses()
    print(message)
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
