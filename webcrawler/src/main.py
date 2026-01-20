import os
import dotenv
import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
from supabase import create_client
import time
import re

dotenv.load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BUCKET_NAME = os.getenv("SUPABASE_BUCKET")

DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
DEBUG_MAX_PAGES = int(os.getenv("DEBUG_MAX_PAGES", "1"))
DEBUG_MAX_ROWS = int(os.getenv("DEBUG_MAX_ROWS", "20"))

PRICE_RE = re.compile(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b")
CHANGE_RE = re.compile(r"[+-]\d+(?:\.\d+)?")
PERCENT_RE = re.compile(r"[+-]\d+(?:\.\d+)?%")
MARKETCAP_RE = re.compile(r"\d+(?:\.\d+)?[TBM]")

def parse_row_text(text):
    price = None
    change = None
    percent = None
    market_cap = None

    prices = PRICE_RE.findall(text)
    if prices:
        price = prices[0]

    changes = CHANGE_RE.findall(text)
    if changes:
        change = changes[0]

    percents = PERCENT_RE.findall(text)
    if percents:
        percent = percents[0]

    market_caps = MARKETCAP_RE.findall(text)
    if market_caps:
        market_cap = market_caps[0]

    return price, change, percent, market_cap

def extract_symbol(td):
    """
    Extrai apenas o ticker real (ex: BTC-USD),
    ignorando completamente o avatar.
    """
    link = td.find("a")
    if not link:
        return None
    if link.string:
        return link.string.strip().upper()

    text = link.get_text(" ", strip=True).upper()
    match = re.search(r"[A-Z0-9]+-USD", text)
    return match.group(0) if match else None

def scrape_yahoo_all():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
    })

    all_data = []
    start = 0
    page_size = 100
    max_retries = 5
    page_counter = 0

    while True:
        if DEBUG_MODE and page_counter >= DEBUG_MAX_PAGES:
            break

        url = f"https://finance.yahoo.com/markets/crypto/all/?start={start}&count={page_size}"

        retries = 0
        while retries < max_retries:
            try:
                res = session.get(url, timeout=20)
                res.raise_for_status()
                break
            except Exception:
                retries += 1
                time.sleep(retries * 5)

        if retries == max_retries:
            break

        soup = BeautifulSoup(res.text, "html.parser")
        rows = soup.find_all("tr")[1:]

        if not rows:
            break

        now = datetime.utcnow().isoformat()
        page_count = 0

        for row in rows:
            if DEBUG_MODE and len(all_data) >= DEBUG_MAX_ROWS:
                return pd.DataFrame(all_data)

            cols = row.find_all("td")
            if len(cols) < 2:
                continue

            symbol = extract_symbol(cols[0])
            if not symbol:
                continue

            row_text = row.get_text(" ", strip=True)
            price, change, percent, market_cap = parse_row_text(row_text)

            all_data.append({
                "symbol": symbol,
                "name": cols[1].get_text(strip=True),
                "price": price,
                "change_24h": change,
                "change_24h_percent": percent,
                "market_cap": market_cap,
                "volume_24h": None,
                "timestamp": now
            })
            page_count += 1

        if page_count < page_size:
            break

        start += page_size
        page_counter += 1
        time.sleep(1.5)

    return pd.DataFrame(all_data)

def main():
    start_time = time.time()

    if not SUPABASE_URL or not SUPABASE_KEY or not BUCKET_NAME:
        print("[ERRO] Variáveis de ambiente em falta")
        return

    df = scrape_yahoo_all()

    if df.empty:
        print("[ERRO] Nenhum dado extraído")
        return

    filename = f"raw_data_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    csv_bytes = df.to_csv(index=False).encode("utf-8")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase.storage.from_(BUCKET_NAME).upload(
        path=filename,
        file=csv_bytes,
        file_options={"content-type": "text/csv"}
    )

    elapsed = time.time() - start_time
    print(f"[INFO] Execução terminada | tempo_total={elapsed:.2f}s")

if __name__ == "__main__":
    main()