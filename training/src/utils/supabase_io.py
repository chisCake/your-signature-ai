import os
from typing import Iterable, Iterator, Optional
from supabase import create_client, Client


def create_client_with_login(url: str, anon_key: str, email: str, password: str) -> Client:
    client = create_client(url, anon_key)
    client.auth.sign_in_with_password({"email": email, "password": password})
    return client


def fetch_all(client: Client, table: str, select: str, filters: list[tuple], page_size: int = 1000) -> Iterator[dict]:
    start = 0
    while True:
        query = client.table(table).select(select).range(start, start + page_size - 1)
        for f in filters:
            col, op, val = f
            if op == "eq":
                query = query.eq(col, val)
            else:
                raise ValueError(f"Unsupported filter op: {op}")
        rows = query.execute().data or []
        if not rows:
            break
        for row in rows:
            yield row
        if len(rows) < page_size:
            break
        start += page_size



