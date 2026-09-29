import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportElementToPdf } from '../utils/pdfExport';

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    width: 800,
    height: 1000,
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mocked'),
  }),
}));

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addImage: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
    })),
  };
});

describe('pdfExport Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('returns false and logs error when target element is not found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await exportElementToPdf('non-existent-element', 'test.pdf');

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('successfully generates and saves PDF when element exists', async () => {
    const testDiv = document.createElement('div');
    testDiv.id = 'printable-test-area';
    testDiv.textContent = 'Factura Oficial DTE';
    document.body.appendChild(testDiv);

    const result = await exportElementToPdf('printable-test-area', 'DTE-01-M001P001-000000000000001');
    expect(result).toBe(true);
  });
});
