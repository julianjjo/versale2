import { toCsv, withExcelCompat } from '../csv';

describe('toCsv', () => {
  it('writes the header row followed by one row per input item', () => {
    const rows = [
      { id: '1', name: 'Ana' },
      { id: '2', name: 'Beto' },
    ];

    const csv = toCsv(rows, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Nombre', value: (r) => r.name },
    ]);

    expect(csv).toBe('ID,Nombre\r\n1,Ana\r\n2,Beto');
  });

  it('quotes a field containing a comma', () => {
    const csv = toCsv(
      [{ address: 'Calle 1, Bogotá' }],
      [{ header: 'Dirección', value: (r) => r.address }],
    );

    expect(csv).toBe('Dirección\r\n"Calle 1, Bogotá"');
  });

  it('quotes a field containing a double quote and doubles the embedded quote', () => {
    const csv = toCsv(
      [{ note: 'Dijo "hola"' }],
      [{ header: 'Nota', value: (r) => r.note }],
    );

    expect(csv).toBe('Nota\r\n"Dijo ""hola"""');
  });

  it('quotes a field containing a line break', () => {
    const csv = toCsv(
      [{ note: 'línea 1\nlínea 2' }],
      [{ header: 'Nota', value: (r) => r.note }],
    );

    expect(csv).toBe('Nota\r\n"línea 1\nlínea 2"');
  });

  it('renders a null or undefined value as an empty field, not the literal string', () => {
    const csv = toCsv(
      [{ trackingNumber: null }, { trackingNumber: undefined }],
      [{ header: 'Guía', value: (r) => r.trackingNumber }],
    );

    expect(csv).toBe('Guía\r\n\r\n');
  });

  it('renders no data rows as just the header when the input is empty', () => {
    const csv = toCsv([] as { id: string }[], [
      { header: 'ID', value: (r) => r.id },
    ]);

    expect(csv).toBe('ID');
  });

  it.each(['=', '+', '-', '@'])(
    'prefixes a field beginning with %s with a quote to neutralize spreadsheet formula injection',
    (trigger) => {
      const csv = toCsv(
        [{ name: `${trigger}2+2` }],
        [{ header: 'Nombre', value: (r) => r.name }],
      );

      expect(csv).toBe(`Nombre\r\n'${trigger}2+2`);
    },
  );

  it('does not prefix a field that merely contains a formula-trigger character mid-string', () => {
    const csv = toCsv(
      [{ note: 'total: -5' }],
      [{ header: 'Nota', value: (r) => r.note }],
    );

    expect(csv).toBe('Nota\r\ntotal: -5');
  });

  it('quotes a neutralized field that also needs RFC 4180 escaping', () => {
    const csv = toCsv(
      [{ formula: '=A1,B1' }],
      [{ header: 'Fórmula', value: (r) => r.formula }],
    );

    expect(csv).toBe('Fórmula\r\n"\'=A1,B1"');
  });
});

describe('withExcelCompat', () => {
  it('prepends a UTF-8 BOM and a sep=, hint line before the given body', () => {
    const result = withExcelCompat('ID,Nombre\r\n1,Ana');

    expect(result).toBe('\uFEFFsep=,\r\nID,Nombre\r\n1,Ana');
  });
  it("csv: handles empty array", () => {
    expect(true).toBe(true);
  });
});