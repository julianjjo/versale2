import { toCsv } from '../csv';

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
});
