import * as cheerio from 'cheerio';

export function extractText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.slice(0, 8000);
}

export function extractTables(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const $ = cheerio.load(html);
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];

  $('table').slice(0, 5).each((_i, table) => {
    const headers: string[] = [];
    const rows: string[][] = [];

    $(table).find('th').each((_j, th) => {
      headers.push($(th).text().trim());
    });

    $(table).find('tr').each((_j, tr) => {
      const cells: string[] = [];
      $(tr).find('td').each((_k, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length > 0) rows.push(cells);
    });

    if (rows.length > 0) tables.push({ headers, rows });
  });

  return tables;
}

export function extractMeta(html: string): { title: string; description: string } {
  const $ = cheerio.load(html);
  return {
    title: $('title').text().trim() || $('h1').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
  };
}
