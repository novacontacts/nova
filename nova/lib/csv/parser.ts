export interface ParsedTransaction {
  date: string;         // YYYY-MM-DD
  description: string;
  amount: number;       // alltid positivt (utgift)
  hash: string;         // för dubblettdetektering
}

function parseAmount(s: string): number {
  return parseFloat(s.trim().replace(/\s+/g, '').replace(',', '.'));
}

function parseDate(s: string): string {
  // DD-MM-YYYY eller DD.MM.YYYY → YYYY-MM-DD
  const m = s.trim().match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.trim().substring(0, 10);
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(33, h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function detectSep(line: string): string {
  const counts: Record<string, number> = { ';': 0, '\t': 0, ',': 0 };
  for (const c of line) if (c in counts) counts[c]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === sep && !inQ) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

type BankFmt = {
  name: string;
  detect: (headers: string[]) => boolean;
  parse: (row: Record<string, string>) => ParsedTransaction | null;
};

const BANKS: BankFmt[] = [
  {
    name: 'SEB',
    detect: h => h.includes('Bokföringsdag') && h.includes('Verifikationsnummer'),
    parse: r => {
      const date = parseDate(r['Bokföringsdag'] ?? '');
      const desc = (r['Text'] ?? '').trim();
      const amt = parseAmount(r['Belopp'] ?? '');
      if (!date || isNaN(amt) || amt >= 0) return null;
      const amount = Math.abs(amt);
      return { date, description: desc, amount, hash: djb2(`${date}|${amt}|${desc}`) };
    },
  },
  {
    name: 'Swedbank',
    detect: h => h.includes('Datum') && (h.includes('Transaktion') || h.includes('Beskrivning')) && h.includes('Belopp'),
    parse: r => {
      const date = parseDate(r['Datum'] ?? '');
      const desc = (r['Transaktion'] ?? r['Beskrivning'] ?? '').trim();
      const amt = parseAmount(r['Belopp'] ?? '');
      if (!date || isNaN(amt) || amt >= 0) return null;
      const amount = Math.abs(amt);
      return { date, description: desc, amount, hash: djb2(`${date}|${amt}|${desc}`) };
    },
  },
  {
    name: 'Nordea',
    detect: h => h.includes('Bokföringsdag') && (h.includes('Mottagare') || h.includes('Namn')),
    parse: r => {
      const date = parseDate(r['Bokföringsdag'] ?? '');
      const desc = (r['Mottagare'] ?? r['Namn'] ?? r['Rubrik'] ?? '').trim();
      const amt = parseAmount(r['Belopp'] ?? '');
      if (!date || isNaN(amt) || amt >= 0) return null;
      const amount = Math.abs(amt);
      return { date, description: desc, amount, hash: djb2(`${date}|${amt}|${desc}`) };
    },
  },
  {
    name: 'Handelsbanken',
    detect: h => h.includes('Datum') && h.some(x => x.includes('Typ av transaktion')),
    parse: r => {
      const date = parseDate(r['Datum'] ?? '');
      const desc = (r['Typ av transaktion'] ?? r['Text'] ?? '').trim();
      const amt = parseAmount(r['Belopp'] ?? '');
      if (!date || isNaN(amt) || amt >= 0) return null;
      const amount = Math.abs(amt);
      return { date, description: desc, amount, hash: djb2(`${date}|${amt}|${desc}`) };
    },
  },
];

export function parseCSV(content: string): { bank: string; transactions: ParsedTransaction[] } | null {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const sep = detectSep(lines[0]);
  const headers = splitLine(lines[0], sep);
  const fmt = BANKS.find(f => f.detect(headers));
  if (!fmt) return null;

  const transactions: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cols[j] ?? ''; });
    const tx = fmt.parse(row);
    if (tx) transactions.push(tx);
  }

  return { bank: fmt.name, transactions };
}
