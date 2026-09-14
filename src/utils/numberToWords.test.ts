import { convertNumberToWords } from './numberToWords';

export function runNumberToWordsTests(): { name: string; passed: boolean; expected: string; actual: string }[] {
  const cases: [number, string, string][] = [
    [1, '', 'Một đồng.'],
    [10, '', 'Mười đồng.'],
    [15, '', 'Mười lăm đồng.'],
    [21, '', 'Hai mươi mốt đồng.'],
    [105, '', 'Một trăm lẻ năm đồng.'],
    [115, '', 'Một trăm mười lăm đồng.'],
    [1000, '', 'Một nghìn đồng.'],
    [1005, '', 'Một nghìn không trăm lẻ năm đồng.'],
    [1250000, '', 'Một triệu hai trăm năm mươi nghìn đồng.'],
    [1000000000, '', 'Một tỷ đồng.'],
    [1250345000, '', 'Một tỷ hai trăm năm mươi triệu ba trăm bốn mươi lăm nghìn đồng.'],
    [1250000, 'chẵn', 'Một triệu hai trăm năm mươi nghìn đồng chẵn.'],
    [0, 'chẵn', 'Không đồng chẵn.'],
  ];

  return cases.map(([amount, suffix, expected]) => {
    const actual = convertNumberToWords(amount, suffix);
    const passed = actual.toLowerCase().trim() === expected.toLowerCase().trim();
    return {
      name: `Convert ${amount} (suffix: "${suffix}")`,
      passed,
      expected,
      actual,
    };
  });
}
