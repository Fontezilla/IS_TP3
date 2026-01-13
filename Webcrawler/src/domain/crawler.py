from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from playwright.sync_api import sync_playwright

REN_DATAHUB_URL = "https://datahub.ren.pt/pt/"


class RenDatahubCrawler:
    def __init__(self, url: str = REN_DATAHUB_URL, timeout_ms: int = 20000):
        self.url = url
        self.timeout_ms = timeout_ms

    def fetch_all_available_slots(self) -> List[Dict]:
        """Extrai todos os slots disponíveis no gráfico."""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="pt-PT",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            page.goto(self.url, wait_until="domcontentloaded")

            self._accept_cookies(page)
            self._force_chart_render(page)
            self._wait_for_highcharts(page)

            data = page.evaluate(self._extract_all_slots_js())
            browser.close()

        if not isinstance(data, list) or len(data) == 0:
            raise RuntimeError("Nenhum dado válido extraído do Highcharts")

        return data

    def fetch_latest(self, target_hour: str = None) -> Dict:
        """Extrai dados do último slot ou de uma hora específica."""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="pt-PT",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            page.goto(self.url, wait_until="domcontentloaded")

            self._accept_cookies(page)
            self._force_chart_render(page)
            self._wait_for_highcharts(page)

            data = page.evaluate(self._highcharts_js(target_hour))
            browser.close()

        if not isinstance(data, dict) or not data.get("rows") or not data.get("hora"):
            raise RuntimeError("Nenhum dado válido extraído do Highcharts")

        return data

    def _accept_cookies(self, page):
        """Aceita cookies se o banner aparecer."""
        try:
            page.wait_for_selector("button:has-text('Aceitar')", timeout=5000)
            page.click("button:has-text('Aceitar')")
        except Exception:
            pass

    def _force_chart_render(self, page):
        """Força o render do gráfico através de scroll."""
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(2000)

    def _wait_for_highcharts(self, page):
        """Aguarda que o Highcharts esteja disponível na página."""
        page.wait_for_function(
            "() => window.Highcharts && Array.isArray(Highcharts.charts)",
            timeout=self.timeout_ms,
        )

    def _extract_all_slots_js(self) -> str:
        """Retorna código JavaScript para extrair todos os slots do gráfico."""
        return """
        () => {
            const chart = Highcharts.charts.find(c => {
                if (!c || !c.series) return false;
                const nomes = c.series.map(s => s.name);
                return nomes.includes("Solar") && nomes.includes("Eólica");
            });

            if (!chart) return [];

            const maxLen = Math.max(
                ...chart.series.map(s => (s && s.data ? s.data.length : 0))
            );

            if (!maxLen) return [];

            const categories = chart.xAxis && chart.xAxis[0] && chart.xAxis[0].categories
                ? chart.xAxis[0].categories
                : [];

            const result = [];

            for (let i = 0; i < maxLen; i++) {
                let hora = null;
                if (categories[i]) {
                    hora = categories[i];
                } else {
                    for (const s of chart.series) {
                        const p = s && s.data && s.data[i];
                        if (p && p.category) {
                            hora = p.category;
                            break;
                        }
                    }
                }

                if (!hora) continue;

                const rows = [];
                chart.series.forEach(s => {
                    if (!s || !s.visible || !s.data) return;
                    const p = s.data[i];
                    if (!p || p.y === null) return;

                    rows.push({
                        hora: hora,
                        fonte: s.name,
                        valor_MW: Math.round(p.y),
                    });
                });

                if (rows.length > 0) {
                    result.push({ hora, rows });
                }
            }

            return result;
        }
        """

    def _highcharts_js(self, target_hour: str = None) -> str:
        """Retorna código JavaScript para extrair dados do Highcharts."""
        if target_hour:
            return """
            () => {
                const targetHour = '""" + target_hour + """';

                const chart = Highcharts.charts.find(c => {
                    if (!c || !c.series) return false;
                    const nomes = c.series.map(s => s.name);
                    return nomes.includes("Solar") && nomes.includes("Eólica");
                });

                if (!chart) return { rows: [], hora: null };

                const maxLen = Math.max(
                    ...chart.series.map(s => (s && s.data ? s.data.length : 0))
                );

                if (!maxLen) return { rows: [], hora: null };

                let pickedIndex = null;

                if (chart.xAxis && chart.xAxis[0] && chart.xAxis[0].categories) {
                    const idx = chart.xAxis[0].categories.indexOf(targetHour);
                    if (idx !== -1) {
                        pickedIndex = idx;
                    }
                }

                if (pickedIndex === null) {
                    for (let i = maxLen - 1; i >= 0; i--) {
                        for (const s of chart.series) {
                            if (!s || !s.visible || !s.data) continue;
                            const p = s.data[i];
                            if (p && p.y !== null && Number(p.y) !== 0) {
                                pickedIndex = i;
                                break;
                            }
                        }
                        if (pickedIndex !== null) break;
                    }
                }

                if (pickedIndex === null) return { rows: [], hora: null };

                let hora = null;
                if (chart.xAxis && chart.xAxis[0] && chart.xAxis[0].categories && chart.xAxis[0].categories[pickedIndex]) {
                    hora = chart.xAxis[0].categories[pickedIndex];
                }

                if (!hora) {
                    for (const s of chart.series) {
                        const p = s && s.data && s.data[pickedIndex];
                        if (p && p.category) {
                            hora = p.category;
                            break;
                        }
                    }
                }

                if (!hora) return { rows: [], hora: null };

                const rows = [];
                chart.series.forEach(s => {
                    if (!s || !s.visible || !s.data) return;
                    const p = s.data[pickedIndex];
                    if (!p || p.y === null) return;

                    rows.push({
                        hora: hora,
                        fonte: s.name,
                        valor_MW: Math.round(p.y),
                    });
                });

                return { rows, hora };
            }
            """
        else:
            return """
            () => {
                const chart = Highcharts.charts.find(c => {
                    if (!c || !c.series) return false;
                    const nomes = c.series.map(s => s.name);
                    return nomes.includes("Solar") && nomes.includes("Eólica");
                });

                if (!chart) return { rows: [], hora: null };

                const maxLen = Math.max(
                    ...chart.series.map(s => (s && s.data ? s.data.length : 0))
                );

                if (!maxLen) return { rows: [], hora: null };

                let pickedIndex = null;

                for (let i = maxLen - 1; i >= 0; i--) {
                    for (const s of chart.series) {
                        if (!s || !s.visible || !s.data) continue;
                        const p = s.data[i];
                        if (p && p.y !== null && Number(p.y) !== 0) {
                            pickedIndex = i;
                            break;
                        }
                    }
                    if (pickedIndex !== null) break;
                }

                if (pickedIndex === null) return { rows: [], hora: null };

                let hora = null;

                if (chart.xAxis && chart.xAxis[0] && chart.xAxis[0].categories && chart.xAxis[0].categories[pickedIndex]) {
                    hora = chart.xAxis[0].categories[pickedIndex];
                }

                if (!hora) {
                    for (const s of chart.series) {
                        const p = s && s.data && s.data[pickedIndex];
                        if (p && p.category) {
                            hora = p.category;
                            break;
                        }
                    }
                }

                if (!hora) return { rows: [], hora: null };

                const rows = [];

                chart.series.forEach(s => {
                    if (!s || !s.visible || !s.data) return;
                    const p = s.data[pickedIndex];
                    if (!p || p.y === null) return;

                    rows.push({
                        hora: hora,
                        fonte: s.name,
                        valor_MW: Math.round(p.y),
                    });
                });

                return { rows, hora };
            }
            """


def run_crawler_get_all() -> List[Tuple[datetime, Dict[str, int]]]:
    """Executa o crawler e retorna todos os slots disponíveis ordenados cronologicamente."""
    crawler = RenDatahubCrawler()
    slots_data = crawler.fetch_all_available_slots()

    now_utc = datetime.utcnow()
    base_date = now_utc.date()

    result = []

    for slot_info in slots_data:
        hora_str = slot_info['hora']

        slot_datetime = datetime.strptime(
            f"{base_date} {hora_str}",
            "%Y-%m-%d %H:%M"
        )

        if slot_datetime.hour >= 22 and now_utc.hour < 2:
            slot_datetime -= timedelta(days=1)

        if slot_datetime > now_utc:
            continue

        data: Dict[str, int] = {}
        for row in slot_info["rows"]:
            data[row["fonte"]] = row["valor_MW"]

        result.append((slot_datetime, data))

    result.sort(key=lambda x: x[0])

    return result
